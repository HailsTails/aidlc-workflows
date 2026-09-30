import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, test } from "vitest";
import type {
  ImportanceBinding,
  WritableImportanceBinding,
} from "./rin-gates-importance-binding.ts";
import {
  failureReportOf,
  type IntentBirthRequest,
  type PromotePorts,
  type PromoteRequest,
  parseRequest,
  promote,
  type Result,
  recordDirFromEngineOutput,
  renderFailure,
  renderOutcome,
  reportOf,
} from "./rin-gates-promote";

const BOUND_AT = "2026-08-16T09:00:00Z";

const fixtureRoots: string[] = [];

afterEach(() => {
  fixtureRoots.splice(0).forEach((fixtureRoot) => {
    rmSync(fixtureRoot, { recursive: true, force: true });
  });
});

type PromotionFixture = {
  readonly consumerRoot: string;
  readonly intentsRoot: string;
  readonly selectionRankingConfigPath: string;
  readonly space: string;
  readonly utilityPath: string;
  readonly utilityArgumentsPath: string;
};

const createPromotionFixture = (space: string): PromotionFixture => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "rin-gates-promote-"));
  fixtureRoots.push(fixtureRoot);
  const consumerRoot = join(fixtureRoot, `consumer-${space}`);
  const intentsRoot = join(consumerRoot, "aidlc", "spaces", space, "intents");
  const selectionRankingConfigPath = join(
    fixtureRoot,
    `${space}-selection-ranking.json`,
  );
  const utilityPath = join(fixtureRoot, "fake-aidlc-utility.ts");
  const utilityArgumentsPath = join(fixtureRoot, "utility-arguments.json");
  mkdirSync(intentsRoot, { recursive: true });
  writeFileSync(
    selectionRankingConfigPath,
    JSON.stringify({
      ratifiedMilestones: [`M-${space}`],
      neglectThresholdDays: 11,
    }),
  );
  writeFileSync(
    utilityPath,
    [
      'import { writeFileSync } from "node:fs";',
      'const outputPath = process.env["FAKE_UTILITY_ARGUMENTS_PATH"];',
      "if (outputPath === undefined) process.exit(2);",
      "writeFileSync(outputPath, JSON.stringify(process.argv.slice(2)));",
      `process.stdout.write(JSON.stringify({ space: "${space}", active: null, intents: [] }));`,
    ].join("\n"),
  );
  return {
    consumerRoot,
    intentsRoot,
    selectionRankingConfigPath,
    space,
    utilityPath,
    utilityArgumentsPath,
  };
};

const runPromotionCommand = (args: {
  readonly commandArguments: readonly string[];
  readonly fixture: PromotionFixture;
}) =>
  spawnSync(
    "bun",
    [
      resolve(dirname(fileURLToPath(import.meta.url)), "rin-gates-promote.ts"),
      ...args.commandArguments,
    ],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        FAKE_UTILITY_ARGUMENTS_PATH: args.fixture.utilityArgumentsPath,
        RIN_GATES_ENGINE_CLI: args.fixture.utilityPath,
        RIN_GATES_SELECTION_CONFIG: args.fixture.selectionRankingConfigPath,
        RIN_GATES_SPACE: args.fixture.space,
        RIN_GATES_WORKSPACE_ROOT: args.fixture.consumerRoot,
      },
    },
  );

describe("promotion command composition", () => {
  test("retains the selected ranking policy path in an ordinary success report", () => {
    const fixture = createPromotionFixture("beta");
    const execution = runPromotionCommand({
      fixture,
      commandArguments: [
        "--task-id",
        "capture-beta",
        "--label",
        "promote beta",
        "--scope",
        "rin-gates",
        "--importance",
        "not-flagged:no-milestone:T3",
        "--dry-run",
        "--json",
      ],
    });

    expect(execution.status).toBe(0);
    expect(JSON.parse(execution.stdout)).toMatchObject({
      disposition: "planned",
      selectionRankingConfigPath: fixture.selectionRankingConfigPath,
    });
    expect(
      JSON.parse(readFileSync(fixture.utilityArgumentsPath, "utf8")),
    ).toEqual([
      "--project-dir",
      fixture.consumerRoot,
      "intent",
      "list",
      "--json",
      "--space",
      "beta",
    ]);
  });

  test("uses the selected intents root and retains policy provenance for tier rebind", () => {
    const fixture = createPromotionFixture("gamma");
    const recordDirName = "260910-gamma-record";
    const recordDir = join(fixture.intentsRoot, recordDirName);
    mkdirSync(recordDir, { recursive: true });
    writeFileSync(
      join(recordDir, "importance-binding.json"),
      JSON.stringify({
        flagged: "not-flagged",
        milestone: { kind: "no-milestone" },
        tier: { kind: "unscored" },
        boundAt: "2026-09-09T00:00:00.000Z",
        boundBy: "fixture",
      }),
    );
    const execution = runPromotionCommand({
      fixture,
      commandArguments: [
        "rebind-tier",
        "--record",
        recordDirName,
        "--tier",
        "T1",
        "--evidence",
        "fixture-evidence",
        "--json",
      ],
    });

    expect(execution.status).toBe(0);
    expect(JSON.parse(execution.stdout)).toMatchObject({
      recordDirName,
      rebound: "T1",
      selectionRankingConfigPath: fixture.selectionRankingConfigPath,
    });
    expect(
      JSON.parse(
        readFileSync(join(recordDir, "importance-binding.json"), "utf8"),
      ),
    ).toMatchObject({ tier: { kind: "scored", value: "T1" } });
  });
});

const RATIFIED_MILESTONES: readonly string[] = ["M1", "M2", "M3"];

const request: PromoteRequest = {
  taskId: "capture-1",
  label: "promote flow",
  scope: "rin-gates",
  importance: {
    flagged: "not-flagged",
    milestone: { kind: "no-milestone" },
    tier: { kind: "scored", value: "T3" },
  },
  tierClaim: null,
  promotionArguments: null,
  dryRun: false,
};

const portsWith = (overrides: Partial<PromotePorts>): PromotePorts => ({
  listRecordDirNames: () => [],
  readProvenanceTaskId: () => ({ outcome: "ok", value: null }),
  birthIntent: () => ({ outcome: "ok", value: "260729-promote-flow" }),
  writeProvenance: () => ({ outcome: "ok", value: undefined }),
  writeImportanceBinding: () => ({ outcome: "ok", value: "created" }),
  ...overrides,
});

describe("parseRequest", () => {
  test("reads every supplied flag", () => {
    const parsed = parseRequest([
      "--task-id",
      "capture-1",
      "--label",
      "promote flow",
      "--scope",
      "rin-gates",
      "--importance",
      "not-flagged:no-milestone:T3",
      "--tier-claim",
      JSON.stringify({
        kind: "priced-incident",
        currency: "AUD",
        amount: "1200",
        evidence: "PR #612 postmortem",
      }),
      "--arguments",
      "body prose",
    ]);
    expect(parsed).toEqual({
      outcome: "ok",
      value: {
        taskId: "capture-1",
        label: "promote flow",
        scope: "rin-gates",
        importance: {
          flagged: "not-flagged",
          milestone: { kind: "no-milestone" },
          tier: { kind: "scored", value: "T3" },
        },
        tierClaim: {
          kind: "priced-incident",
          currency: "AUD",
          amount: "1200",
          evidence: "PR #612 postmortem",
        },
        promotionArguments: "body prose",
        dryRun: false,
      },
    });
  });

  test("reads the dry-run flag", () => {
    const parsed = parseRequest([
      "--task-id",
      "capture-1",
      "--label",
      "promote flow",
      "--scope",
      "rin-gates",
      "--importance",
      "not-flagged:no-milestone:T3",
      "--dry-run",
    ]);
    expect(parsed.outcome === "ok" ? parsed.value.dryRun : null).toBe(true);
  });

  test("REFUSES silence — a missing --importance is a missing-argument failure", () => {
    const parsed = parseRequest([
      "--task-id",
      "capture-1",
      "--label",
      "promote flow",
      "--scope",
      "rin-gates",
    ]);
    expect(parsed).toEqual({
      outcome: "failed",
      error: { kind: "missing-argument", flag: "--importance" },
    });
  });

  test("--dry-run ALSO refuses a missing --importance (parse runs before promote)", () => {
    const parsed = parseRequest([
      "--task-id",
      "capture-1",
      "--label",
      "promote flow",
      "--scope",
      "rin-gates",
      "--dry-run",
    ]);
    expect(parsed.outcome).toBe("failed");
  });

  test("accepts a lane-flagged binding carrying a milestone identifier", () => {
    const parsed = parseRequest([
      "--task-id",
      "capture-1",
      "--label",
      "promote flow",
      "--scope",
      "rin-gates",
      "--importance",
      "lane-flagged:M3:unscored",
    ]);
    expect(parsed.outcome === "ok" ? parsed.value.importance : null).toEqual({
      flagged: "lane-flagged",
      milestone: { kind: "milestone", identifier: "M3" },
      tier: { kind: "unscored" },
    });
  });

  test("REFUSES an unscored tier on a no-milestone mint — the operator's 2026-09-04 ban", () => {
    const parsed = parseRequest([
      "--task-id",
      "capture-1",
      "--label",
      "promote flow",
      "--scope",
      "rin-gates",
      "--importance",
      "not-flagged:no-milestone:unscored",
    ]);
    expect(parsed).toEqual({
      outcome: "failed",
      error: {
        kind: "unscored-tier-on-no-milestone",
        received: "not-flagged:no-milestone:unscored",
      },
    });
  });

  // The ban's complement. FR-4 makes a ratified milestone and a scored tier
  // mutually exclusive, so `unscored` is the ONLY legal tier on a milestone-bound
  // mint — a ban that reached this shape would make such records unmintable. This
  // asserts the path the refusal must LET THROUGH, not just the one it blocks.
  test("ADMITS an unscored tier when the mint is milestone-bound", () => {
    const parsed = parseRequest([
      "--task-id",
      "capture-1",
      "--label",
      "promote flow",
      "--scope",
      "rin-gates",
      "--importance",
      "lane-flagged:M1:unscored",
    ]);
    expect(parsed.outcome === "ok" ? parsed.value.importance : null).toEqual({
      flagged: "lane-flagged",
      milestone: { kind: "milestone", identifier: "M1" },
      tier: { kind: "unscored" },
    });
  });

  test("ADMITS every scored tier on a no-milestone mint", () => {
    const scoredTierTokens: readonly string[] = ["T0", "T1", "T2", "T3"];
    const admitted = scoredTierTokens.map((token) =>
      parseRequest([
        "--task-id",
        "capture-1",
        "--label",
        "promote flow",
        "--scope",
        "rin-gates",
        "--importance",
        `not-flagged:no-milestone:${token}`,
      ]),
    );
    expect(admitted.map((parsed) => parsed.outcome)).toEqual([
      "ok",
      "ok",
      "ok",
      "ok",
    ]);
  });

  test("REFUSES operator-flagged through the lane-facing promotion path", () => {
    const parsed = parseRequest([
      "--task-id",
      "capture-1",
      "--label",
      "promote flow",
      "--scope",
      "rin-gates",
      "--importance",
      "operator-flagged:no-milestone",
    ]);
    expect(parsed).toEqual({
      outcome: "failed",
      error: {
        kind: "operator-flag-not-lane-writable",
        received: "operator-flagged:no-milestone",
      },
    });
  });

  test("reports a malformed --importance with no separator", () => {
    const parsed = parseRequest([
      "--task-id",
      "capture-1",
      "--label",
      "promote flow",
      "--scope",
      "rin-gates",
      "--importance",
      "not-flagged",
    ]);
    expect(parsed.outcome === "failed" ? parsed.error.kind : null).toBe(
      "malformed-importance",
    );
  });

  test("reports a malformed --importance with an unknown flag token", () => {
    const parsed = parseRequest([
      "--task-id",
      "capture-1",
      "--label",
      "promote flow",
      "--scope",
      "rin-gates",
      "--importance",
      "urgent:M1",
    ]);
    expect(parsed.outcome === "failed" ? parsed.error.kind : null).toBe(
      "malformed-importance",
    );
  });

  test("reports a malformed --importance with an empty milestone token", () => {
    const parsed = parseRequest([
      "--task-id",
      "capture-1",
      "--label",
      "promote flow",
      "--scope",
      "rin-gates",
      "--importance",
      "not-flagged:",
    ]);
    expect(parsed.outcome === "failed" ? parsed.error.kind : null).toBe(
      "malformed-importance",
    );
  });

  test("parses each scored tier out of the third slot", () => {
    const tierOf = (token: string) => {
      const parsed = parseRequest([
        "--task-id",
        "capture-1",
        "--label",
        "promote flow",
        "--scope",
        "rin-gates",
        "--importance",
        `not-flagged:no-milestone:${token}`,
      ]);
      return parsed.outcome === "ok" ? parsed.value.importance.tier : null;
    };
    expect(tierOf("T0")).toEqual({ kind: "scored", value: "T0" });
    expect(tierOf("T1")).toEqual({ kind: "scored", value: "T1" });
    expect(tierOf("T2")).toEqual({ kind: "scored", value: "T2" });
    expect(tierOf("T3")).toEqual({ kind: "scored", value: "T3" });
    // `unscored` is deliberately absent from this sweep: on a no-milestone mint
    // it is banned, and its acceptance on a MILESTONE-bound mint is asserted by
    // "ADMITS an unscored tier when the mint is milestone-bound" below. Reading
    // the token itself still round-trips; what changed is the shape it is legal on.
  });

  // The defect the slot-count parse exists to prevent: under the first-separator
  // slice a third slot was absorbed into the milestone identifier, so this token
  // parsed happily as the milestone `no-milestone:T1` instead of being rejected.
  test("REFUSES a two-slot token rather than reading it as a tier-less binding", () => {
    const parsed = parseRequest([
      "--task-id",
      "capture-1",
      "--label",
      "promote flow",
      "--scope",
      "rin-gates",
      "--importance",
      "not-flagged:no-milestone",
    ]);
    expect(parsed.outcome === "failed" ? parsed.error.kind : null).toBe(
      "malformed-importance",
    );
  });

  test("REFUSES a four-slot token rather than absorbing the extra slot", () => {
    const parsed = parseRequest([
      "--task-id",
      "capture-1",
      "--label",
      "promote flow",
      "--scope",
      "rin-gates",
      "--importance",
      "not-flagged:no-milestone:T1:extra",
    ]);
    expect(parsed.outcome === "failed" ? parsed.error.kind : null).toBe(
      "malformed-importance",
    );
  });

  test("reports a malformed --importance with an unrecognised tier token", () => {
    const parsed = parseRequest([
      "--task-id",
      "capture-1",
      "--label",
      "promote flow",
      "--scope",
      "rin-gates",
      "--importance",
      "not-flagged:no-milestone:T9",
    ]);
    expect(parsed.outcome === "failed" ? parsed.error.kind : null).toBe(
      "malformed-importance",
    );
  });

  test("reports a malformed --importance with an empty tier token", () => {
    const parsed = parseRequest([
      "--task-id",
      "capture-1",
      "--label",
      "promote flow",
      "--scope",
      "rin-gates",
      "--importance",
      "not-flagged:no-milestone:",
    ]);
    expect(parsed.outcome === "failed" ? parsed.error.kind : null).toBe(
      "malformed-importance",
    );
  });

  // IF-7 locks this refusal UNWEAKENED by the format change: it fires on the flag
  // slot before any tier parsing, so neither a valid tier nor a malformed one can
  // route around it. Asserted against a three-slot token AND against a token whose
  // tier slot is itself junk — the case where a slot-count-first parse would have
  // returned malformed-importance and masked the reserved-value refusal.
  test("REFUSES operator-flagged in the three-slot format, whatever the tier slot holds", () => {
    const refusalFor = (token: string) => {
      const parsed = parseRequest([
        "--task-id",
        "capture-1",
        "--label",
        "promote flow",
        "--scope",
        "rin-gates",
        "--importance",
        token,
      ]);
      return parsed.outcome === "failed" ? parsed.error.kind : null;
    };
    expect(refusalFor("operator-flagged:no-milestone:T0")).toBe(
      "operator-flag-not-lane-writable",
    );
    expect(refusalFor("operator-flagged:no-milestone:nonsense")).toBe(
      "operator-flag-not-lane-writable",
    );
    expect(refusalFor("operator-flagged:no-milestone:T0:extra")).toBe(
      "operator-flag-not-lane-writable",
    );
  });

  test("a claimless mint parses tierClaim as null — no --tier-claim flag supplied", () => {
    const parsed = parseRequest([
      "--task-id",
      "capture-1",
      "--label",
      "promote flow",
      "--scope",
      "rin-gates",
      "--importance",
      "not-flagged:no-milestone:T1",
    ]);
    expect(parsed.outcome === "ok" ? parsed.value.tierClaim : "not-ok").toBe(
      null,
    );
  });

  test("parses a measured-recurrence --tier-claim", () => {
    const parsed = parseRequest([
      "--task-id",
      "capture-1",
      "--label",
      "promote flow",
      "--scope",
      "rin-gates",
      "--importance",
      "not-flagged:no-milestone:T1",
      "--tier-claim",
      JSON.stringify({
        kind: "measured-recurrence",
        perOccurrenceCost: "8 min",
        occurrences: "45",
        denominator: "116 sessions",
        evidence: "gate-evidence ritual retirement",
      }),
    ]);
    expect(parsed.outcome === "ok" ? parsed.value.tierClaim : null).toEqual({
      kind: "measured-recurrence",
      perOccurrenceCost: "8 min",
      occurrences: "45",
      denominator: "116 sessions",
      evidence: "gate-evidence ritual retirement",
    });
  });

  test("REFUSES a --tier-claim that is not valid JSON, as malformed-tier-claim (CD-9: Result, never a throw)", () => {
    const parsed = parseRequest([
      "--task-id",
      "capture-1",
      "--label",
      "promote flow",
      "--scope",
      "rin-gates",
      "--importance",
      "not-flagged:no-milestone:T1",
      "--tier-claim",
      "not json",
    ]);
    expect(parsed).toEqual({
      outcome: "failed",
      error: { kind: "malformed-tier-claim", received: "not json" },
    });
  });

  test("REFUSES a --tier-claim with an unrecognised claim kind", () => {
    const parsed = parseRequest([
      "--task-id",
      "capture-1",
      "--label",
      "promote flow",
      "--scope",
      "rin-gates",
      "--importance",
      "not-flagged:no-milestone:T1",
      "--tier-claim",
      JSON.stringify({ kind: "vibes", evidence: "it feels urgent" }),
    ]);
    expect(parsed.outcome === "failed" ? parsed.error.kind : null).toBe(
      "malformed-tier-claim",
    );
  });

  test("treats a missing --scope as a failure rather than defaulting it", () => {
    const parsed = parseRequest([
      "--task-id",
      "capture-1",
      "--label",
      "promote flow",
    ]);
    expect(parsed).toEqual({
      outcome: "failed",
      error: { kind: "missing-argument", flag: "--scope" },
    });
  });

  test("reports a missing --task-id", () => {
    const parsed = parseRequest([
      "--label",
      "promote flow",
      "--scope",
      "rin-gates",
    ]);
    expect(parsed).toEqual({
      outcome: "failed",
      error: { kind: "missing-argument", flag: "--task-id" },
    });
  });

  test("reports a missing --label", () => {
    const parsed = parseRequest([
      "--task-id",
      "capture-1",
      "--scope",
      "rin-gates",
    ]);
    expect(parsed).toEqual({
      outcome: "failed",
      error: { kind: "missing-argument", flag: "--label" },
    });
  });

  test("omits promotion arguments when the flag has no value", () => {
    const parsed = parseRequest([
      "--task-id",
      "capture-1",
      "--label",
      "promote flow",
      "--scope",
      "rin-gates",
      "--importance",
      "not-flagged:no-milestone:T3",
      "--arguments",
    ]);
    expect(parsed).toEqual({
      outcome: "ok",
      value: {
        taskId: "capture-1",
        label: "promote flow",
        scope: "rin-gates",
        importance: {
          flagged: "not-flagged",
          milestone: { kind: "no-milestone" },
          tier: { kind: "scored", value: "T3" },
        },
        tierClaim: null,
        promotionArguments: null,
        dryRun: false,
      },
    });
  });
});

describe("promote", () => {
  test("births an intent and reports the still-open close obligation", () => {
    const result = promote({
      request,
      workspaceRoot: "/workspace",
      ratifiedMilestones: RATIFIED_MILESTONES,
      boundAt: BOUND_AT,
      ports: portsWith({}),
    });
    expect(result).toEqual({
      outcome: "ok",
      value: {
        kind: "promoted",
        recordDirName: "260729-promote-flow",
        pendingClose: {
          taskId: "capture-1",
          recordDirName: "260729-promote-flow",
          archiveReason: "promoted-to-repo:260729-promote-flow",
        },
      },
    });
  });

  test("passes the requested scope through to intent birth", () => {
    const seen: IntentBirthRequest[] = [];
    promote({
      request,
      workspaceRoot: "/workspace",
      ratifiedMilestones: RATIFIED_MILESTONES,
      boundAt: BOUND_AT,
      ports: portsWith({
        birthIntent: (birthRequest) => {
          seen.push(birthRequest);
          return { outcome: "ok", value: "260729-promote-flow" };
        },
      }),
    });
    expect(seen).toEqual([
      {
        scope: "rin-gates",
        label: "promote flow",
        promotionArguments: null,
        workspaceRoot: "/workspace",
      },
    ]);
  });

  test("is a no-op when a record already carries the capture id", () => {
    const result = promote({
      request,
      workspaceRoot: "/workspace",
      ratifiedMilestones: RATIFIED_MILESTONES,
      boundAt: BOUND_AT,
      ports: portsWith({
        listRecordDirNames: () => ["other-record", "existing-record"],
        readProvenanceTaskId: (recordDirName) => ({
          outcome: "ok",
          value: recordDirName === "existing-record" ? "capture-1" : null,
        }),
        birthIntent: () => {
          throw new Error(
            "birthIntent must not run for an already-promoted capture",
          );
        },
      }),
    });
    expect(result).toEqual({
      outcome: "ok",
      value: {
        kind: "already-promoted",
        recordDirName: "existing-record",
        pendingClose: {
          taskId: "capture-1",
          recordDirName: "existing-record",
          archiveReason: "promoted-to-repo:existing-record",
        },
      },
    });
  });

  test("still reports the close obligation on an already-promoted capture", () => {
    const result = promote({
      request,
      workspaceRoot: "/workspace",
      ratifiedMilestones: RATIFIED_MILESTONES,
      boundAt: BOUND_AT,
      ports: portsWith({
        listRecordDirNames: () => ["existing-record"],
        readProvenanceTaskId: () => ({ outcome: "ok", value: "capture-1" }),
      }),
    });
    expect(
      result.outcome === "ok" && result.value.kind !== "planned"
        ? result.value.pendingClose.archiveReason
        : null,
    ).toBe("promoted-to-repo:existing-record");
  });

  test("surfaces an unreadable provenance file instead of minting a duplicate", () => {
    const result = promote({
      request,
      workspaceRoot: "/workspace",
      ratifiedMilestones: RATIFIED_MILESTONES,
      boundAt: BOUND_AT,
      ports: portsWith({
        listRecordDirNames: () => ["corrupt-record"],
        readProvenanceTaskId: () => ({
          outcome: "failed",
          error: "/intents/corrupt-record/promoted-from.json",
        }),
      }),
    });
    expect(result).toEqual({
      outcome: "failed",
      error: {
        kind: "unreadable-provenance",
        path: "/intents/corrupt-record/promoted-from.json",
      },
    });
  });

  test("propagates an intent-birth failure", () => {
    const result = promote({
      request,
      workspaceRoot: "/workspace",
      ratifiedMilestones: RATIFIED_MILESTONES,
      boundAt: BOUND_AT,
      ports: portsWith({
        birthIntent: () => ({
          outcome: "failed",
          error: { kind: "intent-birth-failed", detail: "unknown scope" },
        }),
      }),
    });
    expect(result).toEqual({
      outcome: "failed",
      error: { kind: "intent-birth-failed", detail: "unknown scope" },
    });
  });

  test("names the orphaned record when the provenance write fails after birth", () => {
    const result = promote({
      request,
      workspaceRoot: "/workspace",
      ratifiedMilestones: RATIFIED_MILESTONES,
      boundAt: BOUND_AT,
      ports: portsWith({
        writeProvenance: () => ({ outcome: "failed", error: "EACCES" }),
      }),
    });
    expect(result).toEqual({
      outcome: "failed",
      error: {
        kind: "provenance-write-failed",
        recordDirName: "260729-promote-flow",
        detail: "EACCES",
      },
    });
  });

  test("writes the importance binding into the mint transaction", () => {
    const written: {
      recordDirName: string;
      binding: ImportanceBinding;
    }[] = [];
    promote({
      request,
      workspaceRoot: "/workspace",
      ratifiedMilestones: RATIFIED_MILESTONES,
      boundAt: BOUND_AT,
      ports: portsWith({
        writeImportanceBinding: (args) => {
          written.push({
            recordDirName: args.recordDirName,
            binding: args.binding,
          });
          return { outcome: "ok", value: "created" };
        },
      }),
    });
    expect(written).toEqual([
      {
        recordDirName: "260729-promote-flow",
        binding: {
          flagged: "not-flagged",
          milestone: { kind: "no-milestone" },
          tier: { kind: "scored", value: "T3" },
          boundAt: BOUND_AT,
          boundBy: "gate-0-reconcile",
        },
      },
    ]);
  });

  // FR-4: a ratified milestone and a scored tier are mutually exclusive. The
  // refusal lands BEFORE the engine births anything, so a rejected pair leaves
  // no half-minted record on disk to hand-fix.
  test("REFUSES a ratified milestone carrying a scored tier, before minting", () => {
    const born: string[] = [];
    const result = promote({
      request: {
        ...request,
        importance: {
          flagged: "lane-flagged",
          milestone: { kind: "milestone", identifier: "M1" },
          tier: { kind: "scored", value: "T1" },
        },
      },
      workspaceRoot: "/workspace",
      ratifiedMilestones: RATIFIED_MILESTONES,
      boundAt: BOUND_AT,
      ports: portsWith({
        birthIntent: () => {
          born.push("birthed");
          return { outcome: "ok", value: "260729-promote-flow" };
        },
      }),
    });
    expect(result).toEqual({
      outcome: "failed",
      error: {
        kind: "ratified-milestone-with-scored-tier",
        milestoneIdentifier: "M1",
        tier: "T1",
      },
    });
    expect(born).toEqual([]);
  });

  test("ADMITS an unratified milestone carrying a scored tier", () => {
    const result = promote({
      request: {
        ...request,
        importance: {
          flagged: "lane-flagged",
          milestone: { kind: "milestone", identifier: "M9-unratified" },
          tier: { kind: "scored", value: "T1" },
        },
      },
      workspaceRoot: "/workspace",
      ratifiedMilestones: RATIFIED_MILESTONES,
      boundAt: BOUND_AT,
      ports: portsWith({}),
    });
    expect(result.outcome).toBe("ok");
  });

  test("ADMITS a ratified milestone with an unscored tier", () => {
    const result = promote({
      request: {
        ...request,
        importance: {
          flagged: "lane-flagged",
          milestone: { kind: "milestone", identifier: "M1" },
          tier: { kind: "unscored" },
        },
      },
      workspaceRoot: "/workspace",
      ratifiedMilestones: RATIFIED_MILESTONES,
      boundAt: BOUND_AT,
      ports: portsWith({}),
    });
    expect(result.outcome).toBe("ok");
  });

  test("ADMITS a no-milestone record carrying a scored tier — the funded case", () => {
    const result = promote({
      request: {
        ...request,
        importance: {
          flagged: "not-flagged",
          milestone: { kind: "no-milestone" },
          tier: { kind: "scored", value: "T0" },
        },
      },
      workspaceRoot: "/workspace",
      ratifiedMilestones: RATIFIED_MILESTONES,
      boundAt: BOUND_AT,
      ports: portsWith({}),
    });
    expect(result.outcome).toBe("ok");
  });

  test("writes the scored tier through to the binding as a determinate value", () => {
    const written: WritableImportanceBinding[] = [];
    promote({
      request: {
        ...request,
        importance: {
          flagged: "not-flagged",
          milestone: { kind: "no-milestone" },
          tier: { kind: "scored", value: "T1" },
        },
      },
      workspaceRoot: "/workspace",
      ratifiedMilestones: RATIFIED_MILESTONES,
      boundAt: BOUND_AT,
      ports: portsWith({
        writeImportanceBinding: (args) => {
          written.push(args.binding);
          return { outcome: "ok", value: "created" };
        },
      }),
    });
    expect(written.map((binding) => binding.tier)).toEqual([
      { kind: "scored", value: "T1" },
    ]);
  });
});

describe("promote — IF-6 write-time tier assessment", () => {
  test("a COMPLETE tier claim writes the claimed tier through unchanged", () => {
    const written: WritableImportanceBinding[] = [];
    promote({
      request: {
        ...request,
        importance: {
          flagged: "not-flagged",
          milestone: { kind: "no-milestone" },
          tier: { kind: "scored", value: "T1" },
        },
        tierClaim: {
          kind: "priced-incident",
          currency: "AUD",
          amount: "1200",
          evidence: "PR #612 postmortem",
        },
      },
      workspaceRoot: "/workspace",
      ratifiedMilestones: RATIFIED_MILESTONES,
      boundAt: BOUND_AT,
      ports: portsWith({
        writeImportanceBinding: (args) => {
          written.push(args.binding);
          return { outcome: "ok", value: "created" };
        },
      }),
    });
    expect(written.map((binding) => binding.tier)).toEqual([
      { kind: "scored", value: "T1" },
    ]);
  });

  test("an INCOMPLETE tier claim demotes the WRITTEN tier to T3 — the claimed value never reaches disk", () => {
    const written: WritableImportanceBinding[] = [];
    promote({
      request: {
        ...request,
        importance: {
          flagged: "not-flagged",
          milestone: { kind: "no-milestone" },
          tier: { kind: "scored", value: "T1" },
        },
        tierClaim: {
          kind: "priced-incident",
          currency: null,
          amount: null,
          evidence: null,
        },
      },
      workspaceRoot: "/workspace",
      ratifiedMilestones: RATIFIED_MILESTONES,
      boundAt: BOUND_AT,
      ports: portsWith({
        writeImportanceBinding: (args) => {
          written.push(args.binding);
          return { outcome: "ok", value: "created" };
        },
      }),
    });
    expect(written.map((binding) => binding.tier)).toEqual([
      { kind: "scored", value: "T3" },
    ]);
  });

  test("an incomplete MEASURED-RECURRENCE claim also demotes the written tier to T3", () => {
    const written: WritableImportanceBinding[] = [];
    promote({
      request: {
        ...request,
        importance: {
          flagged: "not-flagged",
          milestone: { kind: "no-milestone" },
          tier: { kind: "scored", value: "T1" },
        },
        tierClaim: {
          kind: "measured-recurrence",
          perOccurrenceCost: "8 min",
          occurrences: "45",
          denominator: null,
          evidence: "gate-evidence ritual retirement",
        },
      },
      workspaceRoot: "/workspace",
      ratifiedMilestones: RATIFIED_MILESTONES,
      boundAt: BOUND_AT,
      ports: portsWith({
        writeImportanceBinding: (args) => {
          written.push(args.binding);
          return { outcome: "ok", value: "created" };
        },
      }),
    });
    expect(written.map((binding) => binding.tier)).toEqual([
      { kind: "scored", value: "T3" },
    ]);
  });

  test("a complete MEASURED-RECURRENCE claim keeps the claimed tier — the operator's looping-friction ruling reaches the write path", () => {
    const written: WritableImportanceBinding[] = [];
    promote({
      request: {
        ...request,
        importance: {
          flagged: "not-flagged",
          milestone: { kind: "no-milestone" },
          tier: { kind: "scored", value: "T1" },
        },
        tierClaim: {
          kind: "measured-recurrence",
          perOccurrenceCost: "8 min",
          occurrences: "45",
          denominator: "116 sessions",
          evidence: "gate-evidence ritual retirement",
        },
      },
      workspaceRoot: "/workspace",
      ratifiedMilestones: RATIFIED_MILESTONES,
      boundAt: BOUND_AT,
      ports: portsWith({
        writeImportanceBinding: (args) => {
          written.push(args.binding);
          return { outcome: "ok", value: "created" };
        },
      }),
    });
    expect(written.map((binding) => binding.tier)).toEqual([
      { kind: "scored", value: "T1" },
    ]);
  });

  test("a CLAIMLESS mint (tierClaim: null) writes the claimed tier through UNASSESSED — a named, distinct case from an incomplete claim", () => {
    const written: WritableImportanceBinding[] = [];
    promote({
      request: {
        ...request,
        importance: {
          flagged: "not-flagged",
          milestone: { kind: "no-milestone" },
          tier: { kind: "scored", value: "T1" },
        },
        tierClaim: null,
      },
      workspaceRoot: "/workspace",
      ratifiedMilestones: RATIFIED_MILESTONES,
      boundAt: BOUND_AT,
      ports: portsWith({
        writeImportanceBinding: (args) => {
          written.push(args.binding);
          return { outcome: "ok", value: "created" };
        },
      }),
    });
    expect(written.map((binding) => binding.tier)).toEqual([
      { kind: "scored", value: "T1" },
    ]);
  });

  test("an UNSCORED tier is never routed through assessment, even when a tier claim is supplied", () => {
    const written: WritableImportanceBinding[] = [];
    promote({
      request: {
        ...request,
        importance: {
          flagged: "lane-flagged",
          milestone: { kind: "milestone", identifier: "M1" },
          tier: { kind: "unscored" },
        },
        tierClaim: {
          kind: "priced-incident",
          currency: null,
          amount: null,
          evidence: null,
        },
      },
      workspaceRoot: "/workspace",
      ratifiedMilestones: RATIFIED_MILESTONES,
      boundAt: BOUND_AT,
      ports: portsWith({
        writeImportanceBinding: (args) => {
          written.push(args.binding);
          return { outcome: "ok", value: "created" };
        },
      }),
    });
    expect(written.map((binding) => binding.tier)).toEqual([
      { kind: "unscored" },
    ]);
  });

  test("the FR-4 exclusion reports the ASSESSED tier, not the claimed one — a demoted claim's refusal names T3, not the claimed T1", () => {
    const born: string[] = [];
    const result = promote({
      request: {
        ...request,
        importance: {
          flagged: "lane-flagged",
          milestone: { kind: "milestone", identifier: "M1" },
          tier: { kind: "scored", value: "T1" },
        },
        tierClaim: {
          kind: "priced-incident",
          currency: null,
          amount: null,
          evidence: null,
        },
      },
      workspaceRoot: "/workspace",
      ratifiedMilestones: RATIFIED_MILESTONES,
      boundAt: BOUND_AT,
      ports: portsWith({
        birthIntent: () => {
          born.push("birthed");
          return { outcome: "ok", value: "260729-promote-flow" };
        },
      }),
    });
    expect(result).toEqual({
      outcome: "failed",
      error: {
        kind: "ratified-milestone-with-scored-tier",
        milestoneIdentifier: "M1",
        tier: "T3",
      },
    });
    expect(born).toEqual([]);
  });

  test("REFUSES a ratified milestone when the ASSESSED tier stays scored — a complete claim still trips FR-4", () => {
    const born: string[] = [];
    const result = promote({
      request: {
        ...request,
        importance: {
          flagged: "lane-flagged",
          milestone: { kind: "milestone", identifier: "M1" },
          tier: { kind: "scored", value: "T1" },
        },
        tierClaim: {
          kind: "priced-incident",
          currency: "AUD",
          amount: "1200",
          evidence: "PR #612 postmortem",
        },
      },
      workspaceRoot: "/workspace",
      ratifiedMilestones: RATIFIED_MILESTONES,
      boundAt: BOUND_AT,
      ports: portsWith({
        birthIntent: () => {
          born.push("birthed");
          return { outcome: "ok", value: "260729-promote-flow" };
        },
      }),
    });
    expect(result).toEqual({
      outcome: "failed",
      error: {
        kind: "ratified-milestone-with-scored-tier",
        milestoneIdentifier: "M1",
        tier: "T1",
      },
    });
    expect(born).toEqual([]);
  });
});

describe("promote — pre-existing importance-binding write behaviour", () => {
  test("names the orphaned record when the BINDING write fails after birth", () => {
    const result = promote({
      request,
      workspaceRoot: "/workspace",
      ratifiedMilestones: RATIFIED_MILESTONES,
      boundAt: BOUND_AT,
      ports: portsWith({
        writeImportanceBinding: () => ({
          outcome: "failed",
          error: {
            kind: "binding-write-failed",
            recordDirName: "260729-promote-flow",
            detail: "EACCES",
          },
        }),
      }),
    });
    expect(result).toEqual({
      outcome: "failed",
      error: {
        kind: "binding-write-failed",
        recordDirName: "260729-promote-flow",
        detail: "EACCES",
      },
    });
  });

  test("propagates record-dir-absent as its OWN state, not as a write failure", () => {
    const result = promote({
      request,
      workspaceRoot: "/workspace",
      ratifiedMilestones: RATIFIED_MILESTONES,
      boundAt: BOUND_AT,
      ports: portsWith({
        writeImportanceBinding: () => ({
          outcome: "failed",
          error: {
            kind: "record-dir-absent",
            recordDirName: "260729-promote-flow",
          },
        }),
      }),
    });
    expect(result).toEqual({
      outcome: "failed",
      error: {
        kind: "record-dir-absent",
        recordDirName: "260729-promote-flow",
      },
    });
  });

  test("record-dir-absent does NOT claim manual recovery — there is no record to recover", () => {
    expect(
      failureReportOf({
        kind: "record-dir-absent",
        recordDirName: "260729-promote-flow",
      }),
    ).toMatchObject({ manualRecoveryRequired: false, recordDirName: null });
  });

  test("record-dir-absent renders guidance that does NOT tell the operator to hand-write", () => {
    const rendered = renderFailure({
      kind: "record-dir-absent",
      recordDirName: "260729-promote-flow",
    });
    expect(rendered).toContain("does not exist on disk");
    expect(rendered).toContain("Do NOT create the dir by hand");
  });

  test("a binding-write failure reports manual recovery, like the provenance one", () => {
    expect(
      failureReportOf({
        kind: "binding-write-failed",
        recordDirName: "260729-promote-flow",
        detail: "EACCES",
      }),
    ).toMatchObject({
      manualRecoveryRequired: true,
      recordDirName: "260729-promote-flow",
    });
  });

  test("a dry run writes NO binding", () => {
    const written: string[] = [];
    promote({
      request: { ...request, dryRun: true },
      workspaceRoot: "/workspace",
      ratifiedMilestones: RATIFIED_MILESTONES,
      boundAt: BOUND_AT,
      ports: portsWith({
        writeImportanceBinding: (args) => {
          written.push(args.recordDirName);
          return { outcome: "ok", value: "created" };
        },
      }),
    });
    expect(written).toEqual([]);
  });

  test("does not write provenance when intent birth failed", () => {
    const written: string[] = [];
    promote({
      request,
      workspaceRoot: "/workspace",
      ratifiedMilestones: RATIFIED_MILESTONES,
      boundAt: BOUND_AT,
      ports: portsWith({
        birthIntent: () => ({
          outcome: "failed",
          error: { kind: "record-dir-unresolvable", engineOutput: "" },
        }),
        writeProvenance: ({ recordDirName }) => {
          written.push(recordDirName);
          return { outcome: "ok", value: undefined };
        },
      }),
    });
    expect(written).toEqual([]);
  });
});

describe("promote dry run", () => {
  test("plans without birthing an intent", () => {
    const births: IntentBirthRequest[] = [];
    const result = promote({
      request: { ...request, dryRun: true },
      workspaceRoot: "/workspace",
      ratifiedMilestones: RATIFIED_MILESTONES,
      boundAt: BOUND_AT,
      ports: portsWith({
        birthIntent: (birthRequest) => {
          births.push(birthRequest);
          return { outcome: "ok", value: "260729-promote-flow" };
        },
      }),
    });
    expect(births).toEqual([]);
    expect(result).toEqual({
      outcome: "ok",
      value: { kind: "planned", taskId: "capture-1", scope: "rin-gates" },
    });
  });

  test("still short-circuits to already-promoted ahead of the plan", () => {
    const result = promote({
      request: { ...request, dryRun: true },
      workspaceRoot: "/workspace",
      ratifiedMilestones: RATIFIED_MILESTONES,
      boundAt: BOUND_AT,
      ports: portsWith({
        listRecordDirNames: () => ["existing-record"],
        readProvenanceTaskId: () => ({ outcome: "ok", value: "capture-1" }),
      }),
    });
    expect(result.outcome === "ok" ? result.value.kind : null).toBe(
      "already-promoted",
    );
  });
});

describe("reportOf", () => {
  test("marks the close outstanding on a fresh promotion", () => {
    expect(
      reportOf({
        kind: "promoted",
        recordDirName: "260729-promote-flow",
        pendingClose: {
          taskId: "capture-1",
          recordDirName: "260729-promote-flow",
          archiveReason: "promoted-to-repo:260729-promote-flow",
        },
      }),
    ).toEqual({
      disposition: "promoted",
      taskId: "capture-1",
      recordDirName: "260729-promote-flow",
      archiveReason: "promoted-to-repo:260729-promote-flow",
      closeOutstanding: true,
    });
  });

  test("marks the close outstanding on an already-promoted re-run", () => {
    expect(
      reportOf({
        kind: "already-promoted",
        recordDirName: "existing-record",
        pendingClose: {
          taskId: "capture-1",
          recordDirName: "existing-record",
          archiveReason: "promoted-to-repo:existing-record",
        },
      }).closeOutstanding,
    ).toBe(true);
  });

  test("leaves a planned run with nothing outstanding", () => {
    expect(
      reportOf({ kind: "planned", taskId: "capture-1", scope: "rin-gates" }),
    ).toEqual({
      disposition: "planned",
      taskId: "capture-1",
      recordDirName: null,
      archiveReason: null,
      closeOutstanding: false,
    });
  });
});

describe("failureReportOf", () => {
  test("flags manual recovery for an orphaned record", () => {
    expect(
      failureReportOf({
        kind: "provenance-write-failed",
        recordDirName: "260729-promote-flow",
        detail: "EACCES",
      }),
    ).toMatchObject({
      disposition: "failed",
      failure: "provenance-write-failed",
      recordDirName: "260729-promote-flow",
      manualRecoveryRequired: true,
    });
  });

  test("does not flag manual recovery for a rejected argument", () => {
    expect(
      failureReportOf({ kind: "missing-argument", flag: "--scope" }),
    ).toMatchObject({
      failure: "missing-argument",
      recordDirName: null,
      manualRecoveryRequired: false,
    });
  });
});

describe("recordDirFromEngineOutput", () => {
  test("reads the record dir from the engine's birth line", () => {
    expect(
      recordDirFromEngineOutput("Intent born: 260729-promote-flow\n"),
    ).toBe("260729-promote-flow");
  });

  test("strips the trailing space annotation", () => {
    expect(
      recordDirFromEngineOutput(
        "Intent born: 260729-promote-flow (space: default)",
      ),
    ).toBe("260729-promote-flow");
  });

  test("returns null when no birth line is present", () => {
    expect(recordDirFromEngineOutput("Unknown scope\n")).toBeNull();
  });

  test("returns null when the birth line names no dir", () => {
    expect(recordDirFromEngineOutput("Intent born:   \n")).toBeNull();
  });
});

describe("renderOutcome", () => {
  test("marks the close call as still open on a fresh promotion", () => {
    const rendered = renderOutcome({
      kind: "promoted",
      recordDirName: "260729-promote-flow",
      pendingClose: {
        taskId: "capture-1",
        recordDirName: "260729-promote-flow",
        archiveReason: "promoted-to-repo:260729-promote-flow",
      },
    });
    expect(rendered).toContain("PROMOTED  capture-1 -> 260729-promote-flow");
    expect(rendered).toContain(
      'archive_task({ taskId: "capture-1", reason: "promoted-to-repo:260729-promote-flow" })',
    );
    expect(rendered).toContain("still OPEN");
  });

  test("repeats the close call on a no-op re-run", () => {
    const rendered = renderOutcome({
      kind: "already-promoted",
      recordDirName: "existing-record",
      pendingClose: {
        taskId: "capture-1",
        recordDirName: "existing-record",
        archiveReason: "promoted-to-repo:existing-record",
      },
    });
    expect(rendered).toContain("SKIP  capture-1 already promoted");
    expect(rendered).toContain('reason: "promoted-to-repo:existing-record"');
  });
});

describe("renderFailure", () => {
  test("names the flag a caller omitted", () => {
    expect(renderFailure({ kind: "missing-argument", flag: "--scope" })).toBe(
      "--scope is required",
    );
  });

  test("explains the duplicate-record hazard of a failed provenance write", () => {
    const rendered = renderFailure({
      kind: "provenance-write-failed",
      recordDirName: "260729-promote-flow",
      detail: "EACCES",
    });
    expect(rendered).toContain("260729-promote-flow");
    expect(rendered).toContain("SECOND record");
  });

  test("names the length and the limit when the framing is too long to spawn", () => {
    const rendered = renderFailure({
      kind: "promotion-arguments-too-long",
      length: 1400,
      limit: 1000,
    });
    expect(rendered).toContain("1400");
    expect(rendered).toContain("1000");
  });

  test("warns against shortening the framing, the recovery that degrades a record", () => {
    expect(
      renderFailure({
        kind: "promotion-arguments-too-long",
        length: 1400,
        limit: 1000,
      }),
    ).toContain("Do NOT shorten the framing");
  });

  test("quotes the engine output when the record dir is unresolvable", () => {
    expect(
      renderFailure({
        kind: "record-dir-unresolvable",
        engineOutput: "nothing useful",
      }),
    ).toContain("nothing useful");
  });

  test("reports an unreadable provenance path", () => {
    expect(
      renderFailure({
        kind: "unreadable-provenance",
        path: "/a/promoted-from.json",
      }),
    ).toContain("/a/promoted-from.json");
  });

  test("reports an intent-birth failure detail", () => {
    expect(
      renderFailure({ kind: "intent-birth-failed", detail: "unknown scope" }),
    ).toContain("unknown scope");
  });
});

describe("Result", () => {
  test("narrows to the failure branch on a failed parse", () => {
    const parsed: Result<PromoteRequest, unknown> = parseRequest([]);
    expect(parsed.outcome).toBe("failed");
  });
});
