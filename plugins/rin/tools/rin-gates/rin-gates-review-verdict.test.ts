import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { BoardVerdictFileSchema } from "./rin-gates-board-bridge.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const EMITTER = join(HERE, "rin-gates-review-verdict.ts");

const GATE = "rin-gate-0-reconcile";
const RECORD = "verdict-findings-gate";
const HEAD_SHA = "2222222222222222222222222222222222222222";

const LIVE_FINDING =
  "src/kernel/a.ts:12 | const parsed = raw as Config | CD-2 | cast defeats the type";

type EmittedVerdict = {
  readonly verdict?: string;
  readonly findings?: readonly string[];
  readonly blockingFindings?: readonly string[];
};

type EmitOutcome = {
  readonly status: number;
  readonly stderr: string;
  readonly verdictFile: EmittedVerdict | null;
};

const buildWorkspace = (): string => {
  const root = mkdtempSync(join(tmpdir(), "rin-emitter-"));
  mkdirSync(join(root, "aidlc", "spaces", "default", "intents", RECORD), {
    recursive: true,
  });
  return root;
};

const emitWithConfig = ({
  args,
  exceptionWhyChainsEnabled,
}: {
  readonly args: readonly string[];
  readonly exceptionWhyChainsEnabled: boolean;
}): EmitOutcome => {
  const root = buildWorkspace();
  if (exceptionWhyChainsEnabled) {
    writeFileSync(
      join(root, "harness.config.json"),
      JSON.stringify({
        projectName: "verdict-fixture",
        defaultScope: "rin-gates",
        rulesetRoot: "aidlc/spaces/default/memory",
        stageGraph: ".claude/tools/data/stage-graph.json",
        packageManager: { primary: "bun", runnerAllowlist: ["pnpm"] },
        rinGates: { exceptionWhyChains: true },
      }),
    );
  }
  const result = spawnSync("bun", [EMITTER, ...args], {
    encoding: "utf8",
    env: {
      ...process.env,
      RIN_GATES_VERDICT_EMITTER: "1",
      RIN_GATES_TEST_MODE: "1",
      RIN_GATES_HEAD_SHA: HEAD_SHA,
      RIN_GATES_DIFF_DIGEST: "digest",
      RIN_GATES_WORKSPACE_ROOT: root,
      RIN_GATES_SPACE: "default",
    },
  });
  const path = join(
    root,
    "aidlc",
    "spaces",
    "default",
    "intents",
    RECORD,
    "inception",
    GATE,
    "review-verdict.json",
  );
  return {
    status: result.status ?? 0,
    stderr: result.stderr ?? "",
    verdictFile: existsSync(path)
      ? JSON.parse(readFileSync(path, "utf-8"))
      : null,
  };
};

const emit = (args: readonly string[]): EmitOutcome =>
  emitWithConfig({ args, exceptionWhyChainsEnabled: false });

const baseArgs = (verdict: string): readonly string[] => [
  "--record-dir",
  RECORD,
  "--gate",
  GATE,
  "--task-id",
  RECORD,
  "--verdict",
  verdict,
  "--lenses",
  "rin-ddd-modelling-reviewer-agent",
];

describe("a caller-supplied READY is refused over a live finding", () => {
  test("READY carrying an undisposed finding exits non-zero", () => {
    const outcome = emit([...baseArgs("READY"), "--findings", LIVE_FINDING]);
    expect(outcome.status).not.toBe(0);
  });

  test("the refusal names the finding and cites the rule it enforces", () => {
    const outcome = emit([...baseArgs("READY"), "--findings", LIVE_FINDING]);
    expect(outcome.stderr).toContain("CD-2");
    expect(outcome.stderr).toContain("Step 5");
  });

  test("no verdict file is written when the READY is refused", () => {
    const outcome = emit([...baseArgs("READY"), "--findings", LIVE_FINDING]);
    expect(outcome.verdictFile).toBeNull();
  });
});

describe("the emitter's findings gate is fail-safe toward NOT-READY", () => {
  test("a clean READY still emits", () => {
    const outcome = emit(baseArgs("READY"));
    expect(outcome.status).toBe(0);
    expect(outcome.verdictFile?.verdict).toBe("READY");
    const decoded = BoardVerdictFileSchema.safeParse(outcome.verdictFile);
    expect(decoded.success).toBe(true);
    expect(decoded.success && decoded.data.binding).toMatchObject({
      mode: "live",
      headSha: HEAD_SHA,
    });
  });

  test("NOT-READY emits with its findings recorded, never refused", () => {
    const outcome = emit([
      ...baseArgs("NOT-READY"),
      "--findings",
      LIVE_FINDING,
    ]);
    expect(outcome.status).toBe(0);
    expect(outcome.verdictFile?.verdict).toBe("NOT-READY");
    expect(outcome.verdictFile?.findings).toEqual([LIVE_FINDING]);
  });

  test("a finding disposed WITH its evidence does not block a READY", () => {
    const outcome = emit([
      ...baseArgs("READY"),
      "--findings",
      `RESOLVED: ${HEAD_SHA.slice(0, 8)} ${LIVE_FINDING}`,
    ]);
    expect(outcome.status).toBe(0);
    expect(outcome.verdictFile?.verdict).toBe("READY");
  });

  test("a bare DEFERRED prefix does not launder a live finding", () => {
    const outcome = emit([
      ...baseArgs("READY"),
      "--findings",
      `DEFERRED: ${LIVE_FINDING}`,
    ]);
    expect(outcome.status).not.toBe(0);
  });

  test("an emitted verdict records blockingFindings for its consumer", () => {
    const outcome = emit([
      ...baseArgs("NOT-READY"),
      "--findings",
      LIVE_FINDING,
    ]);
    expect(outcome.verdictFile?.blockingFindings).toEqual([LIVE_FINDING]);
  });

  test("semicolons separate findings as newlines do", () => {
    const outcome = emit([
      ...baseArgs("READY"),
      "--findings",
      `${LIVE_FINDING};src/b.ts:3 | f(a, b) | CD-45 | positional`,
    ]);
    expect(outcome.status).not.toBe(0);
    expect(outcome.stderr).toContain("2 undisposed finding(s)");
  });
});

describe("R7 is project opt-in at the verdict emitter", () => {
  const deferredFinding = `defer(ack: configuration-loader responsibility) ${LIVE_FINDING}`;

  test("a project without R7 accepts the acknowledged defer shape", () => {
    const outcome = emit([...baseArgs("READY"), "--findings", deferredFinding]);
    expect(outcome.status).toBe(0);
  });

  test("a project with R7 refuses the defer without its chain", () => {
    const outcome = emitWithConfig({
      args: [...baseArgs("READY"), "--findings", deferredFinding],
      exceptionWhyChainsEnabled: true,
    });
    expect(outcome.status).not.toBe(0);
  });
});

const PUSH_BACK_ROW_WITH_COLUMN_CHAIN =
  "| An opted-in consumer needs baseline bootstrap | push-back(R7 defaults disabled; baseline bootstrap is consumer-owned and needs a packaging design) | 1. Why is bootstrap separate? — the opt-in selects enforcement rather than provisioning (exceptionWhyChains schema default). <br> 2. Why does that matter? — enabling enforcement requires a consumer baseline (exceptionWhyChains opt-in). <br> 3. Why does the consumer own it? — baseline generation resolves consumer registry paths (baseline generator imports and paths). <br> 4. Why is a packaging design needed? — reusable bootstrap must support consumer-owned inputs (consumer baseline responsibility). <br> 5. root cause: adopter-side baseline bootstrap needs a packaging design. owner: consumer bootstrap design (R7 opt-in and baseline ownership ruling). |";

const DEFER_ROW_WITH_SEMICOLON_IN_ACK =
  "| The shared configuration loader reads the opt-in directly | defer(ack: shared configuration-loader responsibility; retain the R7 opt-in read) | 1. Why is this separate? — every harness config consumer shares the same loader (readConfig shared loader). <br> 2. Why does R7 use it? — enforcement depends on the configured opt-in (configR7OptIn callers). <br> 3. Why is there no injected reader? — the shared loader reads through filesystem functions (readConfig existsSync and readFileSync). <br> 4. Why is the sidecar port insufficient? — its responsibility is registry sidecars rather than shared configuration (SidecarFileReader consumer boundary). <br> 5. root cause: shared configuration loading has no filesystem port. owner: shared configuration loader (configuration-loader ownership ruling). |";

describe("the documented disposition-table row is accepted by the R7 emitter", () => {
  test.each([
    [
      "a push-back row whose chain sits in its column",
      PUSH_BACK_ROW_WITH_COLUMN_CHAIN,
    ],
    [
      "a defer row whose ack carries a semicolon",
      DEFER_ROW_WITH_SEMICOLON_IN_ACK,
    ],
  ])("%s exits zero", (_label, row) => {
    const outcome = emitWithConfig({
      args: [...baseArgs("READY"), "--findings", row],
      exceptionWhyChainsEnabled: true,
    });
    expect(outcome.status).toBe(0);
  });

  test("both rows together are two findings, each disposed", () => {
    const outcome = emitWithConfig({
      args: [
        ...baseArgs("READY"),
        "--findings",
        `${PUSH_BACK_ROW_WITH_COLUMN_CHAIN}\n${DEFER_ROW_WITH_SEMICOLON_IN_ACK}`,
      ],
      exceptionWhyChainsEnabled: true,
    });
    expect(outcome.verdictFile?.findings).toHaveLength(2);
  });

  test("a later cell naming fixed@<sha> does not dispose the finding", () => {
    const outcome = emitWithConfig({
      args: [
        ...baseArgs("READY"),
        "--findings",
        "src/kernel/a.ts:12 | const parsed = raw as Config | fixed@a1b2c3d4 | cast",
      ],
      exceptionWhyChainsEnabled: true,
    });
    expect(outcome.status).not.toBe(0);
  });
});
