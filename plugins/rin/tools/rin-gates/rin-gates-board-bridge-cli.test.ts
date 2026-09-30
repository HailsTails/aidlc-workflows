import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, assert, describe, expect, test } from "vitest";
import {
  defaultProjectIdentity,
  validateProjectIdentity,
} from "../rin-harness-config.ts";
import type {
  ReviewPostFailure,
  ReviewPostInvocation,
} from "./rin-gates-board-bridge.ts";
import {
  createNodeReviewCommandExecutor,
  createReviewPostPort,
  PullRequestStateSchema,
  type ReviewCommandExecution,
  type ReviewCommandExecutor,
  ReviewsPayloadSchema,
  verdictPathFor,
} from "./rin-gates-board-bridge-cli.ts";

const WORKSPACE = "/checkout";

describe("verdictPathFor", () => {
  test("resolves a construction gate under its own phase directory", () => {
    const path = verdictPathFor({
      workspaceRoot: WORKSPACE,
      space: "default",
      recordDir: "260904-board-github-bridge",
      gate: "rin-gate-5-review-cycle",
    });

    expect(path).toContain("intents");
    expect(path).toContain("260904-board-github-bridge");
    expect(path).toContain("construction");
    expect(path).toContain("rin-gate-5-review-cycle");
    expect(path).toContain("review-verdict.json");
  });

  test("resolves an inception gate under inception, not construction", () => {
    const path = verdictPathFor({
      workspaceRoot: WORKSPACE,
      space: "default",
      recordDir: "260904-board-github-bridge",
      gate: "rin-gate-1-framing",
    });

    expect(path).toContain("inception");
    expect(path).not.toContain("construction");
  });

  test("honours a non-default space", () => {
    const path = verdictPathFor({
      workspaceRoot: WORKSPACE,
      space: "other-space",
      recordDir: "260904-board-github-bridge",
      gate: "rin-gate-5-review-cycle",
    });

    expect(path).toContain("other-space");
  });

  test("refuses a gate slug the namespace does not own", () => {
    expect(
      verdictPathFor({
        workspaceRoot: WORKSPACE,
        space: "default",
        recordDir: "260904-board-github-bridge",
        gate: "rin-gate-42-invented",
      }),
    ).toBeNull();
  });
});

describe("PullRequestStateSchema", () => {
  test("accepts the fields the bridge asks gh for", () => {
    const decoded = PullRequestStateSchema.safeParse({
      state: "OPEN",
      headRefOid: "a1b2c3d",
    });

    expect(decoded.success).toBe(true);
  });

  test("rejects a payload missing the head, so a null head is never read as a match", () => {
    const decoded = PullRequestStateSchema.safeParse({ state: "OPEN" });

    expect(decoded.success).toBe(false);
  });
});

describe("ReviewsPayloadSchema", () => {
  test("accepts a review carrying its commit", () => {
    const decoded = ReviewsPayloadSchema.safeParse({
      reviews: [
        {
          state: "APPROVED",
          submittedAt: "2026-09-04T22:00:00Z",
          commit: { oid: "a1b2c3d" },
        },
      ],
    });

    expect(decoded.success).toBe(true);
  });

  test("accepts a review with no commit, which the bridge treats as unbound", () => {
    const decoded = ReviewsPayloadSchema.safeParse({
      reviews: [{ state: "COMMENTED", submittedAt: "2026-09-04T22:00:00Z" }],
    });

    expect(decoded.success).toBe(true);
  });

  test("accepts an empty review list", () => {
    const decoded = ReviewsPayloadSchema.safeParse({ reviews: [] });

    expect(decoded.success).toBe(true);
  });
});

describe("configured review posting", () => {
  const invocation = {
    pullRequestNumber: 757,
    event: "approve",
    commitSha: "a1b2c3d4e5f60718293a4b5c6d7e8f9012345678",
    body: "literal $(command); `text`",
  } satisfies ReviewPostInvocation;

  const configured = validateProjectIdentity({
    container: {
      projectIdentity: {
        ...defaultProjectIdentity,
        reviewCommand: {
          executable: "pnpm",
          commandArguments: ["gh:review", "literal;$(prefix)"],
        },
      },
    },
  });
  assert(configured.ok);

  test("passes literal routing and review fields to the injected executor once", () => {
    const requests: {
      readonly executable: string;
      readonly commandArguments: readonly string[];
    }[] = [];
    const executor: ReviewCommandExecutor = {
      execute: (request) => {
        requests.push(request);
        return { kind: "completed", processStatus: 0 };
      },
    };
    const post = createReviewPostPort({
      reviewCommand: configured.value.reviewCommand,
      executor,
    });

    expect(post(invocation)).toEqual({ outcome: "posted" });
    expect(requests).toEqual([
      {
        executable: "pnpm",
        commandArguments: [
          "gh:review",
          "literal;$(prefix)",
          "--pr",
          "757",
          "--event",
          "approve",
          "--commit-sha",
          invocation.commitSha,
          "--body",
          invocation.body,
        ],
      },
    ]);
  });

  test.each<{ execution: ReviewCommandExecution; failure: ReviewPostFailure }>([
    {
      execution: { kind: "completed", processStatus: 7 },
      failure: { kind: "review-post-refused", processStatus: 7 },
    },
    {
      execution: { kind: "launch-failed" },
      failure: { kind: "review-post-unavailable" },
    },
    {
      execution: { kind: "interrupted", terminationSignal: "SIGTERM" },
      failure: {
        kind: "review-post-interrupted",
        terminationSignal: "SIGTERM",
      },
    },
  ])("maps executor result $execution.kind", ({ execution, failure }) => {
    const post = createReviewPostPort({
      reviewCommand: configured.value.reviewCommand,
      executor: { execute: () => execution },
    });
    expect(post(invocation)).toEqual({
      outcome: "failed",
      reviewPostFailure: failure,
    });
  });

  test("does not invoke an executor when routing is unconfigured", () => {
    let calls = 0;
    const post = createReviewPostPort({
      reviewCommand: { kind: "unconfigured" },
      executor: {
        execute: () => {
          calls += 1;
          return { kind: "completed", processStatus: 0 };
        },
      },
    });
    expect(post(invocation)).toEqual({
      outcome: "failed",
      reviewPostFailure: { kind: "review-post-unconfigured" },
    });
    expect(calls).toBe(0);
  });
});

const consumerFixtures: string[] = [];

afterEach(() => {
  consumerFixtures.splice(0).forEach((root) => {
    rmSync(root, { recursive: true, force: true });
  });
});

describe("bridge consumer workflow wiring", () => {
  test.each([
    undefined,
    "alpha",
    "",
  ])("resolves or refuses raw space %j before reading a verdict", (rawSelectedSpace) => {
    const consumerRoot = mkdtempSync(join(tmpdir(), "rin-bridge-selection-"));
    consumerFixtures.push(consumerRoot);
    const utilityPath = join(consumerRoot, "utility.ts");
    const callsPath = join(consumerRoot, "calls.json");
    writeFileSync(
      utilityPath,
      `import { writeFileSync } from "node:fs"; writeFileSync(${JSON.stringify(callsPath)}, JSON.stringify(process.argv.slice(2))); console.log(JSON.stringify({ space: "alpha", intents: [], active: null }));`,
    );
    const result = spawnSync(
      "bun",
      [
        join(import.meta.dirname, "rin-gates-board-bridge-cli.ts"),
        "--record-dir",
        "fixture-record",
        "--gate",
        "rin-gate-5-review-cycle",
        "--pr",
        "1",
      ],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          RIN_GATES_WORKSPACE_ROOT: consumerRoot,
          RIN_GATES_ENGINE_CLI: utilityPath,
          RIN_GATES_SPACE: rawSelectedSpace,
        },
      },
    );
    expect(result.status).toBe(1);
    const expectsUtilityCall = rawSelectedSpace !== "";
    const expectedMessage = expectsUtilityCall
      ? "spaces/alpha/intents/fixture-record"
      : "selected-space-invalid";
    const expectedArguments = expectsUtilityCall
      ? [
          "--project-dir",
          consumerRoot,
          "intent",
          "list",
          "--json",
          ...(rawSelectedSpace === undefined
            ? []
            : ["--space", rawSelectedSpace]),
        ]
      : null;
    const utilityCalled = existsSync(callsPath);
    const actualArguments: unknown = utilityCalled
      ? JSON.parse(readFileSync(callsPath, "utf8"))
      : null;
    expect(result.stderr).toContain(expectedMessage);
    expect(utilityCalled).toBe(expectsUtilityCall);
    expect(actualArguments).toEqual(expectedArguments);
  });
});

describe("Node review launch refusal", () => {
  test.each([
    { executable: "invalid\u0000executable", commandArguments: [] },
    { executable: "node", commandArguments: ["invalid\u0000argument"] },
  ])("maps rejected launch input to result data", (reviewCommand) => {
    const identity = validateProjectIdentity({
      container: {
        projectIdentity: { ...defaultProjectIdentity, reviewCommand },
      },
    });
    assert(identity.ok);
    assert(identity.value.reviewCommand.kind === "configured");
    expect(
      createNodeReviewCommandExecutor().execute(
        identity.value.reviewCommand.binding,
      ),
    ).toEqual({ kind: "launch-failed" });
  });
});
