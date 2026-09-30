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
  IntentRecord,
  RecordRank,
  RecordRankingFacts,
  TransitionOwner,
} from "./rin-gates-status";

const loadStatusAgainstFixture = async () => {
  const root = mkdtempSync(join(tmpdir(), "rin-status-module-"));
  const stageGraphPath = join(root, "stage-graph.json");
  const previousGraph = process.env["AIDLC_STAGE_GRAPH"];
  const stages = [
    "rin-gate-0-reconcile",
    "rin-gate-1-framing",
    "rin-gate-2-plan-review",
    "rin-gate-3-interface-lock",
    "rin-gate-4-implement",
    "rin-gate-5-review-cycle",
    "rin-gate-6-operate",
  ];
  writeFileSync(
    stageGraphPath,
    JSON.stringify(stages.map((slug) => ({ slug, produces: [] }))),
  );
  process.env["AIDLC_STAGE_GRAPH"] = stageGraphPath;
  try {
    return await import("./rin-gates-status");
  } finally {
    if (previousGraph === undefined) delete process.env["AIDLC_STAGE_GRAPH"];
    else process.env["AIDLC_STAGE_GRAPH"] = previousGraph;
    rmSync(root, { recursive: true, force: true });
  }
};

const {
  describeGateWork,
  describeMilestone,
  describeNeglect,
  extractTaskArray,
  orderedRecords,
  readRecordImportance,
  readRecordReadiness,
  recordStatusFor,
  selectIntakeCaptures,
} = await loadStatusAgainstFixture();

const capture = (
  overrides: Record<string, unknown>,
): Record<string, unknown> => ({
  id: "019f0000-0000-7000-8000-000000000001",
  category: "systems",
  title: "a systems capture",
  stage: null,
  archivedAt: null,
  ...overrides,
});

const nonePromoted: ReadonlySet<string> = new Set();

const fixtureRoots: string[] = [];

afterEach(() => {
  fixtureRoots.splice(0).forEach((fixtureRoot) => {
    rmSync(fixtureRoot, { recursive: true, force: true });
  });
});

const createStatusFixture = () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "rin-gates-status-"));
  fixtureRoots.push(fixtureRoot);
  const consumerRoot = join(fixtureRoot, "consumer-alpha");
  const outputRoot = join(fixtureRoot, "status-output");
  const selectionRankingConfigPath = join(
    fixtureRoot,
    "alpha-selection-ranking.json",
  );
  const ownersConfigPath = join(fixtureRoot, "transition-owners.json");
  const stageGraphPath = join(fixtureRoot, "stage-graph.json");
  const utilityPath = join(fixtureRoot, "fake-aidlc-utility.ts");
  const utilityArgumentsPath = join(fixtureRoot, "utility-arguments.json");
  mkdirSync(join(consumerRoot, "aidlc", "spaces", "alpha", "intents"), {
    recursive: true,
  });
  writeFileSync(
    selectionRankingConfigPath,
    JSON.stringify({
      ratifiedMilestones: ["M-alpha"],
      neglectThresholdDays: 9,
    }),
  );
  writeFileSync(
    ownersConfigPath,
    JSON.stringify({ transitions: {}, doneChecks: {} }),
  );
  writeFileSync(stageGraphPath, "[]");
  writeFileSync(
    utilityPath,
    [
      'import { writeFileSync } from "node:fs";',
      'const outputPath = process.env["FAKE_UTILITY_ARGUMENTS_PATH"];',
      "if (outputPath === undefined) process.exit(2);",
      "writeFileSync(outputPath, JSON.stringify(process.argv.slice(2)));",
      'process.stdout.write(JSON.stringify({ space: "alpha", active: null, intents: [] }));',
    ].join("\n"),
  );
  return {
    consumerRoot,
    outputRoot,
    selectionRankingConfigPath,
    ownersConfigPath,
    stageGraphPath,
    utilityPath,
    utilityArgumentsPath,
  };
};

describe("status command composition", () => {
  test("uses the selected consumer context and records ranking policy provenance", () => {
    const fixture = createStatusFixture();
    const statusCommandPath = resolve(
      dirname(fileURLToPath(import.meta.url)),
      "rin-gates-status.ts",
    );
    const execution = spawnSync(
      "bun",
      [statusCommandPath, "--out", fixture.outputRoot],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          AIDLC_STAGE_GRAPH: fixture.stageGraphPath,
          FAKE_UTILITY_ARGUMENTS_PATH: fixture.utilityArgumentsPath,
          RIN_GATES_ENGINE_CLI: fixture.utilityPath,
          RIN_GATES_OWNERS_CONFIG: fixture.ownersConfigPath,
          RIN_GATES_SELECTION_CONFIG: fixture.selectionRankingConfigPath,
          RIN_GATES_SPACE: "alpha",
          RIN_GATES_WORKSPACE_ROOT: fixture.consumerRoot,
        },
      },
    );

    expect(execution.status).toBe(0);
    expect(
      JSON.parse(readFileSync(fixture.utilityArgumentsPath, "utf8")),
    ).toEqual([
      "--project-dir",
      fixture.consumerRoot,
      "intent",
      "list",
      "--json",
      "--space",
      "alpha",
    ]);
    expect(
      JSON.parse(
        readFileSync(join(fixture.outputRoot, "rin-gates-status.json"), "utf8"),
      ),
    ).toMatchObject({
      space: "alpha",
      selectionRankingConfigPath: fixture.selectionRankingConfigPath,
    });
    expect(
      readFileSync(join(fixture.outputRoot, "rin-gates-status.md"), "utf8"),
    ).toContain(
      `Selection ranking policy: ${fixture.selectionRankingConfigPath}`,
    );
  });
});

describe("selectIntakeCaptures", () => {
  test("selects a systems capture whose stage is null", () => {
    const selected = selectIntakeCaptures({
      tasks: [capture({ stage: null })],
      promotedTaskIds: nonePromoted,
    });

    expect(selected).toEqual([
      {
        taskId: "019f0000-0000-7000-8000-000000000001",
        title: "a systems capture",
      },
    ]);
  });

  test("selects a systems capture that omits the stage field entirely", () => {
    const { stage, ...withoutStage } = capture({});

    const selected = selectIntakeCaptures({
      tasks: [withoutStage],
      promotedTaskIds: nonePromoted,
    });

    expect(selected).toHaveLength(1);
  });

  test("excludes a capture already promoted to a repo record", () => {
    const selected = selectIntakeCaptures({
      tasks: [capture({ id: "019f0000-0000-7000-8000-00000000000a" })],
      promotedTaskIds: new Set(["019f0000-0000-7000-8000-00000000000a"]),
    });

    expect(selected).toEqual([]);
  });

  test("excludes an archived capture", () => {
    const selected = selectIntakeCaptures({
      tasks: [capture({ archivedAt: "2026-07-29T00:00:00.000Z" })],
      promotedTaskIds: nonePromoted,
    });

    expect(selected).toEqual([]);
  });

  test("excludes a capture outside the systems category", () => {
    const selected = selectIntakeCaptures({
      tasks: [capture({ category: "admin" })],
      promotedTaskIds: nonePromoted,
    });

    expect(selected).toEqual([]);
  });

  test("excludes a capture that already carries a stage", () => {
    const selected = selectIntakeCaptures({
      tasks: [capture({ stage: "rin-gate-1-framing" })],
      promotedTaskIds: nonePromoted,
    });

    expect(selected).toEqual([]);
  });

  test("selects every null-stage systems capture in a mixed batch", () => {
    const selected = selectIntakeCaptures({
      tasks: [
        capture({ id: "019f0000-0000-7000-8000-00000000000b" }),
        capture({ id: "019f0000-0000-7000-8000-00000000000c" }),
        capture({
          id: "019f0000-0000-7000-8000-00000000000d",
          stage: "rin-gate-4-implement",
        }),
        capture({
          id: "019f0000-0000-7000-8000-00000000000e",
          category: "house",
        }),
      ],
      promotedTaskIds: nonePromoted,
    });

    expect(selected).toEqual([
      {
        taskId: "019f0000-0000-7000-8000-00000000000b",
        title: "a systems capture",
      },
      {
        taskId: "019f0000-0000-7000-8000-00000000000c",
        title: "a systems capture",
      },
    ]);
  });

  test("falls back to the task id as title when the title is not a string", () => {
    const selected = selectIntakeCaptures({
      tasks: [capture({ title: undefined })],
      promotedTaskIds: nonePromoted,
    });

    expect(selected[0]?.title).toBe("019f0000-0000-7000-8000-000000000001");
  });
});

describe("extractTaskArray", () => {
  const systemsCapture = {
    id: "019f0000-0000-7000-8000-000000000001",
    category: "systems",
    title: "a systems capture",
    stage: null,
    archivedAt: null,
  };

  test("unwraps an MCP envelope delivered as a top-level array", () => {
    const envelope = [{ type: "text", text: JSON.stringify([systemsCapture]) }];

    expect(extractTaskArray(envelope)).toEqual([systemsCapture]);
  });

  test("unwraps an MCP envelope delivered as a content object", () => {
    const envelope = {
      content: [{ type: "text", text: JSON.stringify([systemsCapture]) }],
    };

    expect(extractTaskArray(envelope)).toEqual([systemsCapture]);
  });

  test("passes a bare task array through unchanged", () => {
    expect(extractTaskArray([systemsCapture])).toEqual([systemsCapture]);
  });

  test("keeps every capture when the envelope carries a full batch", () => {
    const batch = [
      systemsCapture,
      { ...systemsCapture, id: "019f0000-0000-7000-8000-000000000002" },
      { ...systemsCapture, id: "019f0000-0000-7000-8000-000000000003" },
    ];

    expect(
      extractTaskArray([{ type: "text", text: JSON.stringify(batch) }]),
    ).toHaveLength(3);
  });
});

describe("recordStatusFor", () => {
  const runningRecord: IntentRecord = {
    dirName: "260710-s4-kernel-cd20-stdlib-port",
    uuid: "",
    status: "unknown",
    scope: "rin-gates",
    currentStage: "rin-gate-1-framing",
    workflowStatus: "Running",
    parkedAt: null,
    parkedAtStage: null,
  };
  const noOwners: ReadonlyMap<string, TransitionOwner> = new Map();

  test("classifies a running record at a gate as open pipeline work", () => {
    expect(
      recordStatusFor({ record: runningRecord, owners: noOwners }),
    ).toMatchObject({
      classification: "in-pipeline",
      nextGate: "rin-gate-1-framing",
    });
  });

  const parkedAtCurrent = {
    ...runningRecord,
    parkedAt: "2026-07-24T10:30:58Z",
    parkedAtStage: "rin-gate-1-framing",
  };

  test("classifies a record parked at its current stage as parked, not as its stage's open work", () => {
    expect(
      recordStatusFor({ record: parkedAtCurrent, owners: noOwners }),
    ).toMatchObject({
      classification: "parked",
      nextGate: "rin-gate-1-framing",
    });
  });

  test("classifies a record parked at the operate gate as parked, so the deploy lane does not re-select it", () => {
    expect(
      recordStatusFor({
        record: {
          ...parkedAtCurrent,
          currentStage: "rin-gate-6-operate",
          parkedAtStage: "rin-gate-6-operate",
        },
        owners: noOwners,
      }),
    ).toMatchObject({ classification: "parked" });
  });

  test("classifies an unparked record at the operate gate as terminal-operate — the park marker is the only difference", () => {
    expect(
      recordStatusFor({
        record: { ...runningRecord, currentStage: "rin-gate-6-operate" },
        owners: noOwners,
      }),
    ).toMatchObject({ classification: "terminal-operate" });
  });

  test("ignores a STALE marker — a record that advanced past its parked stage is live, not parked", () => {
    expect(
      recordStatusFor({
        record: {
          ...parkedAtCurrent,
          currentStage: "rin-gate-4-implement",
          parkedAtStage: "rin-gate-1-framing",
        },
        owners: noOwners,
      }),
    ).toMatchObject({
      classification: "in-pipeline",
      nextGate: "rin-gate-4-implement",
    });
  });

  test("ignores a stale marker at the operate gate — it stays a deploy candidate", () => {
    expect(
      recordStatusFor({
        record: {
          ...parkedAtCurrent,
          currentStage: "rin-gate-6-operate",
          parkedAtStage: "rin-gate-2-plan-review",
        },
        owners: noOwners,
      }),
    ).toMatchObject({ classification: "terminal-operate" });
  });

  test("ignores a Parked At Stage with no Parked timestamp — the engine writes both or neither", () => {
    expect(
      recordStatusFor({
        record: { ...runningRecord, parkedAtStage: "rin-gate-1-framing" },
        owners: noOwners,
      }),
    ).toMatchObject({ classification: "in-pipeline" });
  });

  test("excludes a Completed record — a retired or finished workflow is not open work", () => {
    expect(
      recordStatusFor({
        record: { ...runningRecord, workflowStatus: "Completed" },
        owners: noOwners,
      }),
    ).toBeNull();
  });

  test("reports position 0 when built outside the ordering path, so an unranked status cannot read as a top pick", () => {
    expect(
      recordStatusFor({ record: runningRecord, owners: noOwners }),
    ).toMatchObject({ rank: { position: 0, flagged: "unbound" } });
  });
});

describe("orderedRecords", () => {
  const config = {
    ratifiedMilestones: ["M1", "M2"],
    neglectThresholdDays: 30,
  };
  const noOwners: ReadonlyMap<string, TransitionOwner> = new Map();
  const NOW = new Date("2026-08-21T00:00:00Z");
  const daysAgo = (days: number): string =>
    new Date(NOW.getTime() - days * 86_400_000).toISOString();

  type RankingEntry = {
    readonly record: IntentRecord;
    readonly facts: RecordRankingFacts;
  };

  const entry = (args: {
    readonly dirName: string;
    readonly flagged: "operator-flagged" | "not-flagged";
    readonly milestone:
      | { readonly kind: "milestone"; readonly identifier: string }
      | { readonly kind: "no-milestone" };
    readonly ageDays: number;
  }): RankingEntry => ({
    record: {
      dirName: args.dirName,
      uuid: "",
      status: "unknown",
      scope: "rin-gates",
      currentStage: "rin-gate-1-framing",
      workflowStatus: "Running",
      parkedAt: null,
      parkedAtStage: null,
    },
    facts: {
      binding: {
        flagged: args.flagged,
        milestone: args.milestone,
        boundAt: daysAgo(args.ageDays),
        boundBy: "test",
      },
      tier: { kind: "unscored" },
      clock: { source: "stage-advance", at: daysAgo(args.ageDays) },
      promotedTaskId: null,
      readiness: {
        gateArtefactsPresent: 0,
        gateArtefactsExpected: 0,
        storedVerdict: "none",
      },
    },
  });

  const positionsFor = (
    enumerated: readonly RankingEntry[],
  ): readonly string[] =>
    orderedRecords({
      enumerated,
      laneMap: noOwners,
      config,
      now: () => NOW,
    }).map((record) => `${record.rank.position}:${record.dirName}`);

  test("numbers positions from 1, so position 0 stays reserved for an unranked record", () => {
    expect(
      positionsFor([
        entry({
          dirName: "a",
          flagged: "not-flagged",
          milestone: { kind: "no-milestone" },
          ageDays: 1,
        }),
      ]),
    ).toEqual(["1:a"]);
  });

  test("emits positions in the ratified tier order — breach outranks a flag, which outranks milestone rank", () => {
    expect(
      positionsFor([
        entry({
          dirName: "m1-bound",
          flagged: "not-flagged",
          milestone: { kind: "milestone", identifier: "M1" },
          ageDays: 2,
        }),
        entry({
          dirName: "flagged",
          flagged: "operator-flagged",
          milestone: { kind: "no-milestone" },
          ageDays: 1,
        }),
        entry({
          dirName: "breached",
          flagged: "not-flagged",
          milestone: { kind: "no-milestone" },
          ageDays: 40,
        }),
      ]),
    ).toEqual(["1:breached", "2:flagged", "3:m1-bound"]);
  });

  test("an unbreached older record loses to a flagged newer one — the position must show the flag winning, not the age", () => {
    expect(
      positionsFor([
        entry({
          dirName: "old-unflagged",
          flagged: "not-flagged",
          milestone: { kind: "no-milestone" },
          ageDays: 28,
        }),
        entry({
          dirName: "new-flagged",
          flagged: "operator-flagged",
          milestone: { kind: "no-milestone" },
          ageDays: 2,
        }),
      ]),
    ).toEqual(["1:new-flagged", "2:old-unflagged"]);
  });

  test("a no-milestone record can outrank an M1 one on neglect age — the milestone tier only decides between two ratified milestones", () => {
    expect(
      positionsFor([
        entry({
          dirName: "m1-recent",
          flagged: "not-flagged",
          milestone: { kind: "milestone", identifier: "M1" },
          ageDays: 3,
        }),
        entry({
          dirName: "unbound-older",
          flagged: "not-flagged",
          milestone: { kind: "no-milestone" },
          ageDays: 10,
        }),
      ]),
    ).toEqual(["1:unbound-older", "2:m1-recent"]);
  });

  test("carries the rank inputs onto each record, so a lane can cite what it selected on", () => {
    const [first] = orderedRecords({
      enumerated: [
        entry({
          dirName: "breached",
          flagged: "operator-flagged",
          milestone: { kind: "milestone", identifier: "M2" },
          ageDays: 40,
        }),
      ],
      laneMap: noOwners,
      config,
      now: () => NOW,
    });
    expect(first?.rank).toMatchObject({
      position: 1,
      flagged: "operator-flagged",
      milestone: "M2",
      neglectBreach: true,
    });
  });
});

describe("readRecordImportance (IF-10) — one read, two validations", () => {
  const bound = {
    flagged: "not-flagged",
    milestone: { kind: "no-milestone" },
    boundAt: "2026-08-16T09:00:00Z",
    boundBy: "gate-0-reconcile",
  };

  test("carries a scored tier alongside the ratified four fields", () => {
    expect(
      readRecordImportance({
        raw: JSON.stringify({
          ...bound,
          tier: { kind: "scored", value: "T1" },
        }),
      }),
    ).toEqual({ binding: bound, tier: { kind: "scored", value: "T1" } });
  });

  // The 302-artefact back-compat path. Asserted on flag and milestone RETENTION,
  // not on the tier alone: a tier-only assertion passes identically under a
  // design that made the tier key required and collapsed every legacy binding
  // to "unbound", which is the failure this test exists to catch.
  test("a binding with NO tier key retains its flag and milestone", () => {
    expect(readRecordImportance({ raw: JSON.stringify(bound) })).toEqual({
      binding: bound,
      tier: { kind: "unscored" },
    });
  });

  test("an unrecognised tier does not cost the binding its flag or milestone", () => {
    expect(
      readRecordImportance({ raw: JSON.stringify({ ...bound, tier: "T9" }) }),
    ).toEqual({ binding: bound, tier: { kind: "unscored" } });
  });

  // Fail-closed: an unbound binding never yields a scored tier, however the
  // artefact's tier key happens to read.
  test("an unbound binding maps to unscored even carrying a valid tier key", () => {
    expect(
      readRecordImportance({
        raw: JSON.stringify({
          flagged: "nonsense",
          tier: { kind: "scored", value: "T0" },
        }),
      }),
    ).toEqual({ binding: "unbound", tier: { kind: "unscored" } });
  });

  test("an absent artefact reads unbound and unscored", () => {
    expect(readRecordImportance({ raw: null })).toEqual({
      binding: "unbound",
      tier: { kind: "unscored" },
    });
  });
});

describe("describeNeglect", () => {
  const rankWith = (args: {
    readonly neglectDays: number;
    readonly neglectBreach: boolean;
  }): RecordRank => ({
    position: 1,
    flagged: "not-flagged",
    milestone: "no-milestone",
    neglectDays: args.neglectDays,
    neglectBreach: args.neglectBreach,
  });

  test("floors the display value — a reader needs 28d, not the float the comparator ranked on", () => {
    expect(
      describeNeglect({
        rank: rankWith({
          neglectDays: 28.49545616898148,
          neglectBreach: false,
        }),
      }),
    ).toBe("28d");
  });

  test("marks a breach in the cell, so a reader never has to compare against a threshold they must remember", () => {
    expect(
      describeNeglect({
        rank: rankWith({ neglectDays: 31.2, neglectBreach: true }),
      }),
    ).toBe("31d BREACH");
  });
});

describe("describeMilestone", () => {
  const ratifiedMilestones = ["M1", "M2", "M3"];

  test("resolves a ratified milestone to its identifier via its list position, so the emitted value stays orderable", () => {
    expect(
      describeMilestone({
        milestone: { kind: "ratified", rank: 1 },
        ratifiedMilestones,
      }),
    ).toBe("M2");
  });

  test("renders no-milestone as itself — an unbound rank must not render blank and read as absent data", () => {
    expect(
      describeMilestone({
        milestone: { kind: "no-milestone" },
        ratifiedMilestones,
      }),
    ).toBe("no-milestone");
  });

  test("distinguishes unratified from no-milestone — they skip the milestone tier alike but mean different things", () => {
    expect(
      describeMilestone({
        milestone: { kind: "unratified" },
        ratifiedMilestones,
      }),
    ).toBe("unratified");
  });

  test("renders unbound when the record carries no importance binding at all", () => {
    expect(
      describeMilestone({ milestone: { kind: "unbound" }, ratifiedMilestones }),
    ).toBe("unbound");
  });
});

// Hermetic per CD-47: every fixture is built under a fresh mkdtemp the test owns
// and nothing reads or writes a real record dir.
// Zero filesystem operations: the record tree is stated as data and injected.
// CD-47 — every assertion here is about which artefacts the reader COUNTS and
// which verdict token it extracts, and all of that is expressible against a
// fake, so a real temp directory would be an unwarranted spawn.
describe("readRecordReadiness", () => {
  const gateDir = join("record", "inception", "rin-gate-0-reconcile");
  const produces = ["rin-reconcile-report", "rin-readiness-verdict"];
  const readerOver = (tree: Readonly<Record<string, string>>) => ({
    fileExists: (path: string): boolean => Object.hasOwn(tree, path),
    readFile: (path: string): string | null => tree[path] ?? null,
  });

  test("reports zero present before the gate has written anything", () => {
    expect(
      readRecordReadiness({
        recordDir: "record",
        currentStage: "rin-gate-0-reconcile",
        produces,
        reader: readerOver({}),
      }),
    ).toEqual({
      gateArtefactsPresent: 0,
      gateArtefactsExpected: 2,
      storedVerdict: "none",
    });
  });

  test("counts only the artefacts the stage graph declares", () => {
    expect(
      readRecordReadiness({
        recordDir: "record",
        currentStage: "rin-gate-0-reconcile",
        produces,
        reader: readerOver({
          [join(gateDir, "rin-reconcile-report.md")]: "# report",
          [join(gateDir, "some-other-artefact.md")]: "# not declared",
        }),
      }),
    ).toMatchObject({ gateArtefactsPresent: 1, gateArtefactsExpected: 2 });
  });

  test("surfaces the stored verdict token from the gate's own directory", () => {
    expect(
      readRecordReadiness({
        recordDir: "record",
        currentStage: "rin-gate-0-reconcile",
        produces,
        reader: readerOver({
          [join(gateDir, "review-verdict.json")]: JSON.stringify({
            verdict: "NOT-READY",
            headSha: "abc123",
          }),
        }),
      }),
    ).toMatchObject({ storedVerdict: "NOT-READY" });
  });

  test("reads a malformed verdict as none rather than as READY", () => {
    expect(
      readRecordReadiness({
        recordDir: "record",
        currentStage: "rin-gate-0-reconcile",
        produces,
        reader: readerOver({
          [join(gateDir, "review-verdict.json")]: "{ not json",
        }),
      }),
    ).toMatchObject({ storedVerdict: "none" });
  });

  test("still reports the expected count when the stage resolves no gate dir", () => {
    expect(
      readRecordReadiness({
        recordDir: "record",
        currentStage: "not-a-gate",
        produces,
        reader: readerOver({}),
      }),
    ).toEqual({
      gateArtefactsPresent: 0,
      gateArtefactsExpected: 2,
      storedVerdict: "none",
    });
  });
});

describe("describeGateWork", () => {
  test("renders a present/expected fraction a lane reads without an ls", () => {
    expect(
      describeGateWork({
        readiness: {
          gateArtefactsPresent: 0,
          gateArtefactsExpected: 2,
          storedVerdict: "none",
        },
      }),
    ).toBe("0/2");
  });

  test("renders an em dash for a gate that declares no artefacts", () => {
    expect(
      describeGateWork({
        readiness: {
          gateArtefactsPresent: 0,
          gateArtefactsExpected: 0,
          storedVerdict: "none",
        },
      }),
    ).toBe("—");
  });
});
