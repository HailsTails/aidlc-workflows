// Hermetic selftest for the rin-gates seam layer: rin-gates-status.ts
// (materialized reconciliation projection + transition-ownership totality),
// rin-gates-promote.ts (Gate-0 intake→repo promotion), the autonomy backstop
// hook, the verdict guard + emitter, and the review-scribe. Fixture workspaces
// in a temp dir, tools invoked as real subprocesses through their env seams,
// side-effects asserted from disk. Run:
//   pnpm run rin-gates:derivation-selftest
//
// Under repo-SoR the receipt scribe + receipt-guard + attest
// + bind/rebind were dissolved: the engine's own record IS the state authority,
// so there is no separate DB receipt to observe, derive, or bind. Their selftest
// cases went with them; promotion replaces bind as Gate-0's intake move. The
// projection classifier + review-scribe cases below still construct their own
// fixture bindings/receipts and are unaffected by the tool deletions (their
// repo-SoR rewrite is PR2).

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { z } from "zod";
import type { ReviewVerdict } from "../../hooks/rin-gates-autonomy-gate.ts";
import { composePluginFixture } from "../../../../tests/harness/plugin-kit.ts";
import {
  declaredReviewArtifactPathFor,
  loadStageGraphNodes,
} from "./rin-gates-reviewer-identity.ts";

// Read ONCE per run so every fixture age resolves against one instant. Sampling
// per fixture would let a run straddling midnight skew two records' relative
// neglect and decide a rung the case never meant to exercise.
const RUN_INSTANT_MS = Date.now();

const HERE = dirname(fileURLToPath(import.meta.url));
const HOOKS_DIR = resolve(HERE, "..", "..", "hooks");
const STATUS_TOOL = join(HERE, "rin-gates-status.ts");
const PROMOTE_TOOL = join(HERE, "rin-gates-promote.ts");
const AUTONOMY_HOOK = join(HOOKS_DIR, "rin-gates-autonomy-gate.ts");
const VERDICT_GUARD = join(HOOKS_DIR, "rin-gates-verdict-guard.ts");
const VERDICT_EMITTER = join(HERE, "rin-gates-review-verdict.ts");
const SHIPPED_OWNERS_CONFIG = join(HERE, "transition-owners.json");

type ObservedReviewVerdict = ReviewVerdict & {
  readonly findings?: readonly string[];
};

type CaseResult = {
  readonly name: string;
  readonly passed: boolean;
  readonly detail: string;
};
const results: CaseResult[] = [];
const record = (name: string, passed: boolean, detail: string): void => {
  results.push({ name, passed, detail });
  console.log(`${passed ? "PASS" : "FAIL"}  ${name} — ${detail}`);
};

const MINIMUM_CASE_FLOOR = 84;

const SANDBOX = mkdtempSync(join(tmpdir(), "rin-gates-derivation-"));
const publicEngine = composePluginFixture({
  plugin: "rin",
  harness: "claude",
  projectDir: join(SANDBOX, "public-engine"),
  beforeCompose: ({ projectDir }) => {
    mkdirSync(join(projectDir, ".git"));
    const harnessDataPath = join(projectDir, ".claude", "tools", "data", "harness.json");
    writeFileSync(
      harnessDataPath,
      readFileSync(harnessDataPath, "utf-8").replace("{", '{"plugins":["rin"],'),
    );
  },
});
const PUBLIC_ENGINE_TOOLS = join(publicEngine.projectDir, ".claude", "tools");

const fixtureWorkspace = (name: string): string => {
  const root = join(SANDBOX, name);
  mkdirSync(join(root, ".git"), { recursive: true });
  mkdirSync(join(root, "aidlc", "spaces", "default", "intents"), {
    recursive: true,
  });
  mkdirSync(join(root, ".claude", "rin-gates", "receipts"), {
    recursive: true,
  });
  return root;
};

// Under repo-SoR the projection enumerates ENGINE records — a dir holding an
// aidlc-state.md whose Current Stage is a rin gate. This writes such a record
// (the engine's visibility unit), the minimal fixture the projection reads.
const writeEngineRecord = (
  workspaceRoot: string,
  intentDirName: string,
  currentStage: string,
  parkedAtStage?: string,
): string => {
  const recordDir = join(
    workspaceRoot,
    "aidlc",
    "spaces",
    "default",
    "intents",
    intentDirName,
  );
  mkdirSync(recordDir, { recursive: true });
  const parkLines =
    parkedAtStage === undefined
      ? []
      : [
          "- **Parked**: 2026-07-24T10:30:58Z",
          `- **Parked At Stage**: ${parkedAtStage}`,
        ];
  writeFileSync(
    join(recordDir, "aidlc-state.md"),
    [
      "# AI-DLC State Tracking",
      "",
      "## Project Information",
      "- **Scope**: rin-gates",
      "",
      "## Current Status",
      `- **Current Stage**: ${currentStage}`,
      ...parkLines,
      "",
    ].join("\n"),
    "utf-8",
  );
  return recordDir;
};

// A promoted-from.json provenance marker — the promote tool writes this at Gate 0
// so the projection can exclude an already-promoted capture from the intake queue.
const writeProvenance = (
  recordDir: string,
  taskId: string,
  promotedAt = "2026-07-24T00:00:00.000Z",
): void => {
  writeFileSync(
    join(recordDir, "promoted-from.json"),
    `${JSON.stringify({ taskId, promotedBy: "rin-gate-0-reconcile", promotedAt })}\n`,
    "utf-8",
  );
};

// Writes a real audit shard carrying a gate advance, so a fixture record can
// resolve its clock from `stage-advance` rather than `promotion-date`. Without
// this every fixture shares one hardcoded promotion date, `neglectDays` is
// uniform, and rung 5 defers BY CONSTRUCTION — which would make an ordering
// control that claims to prove rung-5 inertness unable to fail either way.
const writeAdvanceShard = (args: {
  readonly recordDir: string;
  readonly at: string;
  readonly stage: string;
}): void => {
  const auditDir = join(args.recordDir, "audit");
  mkdirSync(auditDir, { recursive: true });
  writeFileSync(
    join(auditDir, "selftest-shard.md"),
    [
      "# AI-DLC Audit Log",
      "---",
      `**Timestamp**: ${args.at}`,
      "**Event**: STAGE_COMPLETED",
      `**Stage**: ${args.stage}`,
      "",
    ].join("\n"),
    "utf-8",
  );
};

const runTool = (
  tool: string,
  args: readonly string[],
  workspaceRoot: string,
  extraEnv: Record<string, string> = {},
): {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
} => {
  const spawned = spawnSync("bun", [tool, ...args], {
    encoding: "utf-8",
    env: {
      ...process.env,
      RIN_GATES_WORKSPACE_ROOT: workspaceRoot,
      RIN_GATES_ENGINE_CLI: join(PUBLIC_ENGINE_TOOLS, "aidlc-utility.ts"),
      AIDLC_STAGE_GRAPH: join(PUBLIC_ENGINE_TOOLS, "data", "stage-graph.json"),
      RIN_GATES_OWNERS_CONFIG: SHIPPED_OWNERS_CONFIG,
      ...extraEnv,
    },
  });
  return {
    exitCode: spawned.status ?? 1,
    stdout: spawned.stdout ?? "",
    stderr: spawned.stderr ?? "",
  };
};

const snapshotFile = (
  workspaceRoot: string,
  name: string,
  payload: unknown,
): string => {
  const path = join(workspaceRoot, name);
  writeFileSync(path, `${JSON.stringify(payload)}\n`, "utf-8");
  return path;
};

// ---------------------------------------------------------------------------
// T1 — gate ownership totality holds on the SHIPPED owners config: a record at
// every gate resolves an owning lane, so the projection exits 0.
{
  const workspace = fixtureWorkspace("t1");
  writeEngineRecord(workspace, "260707-t1-gate0", "rin-gate-0-reconcile");
  writeEngineRecord(workspace, "260707-t1-gate5", "rin-gate-5-review-cycle");
  writeEngineRecord(workspace, "260707-t1-operate", "rin-gate-6-operate");
  const { exitCode, stderr } = runTool(STATUS_TOOL, [], workspace);
  record(
    "T1 shipped ownership map is total",
    exitCode === 0,
    exitCode === 0 ? "status exit 0" : stderr.trim(),
  );
}

// T2 — a record at a gate whose owner is missing fails LOUDLY (the "not my lane"
// hole). Deleting the `merged` owner (rin-gate-5-review-cycle) orphans a gate-5 record.
{
  const workspace = fixtureWorkspace("t2");
  writeEngineRecord(workspace, "260707-t2-gate5", "rin-gate-5-review-cycle");
  const shippedOwners = JSON.parse(
    readFileSync(SHIPPED_OWNERS_CONFIG, "utf-8"),
  );
  const { merged: _removed, ...transitionsWithoutMerged } =
    shippedOwners.transitions;
  const holedOwnersPath = join(workspace, "owners-holed.json");
  writeFileSync(
    holedOwnersPath,
    JSON.stringify({ ...shippedOwners, transitions: transitionsWithoutMerged }),
    "utf-8",
  );
  const { exitCode, stderr } = runTool(STATUS_TOOL, [], workspace, {
    RIN_GATES_OWNERS_CONFIG: holedOwnersPath,
  });
  const namesTheHole =
    stderr.includes("rin-gate-5-review-cycle") && stderr.includes("no owner");
  record(
    "T2 unowned gate fails loudly",
    exitCode === 1 && namesTheHole,
    `exit ${exitCode}; names hole: ${namesTheHole}`,
  );
}

// T3 — engine-state classifier (repo-SoR): every on-disk record enumerates by its
// Current Stage into in-pipeline (gate 0..5) or terminal-operate (gate-6), and the
// intake queue is the unpromoted systems captures from the DB snapshot.
{
  const workspace = fixtureWorkspace("t3");
  writeEngineRecord(workspace, "260707-mid-pipeline", "rin-gate-2-plan-review");
  writeEngineRecord(workspace, "260707-operate", "rin-gate-6-operate");
  writeEngineRecord(
    workspace,
    "260707-parked-at-operate",
    "rin-gate-6-operate",
    "rin-gate-6-operate",
  );
  writeEngineRecord(
    workspace,
    "260707-parked-mid-pipeline",
    "rin-gate-2-plan-review",
    "rin-gate-2-plan-review",
  );
  writeEngineRecord(
    workspace,
    "260707-stale-marker",
    "rin-gate-4-implement",
    "rin-gate-1-framing",
  );
  writeEngineRecord(
    workspace,
    "260707-stale-marker-at-operate",
    "rin-gate-6-operate",
    "rin-gate-2-plan-review",
  );
  const promotedRecord = writeEngineRecord(
    workspace,
    "260707-already-promoted",
    "rin-gate-0-reconcile",
  );
  writeProvenance(promotedRecord, "capture-promoted");
  const snapshot = snapshotFile(workspace, "tasks.json", [
    {
      id: "capture-intake",
      category: "systems",
      stage: null,
      archivedAt: null,
      title: "fresh intake",
    },
    {
      id: "capture-promoted",
      category: "systems",
      stage: null,
      archivedAt: null,
      title: "already promoted",
    },
    {
      id: "capture-archived",
      category: "systems",
      stage: null,
      archivedAt: "2026-07-01T00:00:00.000Z",
      title: "archived, excluded",
    },
    {
      id: "capture-nonsystems",
      category: "admin",
      stage: null,
      archivedAt: null,
      title: "non-systems, excluded",
    },
  ]);
  const { exitCode } = runTool(
    STATUS_TOOL,
    ["--tasks-snapshot", snapshot],
    workspace,
  );
  const statusJson = JSON.parse(
    readFileSync(join(workspace, "aidlc", "rin-gates-status.json"), "utf-8"),
  );
  const classificationOf = (dirName: string): string =>
    statusJson.records.find(
      (record: { dirName: string }) => record.dirName === dirName,
    )?.classification ?? "ABSENT";
  const recordExpected: readonly (readonly [string, string])[] = [
    ["260707-mid-pipeline", "in-pipeline"],
    ["260707-operate", "terminal-operate"],
    ["260707-already-promoted", "in-pipeline"],
    ["260707-parked-at-operate", "parked"],
    ["260707-parked-mid-pipeline", "parked"],
    ["260707-stale-marker", "in-pipeline"],
    ["260707-stale-marker-at-operate", "terminal-operate"],
  ];
  const recordMismatches = recordExpected
    .filter(([dirName, cls]) => classificationOf(dirName) !== cls)
    .map(
      ([dirName, cls]) =>
        `${dirName}: expected ${cls}, got ${classificationOf(dirName)}`,
    );
  record(
    "T3 records enumerate from engine Current Stage into the closed class set, and a park marker classifies parked ONLY when it names the current stage (the engine's STALE-BY-PROGRESS rule)",
    exitCode === 0 && recordMismatches.length === 0,
    recordMismatches.length === 0
      ? "in-pipeline + terminal-operate + parked correct. Two discriminations, not one: 260707-operate vs 260707-parked-at-operate share Current Stage rin-gate-6-operate and differ ONLY by the park marker (the marker is read, not the stage); 260707-parked-mid-pipeline vs 260707-stale-marker both carry a marker and differ ONLY in whether it equals Current Stage (the engine's STALE-BY-PROGRESS rule is applied, so a record that advanced past its parked stage stays live)"
      : recordMismatches.join("; "),
  );
  const intakeIds = statusJson.intake.map(
    (capture: { taskId: string }) => capture.taskId,
  );
  const intakeOnlyFresh =
    intakeIds.length === 1 && intakeIds[0] === "capture-intake";
  record(
    "T3b intake queue is unpromoted, non-archived, systems-only captures",
    intakeOnlyFresh,
    `intake=[${intakeIds.join(", ")}] (expected only capture-intake)`,
  );
  const midPipeline = statusJson.records.find(
    (r: { dirName: string }) => r.dirName === "260707-mid-pipeline",
  );
  record(
    "T3c in-pipeline record names its Current Stage as next gate + a lane owner",
    midPipeline?.nextGate === "rin-gate-2-plan-review" &&
      midPipeline?.owningLane === "spec",
    `nextGate=${midPipeline?.nextGate} lane=${midPipeline?.owningLane}`,
  );
}

// ---------------------------------------------------------------------------
// P — rin-gates-promote: Gate-0's one-way intake→repo promotion (replaces bind).
// The engine's real intent-birth runs as a subprocess, so these fixtures use a
// git-init'd workspace (the engine bootstraps its shell there) and the promote
// tool's RIN_GATES_WORKSPACE_ROOT seam. HERMETIC: no helen-tasks MCP is touched
// — the tool prints the archive_task close call for the session, never makes it.
const runPromote = (
  workspaceRoot: string,
  args: readonly string[],
): { exitCode: number; stdout: string; stderr: string } =>
  runTool(PROMOTE_TOOL, args, workspaceRoot);

const gitInitWorkspace = (name: string): string => {
  const root = join(SANDBOX, name);
  mkdirSync(root, { recursive: true });
  // Mark a checkout root so the tool's checkoutRootFromHere walk-up and the
  // engine's project-dir resolution both stop here. No real git process is
  // spawned by promote or intent-birth in this path (a bare .git dir suffices
  // for the workspace-root probes); the engine writes its shell under aidlc/.
  mkdirSync(join(root, ".git"), { recursive: true });
  return root;
};

// P1 — promote creates a native intent record from a systems capture, routes it
// to rin-gate-0-reconcile, writes DEAD provenance, and prints the archive close call.
{
  const workspace = gitInitWorkspace("p1");
  const taskId = "0000p1aa-0000-0000-0000-000000000001";
  const { exitCode, stdout, stderr } = runPromote(workspace, [
    "--task-id",
    taskId,
    "--label",
    "promote one",
    "--scope",
    "rin-gates",
    "--importance",
    "not-flagged:no-milestone:T3",
    "--arguments",
    "P1 fixture capture",
  ]);
  const intentsRoot = join(workspace, "aidlc", "spaces", "default", "intents");
  const promotedLine = stdout
    .split("\n")
    .find((line) => line.startsWith("PROMOTED"));
  const dirName = promotedLine?.split("->")[1]?.trim().split(" ")[0] ?? "";
  const provenancePath = join(intentsRoot, dirName, "promoted-from.json");
  const provenance = existsSync(provenancePath)
    ? JSON.parse(readFileSync(provenancePath, "utf-8"))
    : null;
  const statePath = join(intentsRoot, dirName, "aidlc-state.md");
  const routesToGate0 =
    existsSync(statePath) &&
    readFileSync(statePath, "utf-8").includes(
      "Current Stage**: rin-gate-0-reconcile",
    );
  record(
    "P1 promote creates a rin-gate-0-routed record with dead provenance and prints the close call",
    exitCode === 0 &&
      provenance?.taskId === taskId &&
      routesToGate0 &&
      stdout.includes(`archive_task`) &&
      stdout.includes(`promoted-to-repo:${dirName}`),
    provenance
      ? `dir=${dirName} provenance.taskId=${provenance.taskId} gate0=${routesToGate0}`
      : `${stdout}${stderr}`.trim(),
  );

  // P8 — the binding artefact is READ BACK FROM DISK, never inferred from the
  // exit code: a record minted without its binding reads as unbound and
  // silently rejoins the standing pool.
  const bindingPath = join(intentsRoot, dirName, "importance-binding.json");
  const binding = existsSync(bindingPath)
    ? JSON.parse(readFileSync(bindingPath, "utf-8"))
    : null;
  record(
    "P8 promotion writes the importance binding, read back from disk",
    binding?.flagged === "not-flagged" &&
      binding?.milestone?.kind === "no-milestone" &&
      typeof binding?.boundAt === "string" &&
      binding?.boundBy === "gate-0-reconcile",
    binding
      ? `flagged=${binding.flagged} milestone=${binding.milestone?.kind} boundBy=${binding.boundBy}`
      : `no binding at ${bindingPath}`,
  );

  // P2 — idempotency: a second promote of the same taskId no-ops (one dir, one
  // registry row), still printing the same close call.
  const rerun = runPromote(workspace, [
    "--task-id",
    taskId,
    "--label",
    "promote one",
    "--scope",
    "rin-gates",
    "--importance",
    "not-flagged:no-milestone:T3",
  ]);
  const intentDirs = existsSync(intentsRoot)
    ? readFileSync(join(intentsRoot, "intents.json"), "utf-8")
    : "[]";
  const rowCount = (intentDirs.match(/"uuid"/g) ?? []).length;
  record(
    "P2 promote is idempotent (already-promoted taskId no-ops, one registry row)",
    rerun.exitCode === 0 &&
      rerun.stdout.includes("already promoted") &&
      rerun.stdout.includes(`archive_task`) &&
      rowCount === 1,
    `rerun says already-promoted; registry rows=${rowCount}`,
  );
}

// P3 — dry-run creates nothing and writes no provenance. Now carries the
// required --importance flag, so it still reaches the PLAN branch.
{
  const workspace = gitInitWorkspace("p3");
  const { exitCode, stdout } = runPromote(workspace, [
    "--task-id",
    "0000p3aa-0000-0000-0000-000000000003",
    "--label",
    "dry run",
    "--scope",
    "rin-gates",
    "--importance",
    "not-flagged:no-milestone:T3",
    "--dry-run",
  ]);
  const intentsRoot = join(workspace, "aidlc", "spaces", "default", "intents");
  record(
    "P3 promote --dry-run plans without creating a record",
    exitCode === 0 && stdout.startsWith("PLAN") && !existsSync(intentsRoot),
    `plan printed; intents dir absent: ${!existsSync(intentsRoot)}`,
  );
}

// P3b — the operator's 2026-09-04 ban, asserted at the CLI boundary: an unscored
// tier on a no-milestone mint is refused, and the refusal names T3 so the caller
// is not left guessing. Run under --dry-run because the refusal must fire during
// parse, BEFORE anything is created.
{
  const workspace = gitInitWorkspace("p3b");
  const { exitCode, stderr } = runPromote(workspace, [
    "--task-id",
    "0000p3ba-0000-0000-0000-00000000003b",
    "--label",
    "unscored ban",
    "--scope",
    "rin-gates",
    "--importance",
    "not-flagged:no-milestone:unscored",
    "--dry-run",
  ]);
  const intentsRoot = join(workspace, "aidlc", "spaces", "default", "intents");
  record(
    "P3b promote REFUSES an unscored tier on a no-milestone mint, naming T3, creating nothing",
    exitCode !== 0 &&
      stderr.includes("no longer allowed") &&
      stderr.includes("T3") &&
      !existsSync(intentsRoot),
    `exit ${exitCode}; intents dir absent: ${!existsSync(intentsRoot)}`,
  );
}

// P3c — the ban's COMPLEMENT, so a future narrowing cannot silently swallow the
// legal case: FR-4 makes a ratified milestone and a scored tier mutually
// exclusive, so `unscored` is the only legal tier on a milestone-bound mint. A
// ban reaching this shape would make such records unmintable.
{
  const workspace = gitInitWorkspace("p3c");
  const { exitCode, stdout } = runPromote(workspace, [
    "--task-id",
    "0000p3ca-0000-0000-0000-00000000003c",
    "--label",
    "milestone bound",
    "--scope",
    "rin-gates",
    "--importance",
    "lane-flagged:M1:unscored",
    "--dry-run",
  ]);
  record(
    "P3c promote ADMITS an unscored tier when the mint is milestone-bound",
    exitCode === 0 && stdout.startsWith("PLAN"),
    `exit ${exitCode}; stdout starts PLAN: ${stdout.startsWith("PLAN")}`,
  );
}

// P7 — --dry-run ALSO refuses a missing --importance, so the requirement is not
// discoverable only at real-mint time. parseRequest runs in run() strictly
// before promote(), and the dry-run branch lives inside promote() — so this is
// discharged by construction rather than by a second check.
{
  const workspace = gitInitWorkspace("p7");
  const { exitCode, stderr } = runPromote(workspace, [
    "--task-id",
    "0000p7aa-0000-0000-0000-000000000007",
    "--label",
    "dry run no importance",
    "--scope",
    "rin-gates",
    "--dry-run",
  ]);
  const intentsRoot = join(workspace, "aidlc", "spaces", "default", "intents");
  record(
    "P7 promote --dry-run refuses a missing --importance and creates nothing (exit 1)",
    exitCode === 1 &&
      stderr.includes("--importance is required") &&
      !existsSync(intentsRoot),
    `exit ${exitCode}; ${stderr.trim().slice(0, 60)}`,
  );
}

// P4 — promote refuses without the required flags (--task-id / --label).
{
  const workspace = gitInitWorkspace("p4");
  const { exitCode, stderr } = runPromote(workspace, ["--label", "no task id"]);
  record(
    "P4 promote refuses a missing --task-id (exit 1)",
    exitCode === 1 && stderr.includes("--task-id is required"),
    `exit ${exitCode}; ${stderr.trim().slice(0, 60)}`,
  );
}

// P5 — promote refuses a missing --scope rather than silently defaulting it.
// The scope IS Gate 0's classification decision (it selects the stage set the
// intent walks), so an omitted scope is an unmade decision, not a safe default.
{
  const workspace = gitInitWorkspace("p5");
  const { exitCode, stderr } = runPromote(workspace, [
    "--task-id",
    "0000p5aa-0000-0000-0000-000000000005",
    "--label",
    "no scope",
  ]);
  const intentsRoot = join(workspace, "aidlc", "spaces", "default", "intents");
  record(
    "P5 promote refuses a missing --scope and creates nothing (exit 1)",
    exitCode === 1 &&
      stderr.includes("--scope is required") &&
      !existsSync(intentsRoot),
    `exit ${exitCode}; ${stderr.trim().slice(0, 60)}`,
  );
}

// P6 — --json emits the machine-readable run-report row a scheduled lane needs
// to assemble its queue-in/processed/queue-out digest without re-parsing prose,
// including the still-outstanding DB close.
{
  const workspace = gitInitWorkspace("p6");
  const taskId = "0000p6aa-0000-0000-0000-000000000006";
  const { exitCode, stdout } = runPromote(workspace, [
    "--task-id",
    taskId,
    "--label",
    "json report",
    "--scope",
    "rin-gates",
    "--importance",
    "not-flagged:no-milestone:T3",
    "--json",
  ]);
  const parsed: unknown = (() => {
    try {
      return JSON.parse(stdout);
    } catch {
      return null;
    }
  })();
  const report =
    typeof parsed === "object" && parsed !== null
      ? (parsed as Record<string, unknown>)
      : {};
  record(
    "P6 promote --json emits a structured report row with the outstanding close",
    exitCode === 0 &&
      report.disposition === "promoted" &&
      report.taskId === taskId &&
      report.closeOutstanding === true &&
      typeof report.archiveReason === "string",
    `disposition=${String(report.disposition)} closeOutstanding=${String(report.closeOutstanding)}`,
  );
}

// P9 / P10 — FR-4's day-one control. The comparison surface is the ORDERED
// dirName SEQUENCE extracted from the emitted JSON, never the whole file (IF-8
// changes the JSON's shape) and never the rendered markdown (which cannot be
// byte-identical by construction).
//
// P9 and P10 assert the new ordering does NOTHING on these fixtures, and that
// is the DESIGN, not a broken feature: with no record operator-flagged, an empty
// ratified milestone list and nothing breaching the age alarm, every rung above
// dirName defers and control falls through to today's behaviour.
{
  const dirNameSequenceFor = (workspace: string): readonly string[] => {
    const { exitCode } = runTool(STATUS_TOOL, [], workspace, {
      RIN_GATES_SELECTION_CONFIG: pinnedSelectionConfig(workspace),
      RIN_GATES_NOW: new Date(RUN_INSTANT_MS).toISOString(),
    });
    if (exitCode !== 0) return [];
    const statusJson = JSON.parse(
      readFileSync(join(workspace, "aidlc", "rin-gates-status.json"), "utf-8"),
    );
    return statusJson.records.map(
      (entry: { dirName: string }) => entry.dirName,
    );
  };

  const writeBinding = (recordDir: string, flagged: string): void => {
    writeFileSync(
      join(recordDir, "importance-binding.json"),
      `${JSON.stringify({
        flagged,
        milestone: { kind: "no-milestone" },
        boundAt: "2026-08-16T00:00:00.000Z",
        boundBy: "gate-0-reconcile",
      })}\n`,
      "utf-8",
    );
  };

  // Pin the config the tool reads, so these cases assert ordering rather than
  // whatever the developer's shipped selection-ranking.json happens to say.
  // Without this seam, ratifying a milestone or tuning the threshold turns a
  // green case red with no code change (CD-47).
  const pinnedSelectionConfig = (workspace: string): string => {
    const path = join(workspace, "selection-ranking.json");
    writeFileSync(
      path,
      `${JSON.stringify({
        ratifiedMilestones: [],
        neglectThresholdDays: 30,
      })}\n`,
      "utf-8",
    );
    return path;
  };

  // Deliberately NOT in lexicographic creation order, so a sequence that
  // happened to match creation order would not pass by accident.
  //
  // Each fixture carries a DISTINCT clock, and they span both live clock
  // sources. This is load-bearing: with one hardcoded promotion date shared by
  // every record, neglectDays is uniform and rung 5 defers BY CONSTRUCTION —
  // so a control asserting "the ordering is unchanged" could not fail whatever
  // rung 5 did, and would be evidence of nothing. Here rung 5 is genuinely
  // able to decide, and the assertion is that it resolves to the same sequence
  // dirName does because the clocks were chosen to agree with dirName order.
  // Fixture clocks are expressed as ages RELATIVE to the run instant, never as
  // absolute dates. An absolute date encodes when the test was written rather
  // than a fact about the comparator: every fixture drifts one day further from
  // `now` each day, so a rung the case never meant to exercise eventually
  // activates and turns it red with no code change. That is the same hazard
  // `pinnedSelectionConfig` above pins the threshold against, arriving through
  // the other side of the identical comparison (CD-17, CD-47). Measured
  // 2026-08-31: `260801-alpha` reached exactly 30 days, entered neglect BREACH,
  // and outranked P11's operator-flagged record — correctly, per the ratified
  // rungs — blocking every push repo-wide.
  //
  // Every age stays UNDER `neglectThresholdDays` so no fixture breaches and the
  // rung under test is the only one able to decide. The spacing preserves the
  // ordering the cases assert.
  const HOURS_PER_DAY = 24;
  const MINUTES_PER_HOUR = 60;
  const SECONDS_PER_MINUTE = 60;
  const MILLISECONDS_PER_SECOND = 1_000;
  const MILLISECONDS_PER_DAY =
    HOURS_PER_DAY *
    MINUTES_PER_HOUR *
    SECONDS_PER_MINUTE *
    MILLISECONDS_PER_SECOND;

  const daysBeforeRunInstant = (days: number): string =>
    new Date(RUN_INSTANT_MS - days * MILLISECONDS_PER_DAY).toISOString();

  const FIXTURE_AGE_DAYS = {
    alpha: 23,
    bravo: 19,
    mike: 14,
    november: 12,
    zulu: 9,
    zuluStaleOverride: 27,
  } as const;

  const FIXTURE_CLOCKS: readonly {
    readonly dirName: string;
    readonly advanceAt: string | null;
    readonly promotedAt: string;
  }[] = [
    // dirName order:      alpha < bravo < mike < november < zulu
    // neglect (desc):     alpha > bravo > mike > november > zulu
    {
      dirName: "260810-mike",
      advanceAt: daysBeforeRunInstant(FIXTURE_AGE_DAYS.mike),
      promotedAt: daysBeforeRunInstant(FIXTURE_AGE_DAYS.mike),
    },
    {
      dirName: "260801-alpha",
      advanceAt: null,
      promotedAt: daysBeforeRunInstant(FIXTURE_AGE_DAYS.alpha),
    },
    {
      dirName: "260815-zulu",
      advanceAt: daysBeforeRunInstant(FIXTURE_AGE_DAYS.zulu),
      promotedAt: daysBeforeRunInstant(FIXTURE_AGE_DAYS.zulu),
    },
    {
      dirName: "260805-bravo",
      advanceAt: null,
      promotedAt: daysBeforeRunInstant(FIXTURE_AGE_DAYS.bravo),
    },
    {
      dirName: "260812-november",
      advanceAt: daysBeforeRunInstant(FIXTURE_AGE_DAYS.november),
      promotedAt: daysBeforeRunInstant(FIXTURE_AGE_DAYS.november),
    },
  ];

  const FIXTURE_DIRS: readonly string[] = FIXTURE_CLOCKS.map(
    (entry) => entry.dirName,
  );

  // Seeds the fixture pool, optionally binding a record. `flagOf` returns null
  // for records that should carry no binding at all, which is what makes the
  // mixed-coverage regime (P10) expressible.
  const seedPool = (args: {
    readonly workspace: string;
    readonly flagOf: (dirName: string) => string | null;
  }): void => {
    FIXTURE_CLOCKS.map((entry) => {
      const recordDir = writeEngineRecord(
        args.workspace,
        entry.dirName,
        "rin-gate-2-plan-review",
      );
      writeProvenance(recordDir, `capture-${entry.dirName}`, entry.promotedAt);
      if (entry.advanceAt !== null) {
        writeAdvanceShard({
          recordDir,
          at: entry.advanceAt,
          stage: "rin-gate-2-plan-review",
        });
      }
      const flag = args.flagOf(entry.dirName);
      return flag === null ? null : writeBinding(recordDir, flag);
    });
  };

  const p9Workspace = fixtureWorkspace("p9");
  seedPool({ workspace: p9Workspace, flagOf: () => null });
  const p9Sequence = dirNameSequenceFor(p9Workspace);
  const expectedSequence = [...FIXTURE_DIRS].sort((left, right) =>
    left.localeCompare(right),
  );
  record(
    "P9 day-one control: the emitted dirName sequence equals today's ordering over the same fixture set",
    p9Sequence.length === FIXTURE_DIRS.length &&
      JSON.stringify(p9Sequence) === JSON.stringify(expectedSequence),
    `emitted=${p9Sequence.join(",")} expected=${expectedSequence.join(",")}`,
  );

  // P10 — the STEADY-STATE regime the mint rate puts the system into within
  // weeks: mixed coverage where every bound record is not-flagged. The sequence
  // must STILL equal today's ordering.
  const p10Workspace = fixtureWorkspace("p10");
  const boundDirs = ["260810-mike", "260805-bravo"];
  seedPool({
    workspace: p10Workspace,
    flagOf: (dirName) => (boundDirs.includes(dirName) ? "not-flagged" : null),
  });
  const p10Sequence = dirNameSequenceFor(p10Workspace);
  const p10Json = JSON.parse(
    readFileSync(join(p10Workspace, "aidlc", "rin-gates-status.json"), "utf-8"),
  );
  const countCoverage = (coverage: string): number =>
    p10Json.records.filter(
      (entry: { bindingCoverage: string }) =>
        entry.bindingCoverage === coverage,
    ).length;
  const coverageCounts = {
    bound: countCoverage("bound"),
    unbound: countCoverage("unbound"),
  };
  record(
    "P10 steady-state control: mixed coverage, all bound records not-flagged — sequence still equals today's ordering, and coverage is REPORTED not gated",
    JSON.stringify(p10Sequence) === JSON.stringify(expectedSequence) &&
      coverageCounts.bound === boundDirs.length &&
      coverageCounts.unbound === FIXTURE_DIRS.length - boundDirs.length,
    `emitted=${p10Sequence.join(",")} coverage=${JSON.stringify(coverageCounts)}`,
  );

  // P11 — the mechanism is NOT inert once the operator flags a record: the flagged
  // record moves to the front and every other record's relative order is
  // unchanged. Without this, P9/P10 alone are equally consistent with a
  // comparator that is wired to nothing.
  const p11Workspace = fixtureWorkspace("p11");
  const flaggedDir = "260815-zulu";
  seedPool({
    workspace: p11Workspace,
    flagOf: (dirName) =>
      dirName === flaggedDir ? "operator-flagged" : "not-flagged",
  });
  const p11Sequence = dirNameSequenceFor(p11Workspace);
  const othersInOrder = p11Sequence.filter((dirName) => dirName !== flaggedDir);
  const expectedOthers = expectedSequence.filter(
    (dirName) => dirName !== flaggedDir,
  );
  record(
    "P11 a operator-flagged record moves to the front and leaves every other record's relative order unchanged",
    p11Sequence[0] === flaggedDir &&
      JSON.stringify(othersInOrder) === JSON.stringify(expectedOthers),
    `emitted=${p11Sequence.join(",")}`,
  );

  // P12 — the anti-tautology control for P9/P10.
  //
  // P9 and P10 assert the emitted sequence EQUALS dirName order. That is only
  // evidence if rung 5 was capable of disagreeing — with a uniform clock across
  // every fixture it defers by construction and the assertion cannot fail
  // whatever the comparator does. Here ONE record's clock is moved so that
  // neglect-descending and dirName-ascending genuinely CONFLICT, and the run
  // must follow neglect. If this case ever passes with the same sequence as P9,
  // rung 5 is not wired and P9/P10 are worthless.
  const p12Workspace = fixtureWorkspace("p12");
  const staleDir = "260815-zulu";
  FIXTURE_CLOCKS.map((entry) => {
    const recordDir = writeEngineRecord(
      p12Workspace,
      entry.dirName,
      "rin-gate-2-plan-review",
    );
    // zulu sorts LAST by dirName but is given the OLDEST clock, so rung 5 must
    // lift it to the front — the opposite of what dirName order would produce.
    return writeProvenance(
      recordDir,
      `capture-${entry.dirName}`,
      entry.dirName === staleDir
        ? daysBeforeRunInstant(FIXTURE_AGE_DAYS.zuluStaleOverride)
        : entry.promotedAt,
    );
  });
  const p12Sequence = dirNameSequenceFor(p12Workspace);
  record(
    "P12 anti-tautology: when neglect and dirName DISAGREE the run follows neglect — proving P9/P10's equality is a result, not a structural inevitability",
    p12Sequence[0] === staleDir &&
      JSON.stringify(p12Sequence) !== JSON.stringify(expectedSequence),
    `emitted=${p12Sequence.join(",")} (dirName order would be ${expectedSequence.join(",")})`,
  );
}

// ---------------------------------------------------------------------------
// IF-1 — the rin-gates autonomy backstop hook (Seam B). HERMETIC BY
// CONSTRUCTION, in two tiers.
//
// TIER 1 (the original, and still the majority): the fixture spawns NO real git.
// The hook reads HEAD via the RIN_GATES_HEAD_SHA env seam, which the fixture
// injects — no repo, no spawn. The fixture workspace holds an active-intent
// cursor, a bound record dir, an aidlc-state.md (Scope), and optionally a
// review-verdict.json; the hook is spawned with CLAUDE_PROJECT_DIR set to the
// fixture + a SCRUBBED env (every GIT_* var stripped, GIT_CONFIG_NOSYSTEM added)
// so no inherited git context can ever reach a spawned binary.
//
// TIER 2 (added with the two-mode verdict binding, Slice
// 260816-verdict-landed-binding): cases whose subject IS a git fact — merge-commit
// ancestry, a patch digest, a changed-path set — spawn real git, but ONLY through
// `createHermeticGitRepository`. That helper mints its own repository under the
// system temp dir with its own HOME and GIT_CONFIG_GLOBAL, strips the eleven
// checkout-binding GIT_* variables, and disposes the enclosure on every path. Its
// environment IS the hermetic-git guard's own sentinel.
//
// This REVERSES the file's earlier "no case anywhere spawns real git" invariant,
// deliberately and with its provenance retained: that invariant was written after
// a `gitInit` fixture inherited the pre-push hook's GIT_DIR and re-initialised the
// SHARED repository, flipping core.bare=true. The rule
// is that a test must never touch real processes or system state —
// and it still binds in full. What changed is that "no SAFE real git" was true
// when the invariant was written and is no longer: `createHermeticGitRepository`
// is precisely the fix for 019f5ac8 and did not exist then. A tier-2 case touches
// only a repository it minted and disposes; it never borrows the machine's.
//
// Tier-2 invariants, each a lock rather than a convention, because each failure
// yields a PASSING case that proves nothing:
//   - RIN_GATES_WORKSPACE_ROOT is set on every emitter spawn (the emitter
//     otherwise resolves its checkout by walking up from its own file location,
//     which always lands on the REAL repo while the case still passes);
//   - RIN_GATES_DIFF_DIGEST and RIN_GATES_HEAD_SHA are REMOVED from every child
//     env, so a fixture cannot green through either seam;
//   - RIN_GATES_TEST_MODE is UNSET, so every read goes through the production
//     code path against real git;
//   - the environment is the minted repository's, never the local scrubber's.
const FIXTURE_HEAD_SHA = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2";

const scrubbedGitEnv = (): Record<string, string> => ({
  ...Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] =>
        entry[1] !== undefined && !entry[0].startsWith("GIT_"),
    ),
  ),
  RIN_GATES_ENGINE_CLI: join(PUBLIC_ENGINE_TOOLS, "aidlc-utility.ts"),
  AIDLC_STAGE_GRAPH: join(PUBLIC_ENGINE_TOOLS, "data", "stage-graph.json"),
  GIT_CONFIG_NOSYSTEM: "1",
});

const GATE_5_STAGE = "rin-gate-5-review-cycle";
const INIT_STAGES = ["workspace-scaffold", "workspace-detection", "state-init"];
const GATE_STAGES = [
  "rin-gate-0-reconcile",
  "rin-gate-1-framing",
  "rin-gate-2-plan-review",
  "rin-gate-3-interface-lock",
  "rin-gate-4-implement",
  GATE_5_STAGE,
  "rin-gate-6-operate",
];

const r7SensorGraphSchema = z.array(
  z.object({
    slug: z.string(),
    sensors_applicable: z.array(z.object({ id: z.string() })),
  }),
);

const r7SensorGraph = r7SensorGraphSchema.safeParse(
  loadStageGraphNodes(join(PUBLIC_ENGINE_TOOLS, "data", "stage-graph.json")),
);
record(
  "R7/IF-7 composed graph has readable stage and sensor rows",
  r7SensorGraph.success,
  r7SensorGraph.success ? "compiled graph parsed" : "compiled graph missing or malformed",
);
if (r7SensorGraph.success) {
  const rinGateStages = r7SensorGraph.data.filter((stage) =>
    stage.slug.startsWith("rin-gate-"),
  );
  record(
    "R7/IF-7 compiled graph carries every Rin gate",
    rinGateStages.length === GATE_STAGES.length &&
      GATE_STAGES.every((slug) => rinGateStages.some((stage) => stage.slug === slug)),
    `compiled gates=${rinGateStages.map((stage) => stage.slug).join(",")}`,
  );
  [
    { sensorId: "dd-7", expectedCount: GATE_STAGES.length },
    { sensorId: "dd-99", expectedCount: 0 },
    { sensorId: "dd-1", expectedCount: GATE_STAGES.length },
    { sensorId: "dd-2", expectedCount: GATE_STAGES.length },
  ].forEach(({ sensorId, expectedCount }) => {
    const observedCount = rinGateStages.filter((stage) =>
      stage.sensors_applicable.some((sensor) => sensor.id === sensorId),
    ).length;
    record(
      `R7/IF-7 ${sensorId} resolves on ${expectedCount} compiled Rin gates`,
      observedCount === expectedCount,
      `observed=${observedCount} expected=${expectedCount}`,
    );
  });
}

const gridRowOf = (
  executeStages: readonly string[],
): { stages: Record<string, string> } => ({
  stages: Object.fromEntries([
    ...INIT_STAGES.map((stage) => [stage, "EXECUTE"]),
    ...GATE_STAGES.map((stage) => [
      stage,
      executeStages.includes(stage) ? "EXECUTE" : "SKIP",
    ]),
  ]),
});

const COVERED_GRID_ROW = gridRowOf([GATE_5_STAGE]);

const autonomyFixture = (
  name: string,
  opts: {
    scope: string;
    taskId: string;
    gate: string;
    verdict?: Record<string, unknown>;
    grid?: Record<string, unknown>;
  },
): { root: string; head: string } => {
  const root = join(SANDBOX, name);
  const intents = join(root, "aidlc", "spaces", "default", "intents");
  const gridForFixture =
    opts.grid === undefined && opts.scope !== "feature" && opts.scope !== "poc"
      ? { [opts.scope]: COVERED_GRID_ROW }
      : opts.grid;
  if (gridForFixture !== undefined) {
    const gridDir = join(root, ".claude", "tools", "data");
    mkdirSync(gridDir, { recursive: true });
    writeFileSync(
      join(gridDir, "scope-grid.json"),
      `${JSON.stringify(gridForFixture, null, 2)}\n`,
      "utf-8",
    );
  }
  const recordDirName = "260713-fixture-intent";
  const recordDir = join(intents, recordDirName);
  mkdirSync(join(recordDir, "inception", opts.gate), { recursive: true });
  writeFileSync(join(intents, "active-intent"), `${recordDirName}\n`, "utf-8");
  writeFileSync(
    join(recordDir, "aidlc-state.md"),
    `# AI-DLC State Tracking\n\n- **Scope**: ${opts.scope}\n- **Current Stage**: ${opts.gate}\n`,
    "utf-8",
  );
  // Under repo-SoR the record dir IS the identity; the autonomy gate no longer
  // reads a slice-binding.json, so the fixture writes none. opts.taskId is kept
  // only to seed the verdict fixtures' taskId field (now the record-name key).
  if (opts.verdict) {
    writeFileSync(
      join(recordDir, "inception", opts.gate, "review-verdict.json"),
      `${JSON.stringify(opts.verdict)}\n`,
      "utf-8",
    );
  }
  return { root, head: FIXTURE_HEAD_SHA };
};

const runAutonomyHook = (
  root: string,
  command: string,
  headSha: string = FIXTURE_HEAD_SHA,
): { status: number; stderr: string } => {
  const out = spawnSync("bun", [AUTONOMY_HOOK], {
    cwd: root,
    input: JSON.stringify({ tool_name: "Bash", tool_input: { command } }),
    encoding: "utf-8",
    env: {
      ...scrubbedGitEnv(),
      CLAUDE_PROJECT_DIR: root,
      RIN_GATES_SPACE: "default",
      RIN_GATES_TEST_MODE: "1",
      RIN_GATES_HEAD_SHA: headSha,
    },
  });
  return { status: out.status ?? -1, stderr: out.stderr ?? "" };
};

// The roster floor applies to EVERY accepted emitter, not just the scribe
// (IF-2), so a fixture asserting some OTHER property — ancestry, landed-binding
// digests, lean-family coverage — must still carry a covering roster or it is
// refused at the floor before reaching the property under test. These lenses are
// `rin-gate-2-plan-review`'s real floor, resolved from review-rosters.json.
//
// The placeholder this replaces (`["challenger"]`) passed only because the check
// was fenced to the scribe emitter. 17 cases went red the moment the fence came
// down — each reporting `misses roster lenses`, which is the floor working, not
// the fixtures' subject failing. `extra` still overrides, so A9's empty-lenses
// case is untouched.
const GATE_2_FLOOR: readonly string[] = [
  "aidlc-architecture-reviewer-agent",
  "rin-clean-architecture-reviewer-agent",
  "rin-ddd-modelling-reviewer-agent",
  "rin-decomposition-reviewer-agent",
  "rin-intent-defense-reviewer-agent",
];

const readyVerdict = (
  taskId: string,
  headSha: string,
  extra: Record<string, unknown> = {},
): string =>
  `${JSON.stringify({ gate: "rin-gate-2-plan-review", taskId, headSha, verdict: "READY", reviewedAt: "2026-07-13T00:00:00.000Z", lenses: GATE_2_FLOOR, emittedBy: "rin-gates-review-verdict", ...extra })}\n`;

const verdictFilePath = (root: string): string =>
  join(
    root,
    "aidlc",
    "spaces",
    "default",
    "intents",
    "260713-fixture-intent",
    "inception",
    "rin-gate-2-plan-review",
    "review-verdict.json",
  );

const REPORT_CMD =
  "bun .claude/tools/aidlc-orchestrate.ts report --stage rin-gate-2-plan-review --result approved";

// A1 — non-rin-gates scope passes through (exit 0), hook not this scope's concern.
{
  const { root } = autonomyFixture("a1", {
    scope: "feature",
    taskId: "slice-a1",
    gate: "rin-gate-2-plan-review",
  });
  const { status } = runAutonomyHook(root, REPORT_CMD);
  record(
    "A1 autonomy hook passes a non-rin-gates scope (exit 0)",
    status === 0,
    `exit ${status}`,
  );
}

// A2 — rin-gates, fresh emitter-stamped READY verdict → allow (exit 0).
{
  const fx = autonomyFixture("a2", {
    scope: "rin-gates",
    taskId: "slice-a2",
    gate: "rin-gate-2-plan-review",
  });
  writeFileSync(
    verdictFilePath(fx.root),
    readyVerdict("slice-a2", fx.head),
    "utf-8",
  );
  const { status } = runAutonomyHook(fx.root, REPORT_CMD);
  record(
    "A2 autonomy hook allows a rin-gates approve with a fresh emitter-stamped READY verdict (exit 0)",
    status === 0,
    `exit ${status}`,
  );
}

// A3 — rin-gates, NO verdict → deny (exit 2).
{
  const fx = autonomyFixture("a3", {
    scope: "rin-gates",
    taskId: "slice-a3",
    gate: "rin-gate-2-plan-review",
  });
  const { status, stderr } = runAutonomyHook(fx.root, REPORT_CMD);
  record(
    "A3 autonomy hook denies a rin-gates approve with no review verdict (exit 2)",
    status === 2 && stderr.includes("no decorrelated-review verdict"),
    `exit ${status}`,
  );
}

// A4 — rin-gates, STALE headSha → deny (exit 2).
{
  const fx = autonomyFixture("a4", {
    scope: "rin-gates",
    taskId: "slice-a4",
    gate: "rin-gate-2-plan-review",
  });
  writeFileSync(
    verdictFilePath(fx.root),
    readyVerdict("slice-a4", "0000000000000000000000000000000000000000"),
    "utf-8",
  );
  const { status, stderr } = runAutonomyHook(fx.root, REPORT_CMD);
  record(
    "A4 autonomy hook denies a stale-headSha verdict (exit 2)",
    status === 2 && stderr.includes("stale"),
    `exit ${status}`,
  );
}

// A5 — rin-gates, NOT-READY verdict → deny (exit 2).
{
  const fx = autonomyFixture("a5", {
    scope: "rin-gates",
    taskId: "slice-a5",
    gate: "rin-gate-2-plan-review",
  });
  writeFileSync(
    verdictFilePath(fx.root),
    readyVerdict("slice-a5", fx.head, { verdict: "NOT-READY" }),
    "utf-8",
  );
  const { status, stderr } = runAutonomyHook(fx.root, REPORT_CMD);
  record(
    "A5 autonomy hook denies a NOT-READY verdict (exit 2)",
    status === 2 && stderr.includes("not READY"),
    `exit ${status}`,
  );
}

// A8 — B1: a HAND-WRITTEN verdict (no emittedBy stamp) → deny (exit 2). This is
// the self-certification hole the Gate-5 review found: a lane fabricating its own
// READY verdict must not pass.
{
  const fx = autonomyFixture("a8", {
    scope: "rin-gates",
    taskId: "slice-a8",
    gate: "rin-gate-2-plan-review",
  });
  writeFileSync(
    verdictFilePath(fx.root),
    readyVerdict("slice-a8", fx.head, { emittedBy: undefined }),
    "utf-8",
  );
  const { status, stderr } = runAutonomyHook(fx.root, REPORT_CMD);
  record(
    "A8 autonomy hook denies a hand-written verdict lacking the emitter stamp (exit 2)",
    status === 2 && stderr.includes("not emitted by"),
    `exit ${status}`,
  );
}

// A9 — M2: an emitter-stamped verdict with EMPTY lenses → deny (exit 2).
{
  const fx = autonomyFixture("a9", {
    scope: "rin-gates",
    taskId: "slice-a9",
    gate: "rin-gate-2-plan-review",
  });
  writeFileSync(
    verdictFilePath(fx.root),
    readyVerdict("slice-a9", fx.head, { lenses: [] }),
    "utf-8",
  );
  const { status, stderr } = runAutonomyHook(fx.root, REPORT_CMD);
  record(
    "A9 autonomy hook denies a verdict naming no lenses (exit 2)",
    status === 2 && stderr.includes("no lenses"),
    `exit ${status}`,
  );
}

// A10 — H1 fail-closed: rin-gates report with an INDETERMINATE scope (no
// active-intent cursor) → deny (exit 2), not fail-open.
{
  const root = join(SANDBOX, "a10");
  mkdirSync(join(root, "aidlc", "spaces", "default", "intents"), {
    recursive: true,
  });
  const { status, stderr } = runAutonomyHook(root, REPORT_CMD);
  record(
    "A10 autonomy hook fails CLOSED on an indeterminate scope (exit 2)",
    status === 2 && stderr.includes("cannot resolve the active intent"),
    `exit ${status}`,
  );
}

// A11 — M1: the env bypass override passes even with no verdict, and traces loudly.
{
  const fx = autonomyFixture("a11", {
    scope: "rin-gates",
    taskId: "slice-a11",
    gate: "rin-gate-2-plan-review",
  });
  const out = spawnSync("bun", [AUTONOMY_HOOK], {
    cwd: fx.root,
    input: JSON.stringify({
      tool_name: "Bash",
      tool_input: { command: REPORT_CMD },
    }),
    encoding: "utf-8",
    env: {
      ...scrubbedGitEnv(),
      CLAUDE_PROJECT_DIR: fx.root,
      RIN_GATES_SPACE: "default",
      AIDLC_RIN_GATES_AUTONOMY_BYPASS: "1",
    },
  });
  record(
    "A11 autonomy hook honours the env bypass and traces it (exit 0)",
    (out.status ?? -1) === 0 && (out.stderr ?? "").includes("BYPASS honoured"),
    `exit ${out.status}`,
  );
}

// A6 — M1: the bypass TOKEN AS A COMMAND SUBSTRING no longer bypasses (the old
// substring match was the M1 hole); with no verdict it must DENY. The real
// bypass is the env var (A11).
{
  const fx = autonomyFixture("a6", {
    scope: "rin-gates",
    taskId: "slice-a6",
    gate: "rin-gate-2-plan-review",
  });
  const { status } = runAutonomyHook(
    fx.root,
    `${REPORT_CMD} # AIDLC_RIN_GATES_AUTONOMY_BYPASS=1`,
  );
  record(
    "A6 autonomy hook does NOT bypass on a command-substring token (exit 2)",
    status === 2,
    `exit ${status}`,
  );
}

// A7 — a non-report Bash command is ignored (exit 0), not this hook's concern.
{
  const fx = autonomyFixture("a7", {
    scope: "rin-gates",
    taskId: "slice-a7",
    gate: "rin-gate-2-plan-review",
  });
  const { status } = runAutonomyHook(fx.root, "ls -la");
  record(
    "A7 autonomy hook ignores a non-report command (exit 0)",
    status === 0,
    `exit ${status}`,
  );
}

// A12 — invoking-checkout resolution. The record dir lives in the WORKTREE named
// by the hook's stdin `cwd`; CLAUDE_PROJECT_DIR points at a primary that does NOT
// carry the (unmerged) record. The hook must resolve the intent from the invoking
// cwd — the checkout being operated on — and find it, not fail closed on the
// primary. Regression guard for the primary-anchored resolution bug (a lane runs
// `report` in its worktree, where the cursor + record live).
{
  const fx = autonomyFixture("a12-worktree", {
    scope: "rin-gates",
    taskId: "slice-a12",
    gate: "rin-gate-2-plan-review",
  });
  writeFileSync(
    verdictFilePath(fx.root),
    readyVerdict("slice-a12", fx.head),
    "utf-8",
  );
  mkdirSync(join(fx.root, ".git"), { recursive: true }); // mark the worktree root so the cwd walk-up stops here
  const primaryWithoutRecord = join(SANDBOX, "a12-primary");
  mkdirSync(primaryWithoutRecord, { recursive: true });
  const out = spawnSync("bun", [AUTONOMY_HOOK], {
    cwd: primaryWithoutRecord,
    input: JSON.stringify({
      tool_name: "Bash",
      tool_input: { command: REPORT_CMD },
      cwd: fx.root,
    }),
    encoding: "utf-8",
    env: {
      ...scrubbedGitEnv(),
      CLAUDE_PROJECT_DIR: primaryWithoutRecord,
      RIN_GATES_SPACE: "default",
      RIN_GATES_TEST_MODE: "1",
      RIN_GATES_HEAD_SHA: fx.head,
    },
  });
  record(
    "A12 autonomy hook resolves the intent from the invoking-checkout cwd (worktree), not CLAUDE_PROJECT_DIR (primary without the record) → allows with a valid verdict (exit 0)",
    (out.status ?? -1) === 0,
    `exit ${out.status} :: ${(out.stderr ?? "").trim()}`,
  );
}

// V1 — the verdict guard DENIES a hand Write to review-verdict.json (exit 2).
{
  const out = spawnSync("bun", [VERDICT_GUARD], {
    input: JSON.stringify({
      tool_name: "Write",
      tool_input: {
        file_path:
          "aidlc/spaces/default/intents/x/inception/rin-gate-2-plan-review/review-verdict.json",
        content: "{}",
      },
    }),
    encoding: "utf-8",
    env: scrubbedGitEnv(),
  });
  record(
    "V1 verdict guard denies a hand Write to review-verdict.json (exit 2)",
    (out.status ?? -1) === 2 &&
      (out.stderr ?? "").includes("tool-writable-only"),
    `exit ${out.status}`,
  );
}

// V2 — the verdict guard ALLOWS a write to an unrelated file (exit 0).
{
  const out = spawnSync("bun", [VERDICT_GUARD], {
    input: JSON.stringify({
      tool_name: "Write",
      tool_input: {
        file_path:
          "aidlc/spaces/default/intents/x/inception/rin-gate-2-plan-review/requirements.md",
        content: "x",
      },
    }),
    encoding: "utf-8",
    env: scrubbedGitEnv(),
  });
  record(
    "V2 verdict guard allows an unrelated write (exit 0)",
    (out.status ?? -1) === 0,
    `exit ${out.status}`,
  );
}

// V3 — the emitter REFUSES without the RIN_GATES_VERDICT_EMITTER token (exit 1).
{
  const root = join(SANDBOX, "v3");
  mkdirSync(
    join(
      root,
      "aidlc",
      "spaces",
      "default",
      "intents",
      "260713-fixture-intent",
      "inception",
      "rin-gate-2-plan-review",
    ),
    { recursive: true },
  );
  const out = spawnSync(
    "bun",
    [
      VERDICT_EMITTER,
      "--record-dir",
      "260713-fixture-intent",
      "--gate",
      "rin-gate-2-plan-review",
      "--task-id",
      "slice-v3",
      "--verdict",
      "READY",
      "--lenses",
      "challenger",
    ],
    {
      encoding: "utf-8",
      env: {
        ...scrubbedGitEnv(),
        RIN_GATES_WORKSPACE_ROOT: root,
        RIN_GATES_TEST_MODE: "1",
        RIN_GATES_HEAD_SHA: "deadbeef",
        RIN_GATES_DIFF_DIGEST: "abc123",
      },
    },
  );
  record(
    "V3 emitter refuses without the RIN_GATES_VERDICT_EMITTER token (exit 1)",
    (out.status ?? -1) === 1 &&
      (out.stderr ?? "").includes("RIN_GATES_VERDICT_EMITTER=1"),
    `exit ${out.status}`,
  );
}

// V4 — the emitter WRITES a stamped, content-bound verdict with the token (exit 0),
// and it carries emittedBy + diffDigest + non-empty lenses.
{
  const root = join(SANDBOX, "v4");
  const gateDir = join(
    root,
    "aidlc",
    "spaces",
    "default",
    "intents",
    "260713-fixture-intent",
    "inception",
    "rin-gate-2-plan-review",
  );
  mkdirSync(gateDir, { recursive: true });
  const out = spawnSync(
    "bun",
    [
      VERDICT_EMITTER,
      "--record-dir",
      "260713-fixture-intent",
      "--gate",
      "rin-gate-2-plan-review",
      "--task-id",
      "slice-v4",
      "--verdict",
      "READY",
      "--lenses",
      "challenger,validator",
    ],
    {
      encoding: "utf-8",
      env: {
        ...scrubbedGitEnv(),
        RIN_GATES_VERDICT_EMITTER: "1",
        RIN_GATES_WORKSPACE_ROOT: root,
        RIN_GATES_TEST_MODE: "1",
        RIN_GATES_HEAD_SHA: "deadbeefcafe",
        RIN_GATES_DIFF_DIGEST: "digest123",
      },
    },
  );
  const written = existsSync(join(gateDir, "review-verdict.json"))
    ? JSON.parse(readFileSync(join(gateDir, "review-verdict.json"), "utf-8"))
    : null;
  record(
    "V4 emitter writes a stamped content-bound verdict (exit 0)",
    (out.status ?? -1) === 0 &&
      written?.emittedBy === "rin-gates-review-verdict" &&
      written?.diffDigest === "digest123" &&
      written?.headSha === "deadbeefcafe" &&
      Array.isArray(written?.lenses) &&
      written.lenses.length === 2,
    written
      ? `emittedBy=${written.emittedBy} digest=${written.diffDigest}`
      : (out.stderr ?? "").trim(),
  );
}

// V5 — the verdict guard DENIES a Bash redirect into review-verdict.json (the
// command arm; Gate-5 re-review L3). Mirrors the receipt selftest's redirect case.
{
  const out = spawnSync("bun", [VERDICT_GUARD], {
    input: JSON.stringify({
      tool_name: "Bash",
      tool_input: {
        command:
          'echo "{}" > aidlc/spaces/default/intents/x/inception/rin-gate-2-plan-review/review-verdict.json',
      },
    }),
    encoding: "utf-8",
    env: scrubbedGitEnv(),
  });
  record(
    "V5 verdict guard denies a Bash redirect into review-verdict.json (exit 2)",
    (out.status ?? -1) === 2,
    `exit ${out.status}`,
  );
}

// V6 — the verdict guard DENIES a `mv` onto review-verdict.json (rename evasion).
{
  const out = spawnSync("bun", [VERDICT_GUARD], {
    input: JSON.stringify({
      tool_name: "Bash",
      tool_input: {
        command:
          "mv /tmp/x.json aidlc/spaces/default/intents/x/inception/rin-gate-2-plan-review/review-verdict.json",
      },
    }),
    encoding: "utf-8",
    env: scrubbedGitEnv(),
  });
  record(
    "V6 verdict guard denies a mv onto review-verdict.json (exit 2)",
    (out.status ?? -1) === 2,
    `exit ${out.status}`,
  );
}

// V7 — a Bash READ that merely names the path (no mutator) is allowed (exit 0).
{
  const out = spawnSync("bun", [VERDICT_GUARD], {
    input: JSON.stringify({
      tool_name: "Bash",
      tool_input: {
        command:
          "cat aidlc/spaces/default/intents/x/inception/rin-gate-2-plan-review/review-verdict.json",
      },
    }),
    encoding: "utf-8",
    env: scrubbedGitEnv(),
  });
  record(
    "V7 verdict guard allows a read that names the path (exit 0)",
    (out.status ?? -1) === 0,
    `exit ${out.status}`,
  );
}

// V8 — the verdict guard ALLOWS a pure `git rm` of a verdict: the guard prevents
// FABRICATION, and deletion fabricates nothing — after a delete the gate still
// demands a real emitted READY, so the lane is strictly worse off.
{
  const out = spawnSync("bun", [VERDICT_GUARD], {
    input: JSON.stringify({
      tool_name: "Bash",
      tool_input: {
        command:
          "git rm aidlc/spaces/default/intents/x/operation/gate-6-operate/review-verdict.json",
      },
    }),
    encoding: "utf-8",
    env: scrubbedGitEnv(),
  });
  record(
    "V8 verdict guard allows a pure git rm of a verdict (exit 0)",
    (out.status ?? -1) === 0,
    `exit ${out.status}`,
  );
}

// V9 — a bare `rm` of a verdict is likewise allowed (same reasoning as V8).
{
  const out = spawnSync("bun", [VERDICT_GUARD], {
    input: JSON.stringify({
      tool_name: "Bash",
      tool_input: {
        command:
          "rm -f aidlc/spaces/default/intents/x/operation/gate-6-operate/review-verdict.json",
      },
    }),
    encoding: "utf-8",
    env: scrubbedGitEnv(),
  });
  record(
    "V9 verdict guard allows a bare rm of a verdict (exit 0)",
    (out.status ?? -1) === 0,
    `exit ${out.status}`,
  );
}

// V10 — a delete that ALSO writes a verdict is still DENIED. This is the boundary
// of V8/V9: the allowance is for deletion, not for "a command containing rm".
{
  const out = spawnSync("bun", [VERDICT_GUARD], {
    input: JSON.stringify({
      tool_name: "Bash",
      tool_input: {
        command:
          'rm /tmp/scratch.txt && echo "{}" > aidlc/spaces/default/intents/x/operation/rin-gate-6-operate/review-verdict.json',
      },
    }),
    encoding: "utf-8",
    env: scrubbedGitEnv(),
  });
  record(
    "V10 verdict guard denies rm chained with a verdict write (exit 2)",
    (out.status ?? -1) === 2,
    `exit ${out.status}`,
  );
}

// V11 — `git mv` between two verdict paths stays DENIED: a rename WRITES a verdict
// at the destination, which is the V6 fabrication route regardless of the source.
{
  const out = spawnSync("bun", [VERDICT_GUARD], {
    input: JSON.stringify({
      tool_name: "Bash",
      tool_input: {
        command:
          "git mv aidlc/spaces/default/intents/x/operation/gate-6-operate/review-verdict.json aidlc/spaces/default/intents/x/operation/rin-gate-6-operate/review-verdict.json",
      },
    }),
    encoding: "utf-8",
    env: scrubbedGitEnv(),
  });
  record(
    "V11 verdict guard denies a git mv between verdict paths (exit 2)",
    (out.status ?? -1) === 2,
    `exit ${out.status}`,
  );
}

// V12..V17 — negative space for the V8/V9 deletion allowance (PR #384 review B1).
// The predicate is "EVERY operand is a verdict"; the first implementation only
// inspected dot-bearing tokens, so `rm <verdict> /etc` passed. These pin the
// boundary so a later widening cannot pass silently.
const VERDICT_OPERAND =
  "aidlc/spaces/default/intents/x/operation/gate-6-operate/review-verdict.json";

const guardExit = (command: string): number => {
  const out = spawnSync("bun", [VERDICT_GUARD], {
    input: JSON.stringify({ tool_name: "Bash", tool_input: { command } }),
    encoding: "utf-8",
    env: scrubbedGitEnv(),
  });
  return out.status ?? -1;
};

// V12 — a delete mixing a verdict with a NON-verdict operand is DENIED. The
// allowance is for removing verdicts, never for borrowing a verdict operand to
// launder an unrelated destructive delete.
{
  const status = guardExit(`rm -rf ${VERDICT_OPERAND} /etc`);
  record(
    "V12 verdict guard denies a delete mixing a verdict with a non-verdict operand (exit 2)",
    status === 2,
    `exit ${status}`,
  );
}

// V13 — the same, with a dotless relative operand (the exact B1 regex hole).
{
  const status = guardExit(`rm ${VERDICT_OPERAND} packages`);
  record(
    "V13 verdict guard denies a delete with a dotless non-verdict operand (exit 2)",
    status === 2,
    `exit ${status}`,
  );
}

// V14 — DOCUMENTS A PRE-EXISTING GAP, not this PR's behaviour. Both arms of
// touchesVerdict gate on the LITERAL string `review-verdict.json` appearing in the
// command, so a glob that would expand onto a verdict (`.../*.json`) is invisible
// to the guard and always has been — verified against the pre-PR guard at
// 77d6801c:64, which returns false at the same test. The deletion allowance did
// not widen this: the command never reaches the delete logic.
// Asserting exit 0 pins the CURRENT truth so a future fix flips this test loudly
// rather than silently. Tracked as 019fa8cf-faf4.
{
  const status = guardExit(
    "rm aidlc/spaces/default/intents/x/operation/gate-6-operate/*.json",
  );
  record(
    "V14 glob operand bypasses the guard entirely — PRE-EXISTING gap 019fa8cf-faf4 (exit 0)",
    status === 0,
    `exit ${status}`,
  );
}

// V15 — `unlink` of a verdict is allowed (DELETE_VERB covers it; it removes and
// cannot write). Pinned so the verb set is deliberate rather than incidental.
{
  const status = guardExit(`unlink ${VERDICT_OPERAND}`);
  record(
    "V15 verdict guard allows unlink of a verdict (exit 0)",
    status === 0,
    `exit ${status}`,
  );
}

// V16 — the `--` end-of-options separator does not smuggle an operand past the
// check; the non-verdict operand after it still denies.
{
  const status = guardExit(`rm -- ${VERDICT_OPERAND} /var/lib`);
  record(
    "V16 verdict guard denies a non-verdict operand after -- (exit 2)",
    status === 2,
    `exit ${status}`,
  );
}

// V17 — deleting the scribe's accumulation is DENIED (PR #384 review B2). The
// captures jsonl carries the anyNotReady poison: wiping it would let a lane
// re-roll a board that already returned NOT-READY at the SAME headSha.
{
  const status = guardExit(
    "rm -rf aidlc/.rin-gates-review-captures/rec.rin-gate-6-operate.abc123.jsonl",
  );
  record(
    "V17 verdict guard denies deleting the scribe capture accumulation (exit 2)",
    status === 2,
    `exit ${status}`,
  );
}

// ---------------------------------------------------------------------------
// RS — the SubagentStop review-scribe (rin-gates-review-scribe.ts). HERMETIC:
// the scribe reads HEAD via the RIN_GATES_HEAD_SHA env seam (under
// RIN_GATES_TEST_MODE=1), its trace + captures via RIN_GATES_REVIEW_TRACE_PATH /
// RIN_GATES_REVIEW_CAPTURES_DIR, and resolves the record dir from the hook's
// stdin `cwd` — so no real git, no real captures/, no shared state is touched.
// The fixture holds a `.git` dir (so the cwd walk-up stops at the fixture), an
// active-intent cursor, a bound record dir, and an aidlc-state.md naming the
// gate. Each SubagentStop payload is fed as one reviewer-lens subagent stop.
const REVIEW_SCRIBE_HOOK = join(HOOKS_DIR, "rin-gates-review-scribe.ts");

const REVIEW_ROSTER: readonly string[] = [
  "aidlc-architecture-reviewer-agent",
  "rin-clean-architecture-reviewer-agent",
  "rin-ddd-modelling-reviewer-agent",
  "rin-decomposition-reviewer-agent",
  "rin-intent-defense-reviewer-agent",
];
const INCOMPLETE_ROSTER: readonly string[] = REVIEW_ROSTER.slice(
  0,
  REVIEW_ROSTER.length - 1,
);
const LEADING_ROSTER_LENS = REVIEW_ROSTER[0];
const TRAILING_ROSTER: readonly string[] = REVIEW_ROSTER.slice(1);
const RS_HEAD_SHA = "cafebabecafebabecafebabecafebabecafebabe";
const RS_OTHER_HEAD_SHA = "0ff0ff0ff0ff0ff0ff0ff0ff0ff0ff0ff0ff0ff0";

const prepareScribeReceiptFixture = (input: {
  readonly root: string;
  readonly recordDir: string;
  readonly gate: string;
}): void => {
  writeFileSync(join(input.root, "fixture-aidlc-log.ts"), "process.exit(0);\n");
  const logicalPath = declaredReviewArtifactPathFor({
    gate: input.gate,
    graph: loadStageGraphNodes(join(PUBLIC_ENGINE_TOOLS, "data", "stage-graph.json")),
  });
  if (logicalPath === null) return;
  const artifactPath = join(input.recordDir, logicalPath);
  mkdirSync(dirname(artifactPath), { recursive: true });
  writeFileSync(artifactPath, "# Review artifact fixture\n");
};

const reviewScribeFixture = (
  name: string,
  gate: string,
): {
  root: string;
  recordDir: string;
  recordName: string;
  capturesDir: string;
  tracePath: string;
} => {
  const root = join(SANDBOX, name);
  const intents = join(root, "aidlc", "spaces", "default", "intents");
  // Under repo-SoR the record dir NAME is the intent identity the scribe stamps
  // into the verdict (there is no slice-binding.json). One record name per
  // fixture keyed by `name` so concurrent RS fixtures don't collide.
  const recordName = `260714-review-scribe-${name}`;
  const recordDir = join(intents, recordName);
  mkdirSync(join(recordDir, "inception", gate), { recursive: true });
  mkdirSync(join(root, ".git"), { recursive: true });
  writeFileSync(join(intents, "active-intent"), `${recordName}\n`, "utf-8");
  writeFileSync(
    join(recordDir, "aidlc-state.md"),
    `# AI-DLC State Tracking\n\n- **Scope**: rin-gates\n- **Current Stage**: ${gate}\n`,
    "utf-8",
  );
  prepareScribeReceiptFixture({ root, recordDir, gate });
  return {
    root,
    recordDir,
    recordName,
    capturesDir: join(root, ".captures"),
    tracePath: join(root, "review-scribe-trace.jsonl"),
  };
};

// A lens message as a DEFENDED lens produces it: the reviewed head sha echoed,
// proving which tree it read. The scribe discards a READY that cannot name its
// tree (task 019fd9b8), so a fixture without the echo exercises the discard path
// rather than the aggregation path these cases are about.
const lensMessage = (
  gate: string,
  verdict: string,
  findings: readonly string[],
  headSha: string,
): string =>
  `lens output — reviewed at ${headSha} <!--rin-gates-lens:v1 ${JSON.stringify({ gate, verdict, findings })} rin-gates-lens:v1-->`;

const runReviewScribe = (
  fx: { root: string; capturesDir: string; tracePath: string },
  payload: {
    agentType: string;
    gate: string;
    verdict: string;
    findings?: readonly string[];
    headSha?: string;
  },
): { status: number } => {
  const out = spawnSync("bun", [REVIEW_SCRIBE_HOOK], {
    cwd: fx.root,
    input: JSON.stringify({
      agent_type: payload.agentType,
      last_assistant_message: lensMessage(
        payload.gate,
        payload.verdict,
        payload.findings ?? [],
        payload.headSha ?? RS_HEAD_SHA,
      ),
      cwd: fx.root,
      session_id: `session-${payload.agentType}`,
    }),
    encoding: "utf-8",
    env: {
      ...scrubbedGitEnv(),
      RIN_GATES_SPACE: "default",
      RIN_GATES_TEST_MODE: "1",
      RIN_GATES_HEAD_SHA: payload.headSha ?? RS_HEAD_SHA,
      RIN_GATES_REVIEW_CAPTURES_DIR: fx.capturesDir,
      RIN_GATES_REVIEW_TRACE_PATH: fx.tracePath,
      RIN_GATES_REVIEW_DISCARD_LEDGER_PATH: join(fx.root, "review-discards.jsonl"),
      RIN_GATES_REVIEW_HANDBACK_LEDGER_PATH: join(fx.root, "review-handbacks.jsonl"),
      RIN_GATES_ENGINE_LOG_PATH: join(fx.root, "fixture-aidlc-log.ts"),
    },
  });
  return { status: out.status ?? -1 };
};

const reviewVerdictAt = (
  recordDir: string,
  gate: string,
): ObservedReviewVerdict | null => {
  const path = join(recordDir, "inception", gate, "review-verdict.json");
  return existsSync(path)
    ? (JSON.parse(readFileSync(path, "utf-8")) as ObservedReviewVerdict)
    : null;
};

const RS_GATE = "rin-gate-2-plan-review";

// RS1 — no verdict until the full roster is covered: three of four lenses stop
// READY and the verdict file is still absent.
{
  const fx = reviewScribeFixture("rs1", RS_GATE);
  INCOMPLETE_ROSTER.map((lens) =>
    runReviewScribe(fx, { agentType: lens, gate: RS_GATE, verdict: "READY" }),
  );
  record(
    "RS1 no verdict emitted until the whole roster is covered (3/4 lenses)",
    reviewVerdictAt(fx.recordDir, RS_GATE) === null,
    "an incomplete roster leaves no review-verdict.json",
  );
}

// RS2 — the fourth roster lens stops READY → aggregate READY verdict written,
// emittedBy the scribe, carrying every roster lens.
{
  const fx = reviewScribeFixture("rs2", RS_GATE);
  REVIEW_ROSTER.map((lens) =>
    runReviewScribe(fx, { agentType: lens, gate: RS_GATE, verdict: "READY" }),
  );
  const verdict = reviewVerdictAt(fx.recordDir, RS_GATE);
  const lensesCoverRoster =
    verdict !== null &&
    Array.isArray(verdict.lenses) &&
    REVIEW_ROSTER.every((lens) => verdict.lenses?.includes(lens));
  record(
    "RS2 full roster all-READY writes an aggregate READY verdict stamped by the scribe",
    verdict?.verdict === "READY" &&
      verdict?.emittedBy === "rin-gates-review-scribe" &&
      verdict?.taskId === fx.recordName &&
      verdict?.headSha === RS_HEAD_SHA &&
      lensesCoverRoster,
    `verdict=${verdict?.verdict} emittedBy=${verdict?.emittedBy} taskId=${verdict?.taskId} roster-covered=${lensesCoverRoster}`,
  );
}

// RS3 — one roster lens stops NOT-READY (the others READY) → aggregate NOT-READY.
{
  const fx = reviewScribeFixture("rs3", RS_GATE);
  runReviewScribe(fx, {
    agentType: LEADING_ROSTER_LENS,
    gate: RS_GATE,
    verdict: "NOT-READY",
    findings: ["a blocking finding"],
  });
  TRAILING_ROSTER.map((lens) =>
    runReviewScribe(fx, { agentType: lens, gate: RS_GATE, verdict: "READY" }),
  );
  const verdict = reviewVerdictAt(fx.recordDir, RS_GATE);
  record(
    "RS3 any NOT-READY lens yields an aggregate NOT-READY verdict",
    verdict?.verdict === "NOT-READY" &&
      Array.isArray(verdict.findings) &&
      verdict.findings.includes("a blocking finding"),
    `verdict=${verdict?.verdict} findings=${JSON.stringify(verdict?.findings)}`,
  );
}

// RS4 — anti-replay via headSha: a full roster captured under one HEAD does NOT
// carry over to a different HEAD. Cover the roster under RS_OTHER_HEAD_SHA, then
// re-run the fixture emptied of its verdict under RS_HEAD_SHA with only ONE lens:
// the earlier-commit captures live in a different captures file (keyed by
// headSha) and must not count, so the new HEAD sees an incomplete roster.
{
  const fx = reviewScribeFixture("rs4", RS_GATE);
  REVIEW_ROSTER.map((lens) =>
    runReviewScribe(fx, {
      agentType: lens,
      gate: RS_GATE,
      verdict: "READY",
      headSha: RS_OTHER_HEAD_SHA,
    }),
  );
  rmSync(join(fx.recordDir, "inception", RS_GATE, "review-verdict.json"), {
    force: true,
  });
  runReviewScribe(fx, {
    agentType: LEADING_ROSTER_LENS,
    gate: RS_GATE,
    verdict: "READY",
    headSha: RS_HEAD_SHA,
  });
  record(
    "RS4 anti-replay: a roster covered under an earlier headSha does not cover a new headSha",
    reviewVerdictAt(fx.recordDir, RS_GATE) === null,
    "captures are keyed by headSha; a single lens on the new HEAD is an incomplete roster",
  );
}

// RS5 — a non-reviewer agent_type is filtered before capture: the scribe only
// captures lens subagents (agent_type ending -reviewer-agent). Discriminating by
// reading the captures file directly — three roster lenses stop READY, then a
// non-reviewer developer stops in what would be the fourth slot. If the filter
// broke and the developer counted, the captures file would carry a fourth,
// non-reviewer line; asserting exactly the three roster lenses and no developer
// entry isolates the filter, rather than inferring it from an absent aggregate
// verdict that stays null on a 3/4 roster regardless.
{
  const fx = reviewScribeFixture("rs5", RS_GATE);
  const NON_REVIEWER_STOP = "aidlc-developer-agent";
  INCOMPLETE_ROSTER.map((lens) =>
    runReviewScribe(fx, { agentType: lens, gate: RS_GATE, verdict: "READY" }),
  );
  runReviewScribe(fx, {
    agentType: NON_REVIEWER_STOP,
    gate: RS_GATE,
    verdict: "READY",
  });
  const capturesPath = join(
    fx.capturesDir,
    `${fx.recordName}.${RS_GATE}.${RS_HEAD_SHA}.jsonl`,
  );
  const capturedLenses = existsSync(capturesPath)
    ? readFileSync(capturesPath, "utf-8")
        .split("\n")
        .filter((line) => line.trim() !== "")
        .map((line) => (JSON.parse(line) as { lens: string }).lens)
    : [];
  const onlyRosterLensesCaptured =
    capturedLenses.length === INCOMPLETE_ROSTER.length &&
    INCOMPLETE_ROSTER.every((lens) => capturedLenses.includes(lens)) &&
    !capturedLenses.includes(NON_REVIEWER_STOP);
  record(
    "RS5 a non-reviewer agent_type is filtered before capture (developer stop writes no capture line)",
    onlyRosterLensesCaptured && reviewVerdictAt(fx.recordDir, RS_GATE) === null,
    `captured=${JSON.stringify(capturedLenses)} (expected exactly the ${INCOMPLETE_ROSTER.length} roster lenses, no ${NON_REVIEWER_STOP})`,
  );
}

// RS6 — end-to-end with the autonomy gate: a scribe-emitted READY verdict with
// full roster coverage is ACCEPTED by the autonomy hook (exit 0). Proves item 2's
// wiring against a real scribe-produced verdict, not a hand-crafted fixture.
{
  const fx = reviewScribeFixture("rs6", RS_GATE);
  REVIEW_ROSTER.map((lens) =>
    runReviewScribe(fx, { agentType: lens, gate: RS_GATE, verdict: "READY" }),
  );
  const out = spawnSync("bun", [AUTONOMY_HOOK], {
    cwd: fx.root,
    input: JSON.stringify({
      tool_name: "Bash",
      tool_input: { command: REPORT_CMD },
      cwd: fx.root,
    }),
    encoding: "utf-8",
    env: {
      ...scrubbedGitEnv(),
      CLAUDE_PROJECT_DIR: fx.root,
      RIN_GATES_SPACE: "default",
      RIN_GATES_TEST_MODE: "1",
      RIN_GATES_HEAD_SHA: RS_HEAD_SHA,
    },
  });
  record(
    "RS6 autonomy gate accepts a scribe-emitted roster-covered READY verdict (exit 0)",
    (out.status ?? -1) === 0,
    `exit ${out.status} :: ${(out.stderr ?? "").trim()}`,
  );
}

// RS7 — the autonomy gate REJECTS a scribe-emitted verdict that misses a roster
// lens (item 2's roster-coverage bar): hand a scribe-stamped verdict naming only
// three of four roster lenses → deny (exit 2).
{
  const fx = reviewScribeFixture("rs7", RS_GATE);
  writeFileSync(
    join(fx.recordDir, "inception", RS_GATE, "review-verdict.json"),
    `${JSON.stringify({
      gate: RS_GATE,
      taskId: fx.recordName,
      headSha: RS_HEAD_SHA,
      verdict: "READY",
      lenses: INCOMPLETE_ROSTER,
      emittedBy: "rin-gates-review-scribe",
      reviewedAt: "2026-07-14T00:00:00.000Z",
    })}\n`,
    "utf-8",
  );
  const out = spawnSync("bun", [AUTONOMY_HOOK], {
    cwd: fx.root,
    input: JSON.stringify({
      tool_name: "Bash",
      tool_input: { command: REPORT_CMD },
      cwd: fx.root,
    }),
    encoding: "utf-8",
    env: {
      ...scrubbedGitEnv(),
      CLAUDE_PROJECT_DIR: fx.root,
      RIN_GATES_SPACE: "default",
      RIN_GATES_TEST_MODE: "1",
      RIN_GATES_HEAD_SHA: RS_HEAD_SHA,
    },
  });
  record(
    "RS7 autonomy gate denies a scribe verdict missing a roster lens (exit 2)",
    (out.status ?? -1) === 2 && (out.stderr ?? "").includes("roster lenses"),
    `exit ${out.status}`,
  );
}

// RS7b — the findings gate at the AUTHORISING boundary (task 019f6d3e). Both
// producers refuse to emit a READY over an undisposed finding, but the producers
// are not what authorises the approve — this hook is. A verdict written by an
// OLDER tool (a worktree cut before that change runs its own copy) can carry
// READY beside live findings, and headSha freshness detects a stale commit, never
// a stale tool. So the consumer reads the field the producer writes: a fully
// roster-covered, fresh-sha, correctly-stamped READY is still DENIED when its own
// blockingFindings list is non-empty.
{
  const fx = reviewScribeFixture("rs7b", RS_GATE);
  writeFileSync(
    join(fx.recordDir, "inception", RS_GATE, "review-verdict.json"),
    `${JSON.stringify({
      gate: RS_GATE,
      taskId: fx.recordName,
      headSha: RS_HEAD_SHA,
      verdict: "READY",
      lenses: REVIEW_ROSTER,
      blockingFindings: [
        "src/kernel/a.ts:12 | const parsed = raw as Config | CD-2 | cast defeats the type",
      ],
      emittedBy: "rin-gates-review-scribe",
      reviewedAt: "2026-08-09T00:00:00.000Z",
    })}\n`,
    "utf-8",
  );
  const out = spawnSync("bun", [AUTONOMY_HOOK], {
    cwd: fx.root,
    input: JSON.stringify({
      tool_name: "Bash",
      tool_input: { command: REPORT_CMD },
      cwd: fx.root,
    }),
    encoding: "utf-8",
    env: {
      ...scrubbedGitEnv(),
      CLAUDE_PROJECT_DIR: fx.root,
      RIN_GATES_SPACE: "default",
      RIN_GATES_TEST_MODE: "1",
      RIN_GATES_HEAD_SHA: RS_HEAD_SHA,
    },
  });
  record(
    "RS7b autonomy gate denies a roster-covered READY carrying undisposed blockingFindings (exit 2)",
    (out.status ?? -1) === 2 &&
      (out.stderr ?? "").includes("undisposed finding"),
    `exit ${out.status} :: ${(out.stderr ?? "").trim()}`,
  );
}

// ---------------------------------------------------------------------------
// SLUG + PER-GATE-ROSTER — regression coverage for tasks 019f8be9 (the
// review-scribe/emitter rejecting the engine's `rin-gate-*` Current Stage slug,
// pipeline-wide) and 019f8e66 (the min-roster being gate-agnostic, so Gate 5
// waited for architecture lenses its board never dispatches). Both defeated the
// verdict path at every gate / at Gate 5 while the hermetic fixtures above —
// which fed the bare slug and the architecture roster verbatim — passed. These
// cases dispatch the PREFIXED slug and the Gate-5 roster, the two production
// inputs the old fixtures never exercised.

const phaseDirOf = (gate: string): string => {
  if (/^rin-gate-[45]/.test(gate)) return "construction";
  if (/^rin-gate-6/.test(gate)) return "operation";
  return "inception";
};

// A review-scribe fixture whose `Current Stage` may carry the `rin-gate-*`
// prefix, independent of the phase dir the verdict actually lands in.
const slugScribeFixture = (
  name: string,
  taskId: string,
  stateGate: string,
): {
  root: string;
  recordDir: string;
  capturesDir: string;
  tracePath: string;
} => {
  const root = join(SANDBOX, name);
  const intents = join(root, "aidlc", "spaces", "default", "intents");
  const recordDirName = "260723-slug-scribe-intent";
  const recordDir = join(intents, recordDirName);
  mkdirSync(recordDir, { recursive: true });
  mkdirSync(join(root, ".git"), { recursive: true });
  writeFileSync(join(intents, "active-intent"), `${recordDirName}\n`, "utf-8");
  writeFileSync(
    join(recordDir, "aidlc-state.md"),
    `# AI-DLC State Tracking\n\n- **Scope**: rin-gates\n- **Current Stage**: ${stateGate}\n`,
    "utf-8",
  );
  prepareScribeReceiptFixture({ root, recordDir, gate: stateGate });
  writeFileSync(
    join(recordDir, "slice-binding.json"),
    `${JSON.stringify({ taskId, boundBy: "rin-gate-0-reconcile", boundAt: "2026-07-23T00:00:00.000Z" })}\n`,
    "utf-8",
  );
  return {
    root,
    recordDir,
    capturesDir: join(root, ".captures"),
    tracePath: join(root, "review-scribe-trace.jsonl"),
  };
};

const verdictAtPhase = (
  recordDir: string,
  gate: string,
): ObservedReviewVerdict | null => {
  const path = join(recordDir, phaseDirOf(gate), gate, "review-verdict.json");
  return existsSync(path)
    ? (JSON.parse(readFileSync(path, "utf-8")) as ObservedReviewVerdict)
    : null;
};

const GATE5_STATE_SLUG = "rin-gate-5-review-cycle";
const GATE5_ROSTER: readonly string[] = [
  "rin-pr-checkers-reviewer-agent",
  "rin-pr-evades-reviewer-agent",
  "rin-pr-claims-reviewer-agent",
  "rin-pr-scope-reviewer-agent",
  "rin-pr-tests-dead-reviewer-agent",
  "rin-pr-disposition-reviewer-agent",
  "rin-intent-defense-reviewer-agent",
];

// RS8 — the engine's `rin-gate-*` Current Stage slug is accepted: a full roster
// stopping READY under Current Stage `rin-gate-2-plan-review` writes the aggregate
// verdict at the `inception/rin-gate-2-plan-review/` path (where the autonomy gate
// reads), NOT rejected with "gate has no phase mapping" (019f8be9). The retired
// bare `gate-2-plan-review/` path must NOT be written: one vocabulary, and the
// slug names its own dir with no normalisation step.
{
  const fx = slugScribeFixture("rs8", "slice-rs8", "rin-gate-2-plan-review");
  REVIEW_ROSTER.map((lens) =>
    runReviewScribe(fx, {
      agentType: lens,
      gate: "rin-gate-2-plan-review",
      verdict: "READY",
    }),
  );
  const verdict = verdictAtPhase(fx.recordDir, "rin-gate-2-plan-review");
  const barePathAbsent = !existsSync(
    join(
      fx.recordDir,
      "inception",
      "gate-2-plan-review",
      "review-verdict.json",
    ),
  );
  record(
    "RS8 review-scribe accepts the engine's rin-gate-* Current Stage slug and writes at the prefixed path (019f8be9)",
    verdict?.verdict === "READY" &&
      verdict?.gate === "rin-gate-2-plan-review" &&
      verdict?.emittedBy === "rin-gates-review-scribe" &&
      barePathAbsent,
    `verdict=${verdict?.verdict} gate=${verdict?.gate} prefixed-path-only=${barePathAbsent}`,
  );
}

// RS9 — the Gate-5 roster is gate-resolved: at rin-gate-5-review-cycle the scribe
// gates on the pr-review board lenses (not the architecture default). All seven
// pr-review lenses READY → aggregate READY; the architecture lenses are NOT part
// of the Gate-5 roster (019f8e66).
{
  const fx = slugScribeFixture("rs9", "slice-rs9", GATE5_STATE_SLUG);
  GATE5_ROSTER.map((lens) =>
    runReviewScribe(fx, {
      agentType: lens,
      gate: "rin-gate-5-review-cycle",
      verdict: "READY",
    }),
  );
  const verdict = verdictAtPhase(fx.recordDir, GATE5_STATE_SLUG);
  const rosterCovered =
    verdict !== null &&
    Array.isArray(verdict.lenses) &&
    GATE5_ROSTER.every((lens) => verdict.lenses?.includes(lens));
  record(
    "RS9 Gate-5 roster is gate-resolved: the pr-review board lenses cover, architecture lenses are not required (019f8e66)",
    verdict?.verdict === "READY" &&
      verdict?.gate === "rin-gate-5-review-cycle" &&
      rosterCovered,
    `verdict=${verdict?.verdict} gate5-roster-covered=${rosterCovered}`,
  );
}

// RS10 — DISCRIMINATING: the OLD architecture roster does NOT cover Gate 5. Feed
// only the four architecture lenses at rin-gate-5-review-cycle; the Gate-5 roster is
// the pr-review board, so no aggregate verdict is written. Guards against a
// regression to the gate-agnostic stub (which WOULD have written a verdict here).
{
  const fx = slugScribeFixture("rs10", "slice-rs10", GATE5_STATE_SLUG);
  REVIEW_ROSTER.map((lens) =>
    runReviewScribe(fx, {
      agentType: lens,
      gate: "rin-gate-5-review-cycle",
      verdict: "READY",
    }),
  );
  record(
    "RS10 the architecture roster does NOT cover Gate 5 (no verdict) — the roster is genuinely gate-specific (019f8e66)",
    verdictAtPhase(fx.recordDir, GATE5_STATE_SLUG) === null,
    "architecture lenses at gate-5 leave the pr-review roster uncovered → no verdict",
  );
}

// RS11 — end-to-end at Gate 5 with the autonomy gate: a scribe-emitted Gate-5
// verdict (full pr-review roster) is ACCEPTED by the autonomy hook, whose roster
// check is now ALSO gate-resolved from the same config. Proves both consumers
// read the per-gate roster identically (019f8be9 + 019f8e66 together).
{
  const fx = slugScribeFixture("rs11", "slice-rs11", GATE5_STATE_SLUG);
  GATE5_ROSTER.map((lens) =>
    runReviewScribe(fx, {
      agentType: lens,
      gate: "rin-gate-5-review-cycle",
      verdict: "READY",
    }),
  );
  const out = spawnSync("bun", [AUTONOMY_HOOK], {
    cwd: fx.root,
    input: JSON.stringify({
      tool_name: "Bash",
      tool_input: {
        command:
          "bun .claude/tools/aidlc-orchestrate.ts report --stage rin-gate-5-review-cycle --result approved",
      },
      cwd: fx.root,
    }),
    encoding: "utf-8",
    env: {
      ...scrubbedGitEnv(),
      CLAUDE_PROJECT_DIR: fx.root,
      RIN_GATES_SPACE: "default",
      RIN_GATES_TEST_MODE: "1",
      RIN_GATES_HEAD_SHA: RS_HEAD_SHA,
    },
  });
  record(
    "RS11 autonomy gate accepts a scribe-emitted Gate-5 verdict under the rin-gate-* slug + gate-resolved roster (exit 0)",
    (out.status ?? -1) === 0,
    `exit ${out.status} :: ${(out.stderr ?? "").trim()}`,
  );
}

// RS12 — the autonomy gate REJECTS a Gate-5 scribe verdict that names the WRONG
// (architecture) roster: a stamped Gate-5 verdict listing only architecture
// lenses misses every pr-review roster lens → deny (exit 2). The per-gate roster
// check must fail on a right-count-wrong-lens verdict.
{
  const fx = slugScribeFixture("rs12", "slice-rs12", GATE5_STATE_SLUG);
  const gate5Dir = join(
    fx.recordDir,
    "construction",
    "rin-gate-5-review-cycle",
  );
  mkdirSync(gate5Dir, { recursive: true });
  writeFileSync(
    join(gate5Dir, "review-verdict.json"),
    `${JSON.stringify({
      gate: "rin-gate-5-review-cycle",
      taskId: "slice-rs12",
      headSha: RS_HEAD_SHA,
      verdict: "READY",
      lenses: REVIEW_ROSTER,
      emittedBy: "rin-gates-review-scribe",
      reviewedAt: "2026-07-23T00:00:00.000Z",
    })}\n`,
    "utf-8",
  );
  const out = spawnSync("bun", [AUTONOMY_HOOK], {
    cwd: fx.root,
    input: JSON.stringify({
      tool_name: "Bash",
      tool_input: {
        command:
          "bun .claude/tools/aidlc-orchestrate.ts report --stage rin-gate-5-review-cycle --result approved",
      },
      cwd: fx.root,
    }),
    encoding: "utf-8",
    env: {
      ...scrubbedGitEnv(),
      CLAUDE_PROJECT_DIR: fx.root,
      RIN_GATES_SPACE: "default",
      RIN_GATES_TEST_MODE: "1",
      RIN_GATES_HEAD_SHA: RS_HEAD_SHA,
    },
  });
  record(
    "RS12 autonomy gate denies a Gate-5 verdict naming the architecture roster (wrong lenses for this gate, exit 2) (019f8e66)",
    (out.status ?? -1) === 2 && (out.stderr ?? "").includes("roster lenses"),
    `exit ${out.status}`,
  );
}

// A13 — the emitter accepts the `rin-gate-*` slug: `--gate rin-gate-2-plan-review`
// writes the verdict at the `inception/rin-gate-2-plan-review/` path with the same
// prefixed gate field (019f8be9, emitter arm). The retired bare
// `gate-2-plan-review/` path must NOT be written — the slug names its own dir.
{
  const root = join(SANDBOX, "a13");
  const recordDirName = "260723-emitter-slug-intent";
  mkdirSync(
    join(root, "aidlc", "spaces", "default", "intents", recordDirName),
    { recursive: true },
  );
  const out = spawnSync(
    "bun",
    [
      VERDICT_EMITTER,
      "--record-dir",
      recordDirName,
      "--gate",
      "rin-gate-2-plan-review",
      "--task-id",
      "slice-a13",
      "--verdict",
      "READY",
      "--lenses",
      "challenger",
    ],
    {
      encoding: "utf-8",
      env: {
        ...scrubbedGitEnv(),
        RIN_GATES_VERDICT_EMITTER: "1",
        RIN_GATES_WORKSPACE_ROOT: root,
        RIN_GATES_TEST_MODE: "1",
        RIN_GATES_HEAD_SHA: "deadbeefcafe",
        RIN_GATES_DIFF_DIGEST: "digest-a13",
      },
    },
  );
  const prefixedPath = join(
    root,
    "aidlc",
    "spaces",
    "default",
    "intents",
    recordDirName,
    "inception",
    "rin-gate-2-plan-review",
    "review-verdict.json",
  );
  const written = existsSync(prefixedPath)
    ? (JSON.parse(readFileSync(prefixedPath, "utf-8")) as ObservedReviewVerdict)
    : null;
  const bareAbsent = !existsSync(
    join(
      root,
      "aidlc",
      "spaces",
      "default",
      "intents",
      recordDirName,
      "inception",
      "gate-2-plan-review",
      "review-verdict.json",
    ),
  );
  record(
    "A13 emitter accepts the rin-gate-* slug and writes at the prefixed path with a prefixed gate field (019f8be9)",
    (out.status ?? -1) === 0 &&
      written?.gate === "rin-gate-2-plan-review" &&
      written?.emittedBy === "rin-gates-review-verdict" &&
      bareAbsent,
    written
      ? `gate=${written.gate} prefixed-path-only=${bareAbsent}`
      : (out.stderr ?? "").trim(),
  );
}

// ---------------------------------------------------------------------------
// TIER 2 — the two-mode verdict binding (Slice 260816-verdict-landed-binding).
// Real git, real subprocesses, inside repositories these cases mint and dispose.
// The helper is reached by a HERE-computed path and a dynamic import rather than
// a static specifier: this file is a byte-identical synced twin, and a literal
// relative specifier cannot be correct from both locations at once.
const { createHermeticGitRepository } = await import(
  pathToFileURL(
    join(HERE, "..", "hermetic-git", "index.ts"),
  ).href
);

// Detail strings are truncated so one failing case cannot bury the summary; the
// widths are presentation only and carry no behavioural meaning.
const DETAIL_WIDTH = 160;
const WIDE_DETAIL_WIDTH = 200;
const FIXTURE_PULL_REQUEST = 561;
const STUB_EXECUTABLE_MODE = 0o755;
const SHA256_HEX_LENGTH = 64;
const WRONG_DIGEST = "0".repeat(SHA256_HEX_LENGTH);
const PLACEHOLDER_DIGEST = "9".repeat(SHA256_HEX_LENGTH);

const LANDED_RECORD = "260816-verdict-landed-binding";
const OTHER_RECORD = "260801-other-intent";
const SIBLING_RECORD = "260816-verdict-landed-binding-2";
const LANDED_GATE = "rin-gate-2-plan-review";
const RECORD_RELATIVE = ["aidlc", "spaces", "default", "intents"] as const;

type MintedRepository = {
  readonly path: string;
  readonly environment: Readonly<Record<string, string>>;
  readonly run: (gitArguments: readonly string[]) => string;
  readonly writeFile: (input: {
    readonly relativePath: string;
    readonly body: string;
  }) => void;
  readonly commitAll: (input: { readonly message: string }) => void;
  readonly dispose: () => void;
};

// createHermeticGitRepository's writeFile is a bare writeFileSync with no
// mkdirSync, and every path here is nested — so the fixture creates the tree.
const writeNested = (
  repository: MintedRepository,
  relativePath: string,
  body: string,
): void => {
  mkdirSync(dirname(join(repository.path, relativePath)), { recursive: true });
  repository.writeFile({ relativePath, body });
};

const recordPathIn = (recordDirName: string, ...rest: string[]): string =>
  [...RECORD_RELATIVE, recordDirName, ...rest].join("/");

// A deliberately multi-line seed file that every merge-commit fixture MODIFIES
// rather than creating fresh. A new-file diff carries no context lines at all, so
// `-U1` and `-U3` render it identically — a fixture built that way would let a
// context-depth divergence between the two digest definitions pass unnoticed,
// which is precisely the class E7 exists to catch. Modifying a line in the middle
// of this block makes the surrounding context part of the patch bytes.
const CONTEXT_SEED_PATH = "src/context-seed.ts";
const contextSeedBody = (mutatedLine: string): string =>
  [
    "export const alpha = 1;",
    "export const bravo = 2;",
    "export const charlie = 3;",
    "export const delta = 4;",
    mutatedLine,
    "export const foxtrot = 6;",
    "export const golf = 7;",
    "export const hotel = 8;",
    "export const india = 9;",
    "",
  ].join("\n");

const seedIntentRepository = (input: {
  readonly recordDirName: string;
  readonly gate: string;
}): MintedRepository => {
  const repository: MintedRepository = createHermeticGitRepository({
    namePrefix: "rin-gates-tier2-",
  });
  writeNested(repository, "README.md", "seed\n");
  writeNested(
    repository,
    CONTEXT_SEED_PATH,
    contextSeedBody("export const echo = 5;"),
  );
  writeNested(
    repository,
    recordPathIn(input.recordDirName, "aidlc-state.md"),
    `# AI-DLC State Tracking\n\n- **Scope**: rin-gates\n- **Current Stage**: ${input.gate}\n`,
  );
  writeNested(
    repository,
    [...RECORD_RELATIVE, "active-intent"].join("/"),
    `${input.recordDirName}\n`,
  );
  mkdirSync(
    join(
      repository.path,
      ...RECORD_RELATIVE,
      input.recordDirName,
      "inception",
      input.gate,
    ),
    { recursive: true },
  );
  repository.commitAll({ message: "seed" });
  return repository;
};

// The child env for every tier-2 spawn. Both sha seams are REMOVED (not blanked)
// and RIN_GATES_TEST_MODE is left unset, so nothing can green through a seam.
const tier2Environment = (
  repository: MintedRepository,
  extra: Record<string, string> = {},
): Record<string, string> => {
  const base: Record<string, string> = { ...repository.environment, ...extra };
  delete base.RIN_GATES_DIFF_DIGEST;
  delete base.RIN_GATES_HEAD_SHA;
  delete base.RIN_GATES_TEST_MODE;
  return base;
};

const runAutonomyHookAt = (
  repository: MintedRepository,
  extra: Record<string, string> = {},
): { status: number; stderr: string } => {
  const out = spawnSync("bun", [AUTONOMY_HOOK], {
    cwd: repository.path,
    input: JSON.stringify({
      tool_name: "Bash",
      tool_input: { command: REPORT_CMD },
      cwd: repository.path,
    }),
    encoding: "utf-8",
    env: tier2Environment(repository, {
      CLAUDE_PROJECT_DIR: repository.path,
      RIN_GATES_SPACE: "default",
      ...extra,
    }),
  });
  return { status: out.status ?? -1, stderr: out.stderr ?? "" };
};

const writeVerdictIn = (
  repository: MintedRepository,
  recordDirName: string,
  gate: string,
  payload: Record<string, unknown>,
): void => {
  writeNested(
    repository,
    recordPathIn(recordDirName, "inception", gate, "review-verdict.json"),
    `${JSON.stringify(payload, null, 2)}\n`,
  );
};

const landedVerdictPayload = (input: {
  readonly mergeCommitSha: string;
  readonly diffDigest: string;
  readonly gate?: string;
}): Record<string, unknown> => ({
  gate: input.gate ?? LANDED_GATE,
  taskId: "slice-landed",
  verdict: "READY",
  // Covering roster for the same reason readyVerdict carries one: the floor is
  // emitter-agnostic (IF-2), so a landed-binding fixture must clear it before
  // its ancestry/digest subject is ever reached.
  lenses: GATE_2_FLOOR,
  findings: [],
  blockingFindings: [],
  reviewedAt: "2026-08-16T00:00:00.000Z",
  emittedBy: "rin-gates-review-verdict",
  binding: {
    mode: "landed",
    pullRequestNumber: FIXTURE_PULL_REQUEST,
    reviewedHeadSha: "beef1111beef1111beef1111beef1111beef1111",
    mergeCommitSha: input.mergeCommitSha,
    diffDigest: input.diffDigest,
  },
});

const mergePatchDigestIn = (
  repository: MintedRepository,
  mergeCommitSha: string,
): string => {
  const spawned = spawnSync(
    "git",
    ["diff", `${mergeCommitSha}^..${mergeCommitSha}`],
    {
      cwd: repository.path,
      encoding: "buffer",
      stdio: ["ignore", "pipe", "ignore"],
      env: { ...repository.environment },
    },
  );
  return createHash("sha256")
    .update(spawned.stdout ?? Buffer.alloc(0))
    .digest("hex");
};

// A merge commit reachable from HEAD: branch off, MODIFY the multi-line seed so
// the patch carries context lines, commit, merge back --no-ff.
const seedMergedBranch = (input: {
  readonly repository: MintedRepository;
  readonly branch: string;
  readonly mutatedLine: string;
  readonly mergeIntoHead: boolean;
}): string => {
  const { repository, branch } = input;
  repository.run(["checkout", "-q", "-b", branch]);
  writeNested(
    repository,
    CONTEXT_SEED_PATH,
    contextSeedBody(input.mutatedLine),
  );
  repository.commitAll({ message: `${branch} change` });
  repository.run(["checkout", "-q", "main"]);
  repository.run(["merge", "-q", "--no-ff", "-m", `merge ${branch}`, branch]);
  const mergeSha = repository.run(["rev-parse", "HEAD"]).trim();
  if (!input.mergeIntoHead) repository.run(["reset", "-q", "--hard", "HEAD~1"]);
  return mergeSha;
};

// A14 — landed binding, merge commit IS an ancestor of HEAD and the recorded
// digest recomputes equal → allow (exit 0). Real repo, real git, no env seam.
{
  const repository = seedIntentRepository({
    recordDirName: LANDED_RECORD,
    gate: LANDED_GATE,
  });
  try {
    const mergeSha = seedMergedBranch({
      repository,
      branch: "feature-a14",
      mutatedLine: "export const echo = 14;",
      mergeIntoHead: true,
    });
    const digest = mergePatchDigestIn(repository, mergeSha);
    writeVerdictIn(
      repository,
      LANDED_RECORD,
      LANDED_GATE,
      landedVerdictPayload({ mergeCommitSha: mergeSha, diffDigest: digest }),
    );
    repository.commitAll({ message: "landed verdict" });
    const { status, stderr } = runAutonomyHookAt(repository);
    record(
      "A14 autonomy hook allows a landed verdict whose merge commit is an ancestor of HEAD and whose patch digest recomputes equal (exit 0)",
      status === 0,
      `exit ${status} :: ${stderr.trim()}`,
    );
  } finally {
    repository.dispose();
  }
}

// A15 — landed binding, merge commit on a SIBLING branch not reachable from HEAD.
// The digest is deliberately CORRECT, so only ancestry can be doing the work.
{
  const repository = seedIntentRepository({
    recordDirName: LANDED_RECORD,
    gate: LANDED_GATE,
  });
  try {
    const mergeSha = seedMergedBranch({
      repository,
      branch: "feature-a15",
      mutatedLine: "export const echo = 15;",
      mergeIntoHead: false,
    });
    const digest = mergePatchDigestIn(repository, mergeSha);
    writeVerdictIn(
      repository,
      LANDED_RECORD,
      LANDED_GATE,
      landedVerdictPayload({ mergeCommitSha: mergeSha, diffDigest: digest }),
    );
    repository.commitAll({ message: "landed verdict" });
    const { status, stderr } = runAutonomyHookAt(repository);
    // The held-constant property is asserted, not merely intended: the deny must
    // name ancestry AND must NOT name the digest. Without the second clause a
    // future edit could weaken this into a second digest-mismatch case and the
    // pair would stop discriminating on the two elements independently.
    record(
      "A15 autonomy hook denies a landed verdict whose merge commit is NOT an ancestor of HEAD, with the digest held CORRECT (exit 2, names ancestry and NOT the digest)",
      status === 2 &&
        stderr.includes("is not an ancestor of HEAD") &&
        !stderr.includes("does not match"),
      `exit ${status} :: ${stderr.trim().slice(0, DETAIL_WIDTH)}`,
    );
  } finally {
    repository.dispose();
  }
}

// A16 — the held-constant pair to A15: ancestry deliberately SATISFIED, the
// recorded digest altered. Proves ancestry alone is insufficient.
{
  const repository = seedIntentRepository({
    recordDirName: LANDED_RECORD,
    gate: LANDED_GATE,
  });
  try {
    const mergeSha = seedMergedBranch({
      repository,
      branch: "feature-a16",
      mutatedLine: "export const echo = 16;",
      mergeIntoHead: true,
    });
    writeVerdictIn(
      repository,
      LANDED_RECORD,
      LANDED_GATE,
      landedVerdictPayload({
        mergeCommitSha: mergeSha,
        diffDigest: WRONG_DIGEST,
      }),
    );
    repository.commitAll({ message: "landed verdict" });
    const { status, stderr } = runAutonomyHookAt(repository);
    record(
      "A16 autonomy hook denies a landed verdict whose patch digest does not match, with ancestry deliberately SATISFIED (exit 2, names the digest and NOT ancestry)",
      status === 2 &&
        stderr.includes("merge-commit patch digest") &&
        stderr.includes("does not match") &&
        !stderr.includes("is not an ancestor of HEAD"),
      `exit ${status} :: ${stderr.trim().slice(0, DETAIL_WIDTH)}`,
    );
  } finally {
    repository.dispose();
  }
}

// A17 — a landed binding with NO diffDigest is rejected at normalisation, before
// any git runs. Tier 1: the absence is structural, not a git fact.
{
  const fx = autonomyFixture("a17", {
    scope: "rin-gates",
    taskId: "slice-a17",
    gate: LANDED_GATE,
  });
  writeFileSync(
    verdictFilePath(fx.root),
    `${JSON.stringify({
      gate: LANDED_GATE,
      taskId: "slice-a17",
      verdict: "READY",
      lenses: GATE_2_FLOOR,
      emittedBy: "rin-gates-review-verdict",
      binding: {
        mode: "landed",
        pullRequestNumber: FIXTURE_PULL_REQUEST,
        reviewedHeadSha: "beef1111",
        mergeCommitSha: "cafe0000",
      },
    })}\n`,
    "utf-8",
  );
  const { status, stderr } = runAutonomyHook(fx.root, REPORT_CMD);
  record(
    "A17 autonomy hook denies a landed binding missing diffDigest at normalisation, naming the field (exit 2)",
    status === 2 &&
      stderr.includes("binding is incomplete") &&
      stderr.includes("diffDigest"),
    `exit ${status} :: ${stderr.trim().slice(0, DETAIL_WIDTH)}`,
  );
}

// A18 — the emitter-stamp check precedes binding evaluation: a hand-written
// LANDED verdict is refused for its missing stamp, not for its binding.
{
  const fx = autonomyFixture("a18", {
    scope: "rin-gates",
    taskId: "slice-a18",
    gate: LANDED_GATE,
  });
  writeFileSync(
    verdictFilePath(fx.root),
    `${JSON.stringify({
      gate: LANDED_GATE,
      taskId: "slice-a18",
      verdict: "READY",
      lenses: GATE_2_FLOOR,
      binding: {
        mode: "landed",
        pullRequestNumber: FIXTURE_PULL_REQUEST,
        reviewedHeadSha: "beef1111",
        mergeCommitSha: "cafe0000",
        diffDigest: PLACEHOLDER_DIGEST,
      },
    })}\n`,
    "utf-8",
  );
  const { status, stderr } = runAutonomyHook(fx.root, REPORT_CMD);
  record(
    "A18 autonomy hook denies a hand-written landed verdict on the emitter stamp, before the binding is evaluated (exit 2)",
    status === 2 && stderr.includes("not emitted by"),
    `exit ${status} :: ${stderr.trim().slice(0, DETAIL_WIDTH)}`,
  );
}

// A19 — a THIRD binding mode is rejected by name rather than falling through to
// either arm. The closed union is the enforcement, not a default branch.
{
  const fx = autonomyFixture("a19", {
    scope: "rin-gates",
    taskId: "slice-a19",
    gate: LANDED_GATE,
  });
  writeFileSync(
    verdictFilePath(fx.root),
    `${JSON.stringify({
      gate: LANDED_GATE,
      taskId: "slice-a19",
      headSha: FIXTURE_HEAD_SHA,
      verdict: "READY",
      lenses: GATE_2_FLOOR,
      emittedBy: "rin-gates-review-verdict",
      binding: { mode: "asserted", headSha: FIXTURE_HEAD_SHA },
    })}\n`,
    "utf-8",
  );
  const { status, stderr } = runAutonomyHook(fx.root, REPORT_CMD);
  record(
    "A19 autonomy hook denies an unknown binding mode by name rather than falling through (exit 2)",
    status === 2 &&
      stderr.includes("unknown binding mode") &&
      stderr.includes("asserted"),
    `exit ${status} :: ${stderr.trim().slice(0, DETAIL_WIDTH)}`,
  );
}

// A20 — a LEGACY verdict carrying no binding member at all, with headSha equal to
// HEAD, still authorises: an older emitter's output is read as live.
{
  const fx = autonomyFixture("a20", {
    scope: "rin-gates",
    taskId: "slice-a20",
    gate: LANDED_GATE,
  });
  writeFileSync(
    verdictFilePath(fx.root),
    readyVerdict("slice-a20", fx.head),
    "utf-8",
  );
  const { status, stderr } = runAutonomyHook(fx.root, REPORT_CMD);
  record(
    "A20 autonomy hook allows a legacy binding-less verdict whose headSha equals HEAD (exit 0)",
    status === 0,
    `exit ${status} :: ${stderr.trim()}`,
  );
}

// The FR-5 records-only fixtures. The verdict sha is HEAD~1 in a real repo; what
// the single intervening commit touches is what each case varies.
const recordsOnlyFixture = (input: {
  readonly changedPath: string;
  readonly diverge: boolean;
}): { repository: MintedRepository; status: number; stderr: string } => {
  const repository = seedIntentRepository({
    recordDirName: LANDED_RECORD,
    gate: LANDED_GATE,
  });
  const reviewedSha = repository.run(["rev-parse", "HEAD"]).trim();
  writeVerdictIn(repository, LANDED_RECORD, LANDED_GATE, {
    gate: LANDED_GATE,
    taskId: "slice-records-only",
    headSha: reviewedSha,
    verdict: "READY",
    lenses: GATE_2_FLOOR,
    findings: [],
    blockingFindings: [],
    reviewedAt: "2026-08-16T00:00:00.000Z",
    emittedBy: "rin-gates-review-verdict",
    binding: { mode: "live", headSha: reviewedSha },
  });
  repository.commitAll({ message: "verdict" });
  if (input.diverge) {
    repository.run(["checkout", "-q", "-b", "divergent"]);
    writeNested(
      repository,
      recordPathIn(LANDED_RECORD, "construction", "divergent.md"),
      "divergent fold\n",
    );
    repository.commitAll({ message: "divergent" });
    repository.run(["checkout", "-q", "main"]);
    repository.run(["reset", "-q", "--hard", reviewedSha]);
    writeNested(repository, input.changedPath, "drift\n");
    repository.commitAll({ message: "drift on main" });
    writeVerdictIn(repository, LANDED_RECORD, LANDED_GATE, {
      gate: LANDED_GATE,
      taskId: "slice-records-only",
      headSha: repository.run(["rev-parse", "divergent"]).trim(),
      verdict: "READY",
      lenses: GATE_2_FLOOR,
      findings: [],
      blockingFindings: [],
      reviewedAt: "2026-08-16T00:00:00.000Z",
      emittedBy: "rin-gates-review-verdict",
      binding: {
        mode: "live",
        headSha: repository.run(["rev-parse", "divergent"]).trim(),
      },
    });
    repository.commitAll({ message: "divergent verdict" });
  } else {
    writeNested(repository, input.changedPath, "drift\n");
    repository.commitAll({ message: "drift" });
  }
  const { status, stderr } = runAutonomyHookAt(repository);
  return { repository, status, stderr };
};

// A21 — FR-5 happy path: the drift since the reviewed sha touches only the
// approving intent's OWN record dir → allow.
{
  const fixture = recordsOnlyFixture({
    changedPath: recordPathIn(LANDED_RECORD, "construction", "notes.md"),
    diverge: false,
  });
  try {
    record(
      "A21 autonomy hook allows a live verdict behind HEAD when every changed path is inside the approving intent's own record dir (exit 0)",
      fixture.status === 0,
      `exit ${fixture.status} :: ${fixture.stderr.trim().slice(0, DETAIL_WIDTH)}`,
    );
  } finally {
    fixture.repository.dispose();
  }
}

// A22 — one source file reclassifies the whole diff, however records-heavy the
// rest of it is.
{
  const fixture = recordsOnlyFixture({
    changedPath: "src/a22.ts",
    diverge: false,
  });
  try {
    record(
      "A22 autonomy hook denies records-only tolerance when the drift also touches a source file, naming that path (exit 2)",
      fixture.status === 2 &&
        fixture.stderr.includes(
          "changed path outside the approving intent's record dir",
        ) &&
        fixture.stderr.includes("src/a22.ts"),
      `exit ${fixture.status} :: ${fixture.stderr.trim().slice(0, DETAIL_WIDTH)}`,
    );
  } finally {
    fixture.repository.dispose();
  }
}

// A23 — the narrowing the wide draft allowlist admitted: ANOTHER intent's record
// dir is outside the approving intent's own.
{
  const otherPath = recordPathIn(OTHER_RECORD, "aidlc-state.md");
  const fixture = recordsOnlyFixture({
    changedPath: otherPath,
    diverge: false,
  });
  try {
    record(
      "A23 autonomy hook denies records-only tolerance when the drift touches ANOTHER intent's record dir (exit 2)",
      fixture.status === 2 &&
        fixture.stderr.includes(
          "changed path outside the approving intent's record dir",
        ) &&
        fixture.stderr.includes(OTHER_RECORD),
      `exit ${fixture.status} :: ${fixture.stderr.trim().slice(0, DETAIL_WIDTH)}`,
    );
  } finally {
    fixture.repository.dispose();
  }
}

// A24 — the ORDERING case. The reviewed sha is on a divergent branch whose diff
// to HEAD touches only the own record dir (the divergent commit writes inside
// LANDED_RECORD, per the Gate-4 board's F1 fold), so the path test WOULD have
// allowed. Ancestry runs first and denies, and the path test is never reached;
// the negative clause asserts the denial names ancestry and no changed path.
{
  const fixture = recordsOnlyFixture({
    changedPath: recordPathIn(LANDED_RECORD, "construction", "drift.md"),
    diverge: true,
  });
  try {
    record(
      "A24 autonomy hook denies a divergent-branch verdict on ANCESTRY even though its changed paths would satisfy the records-only test (exit 2, names ancestry and never reaches the path test)",
      fixture.status === 2 &&
        fixture.stderr.includes("is not an ancestor of HEAD") &&
        !fixture.stderr.includes("changed path outside"),
      `exit ${fixture.status} :: ${fixture.stderr.trim().slice(0, DETAIL_WIDTH)}`,
    );
  } finally {
    fixture.repository.dispose();
  }
}

// A25 — the trailing-slash boundary: a SIBLING record dir sharing this one's name
// as a prefix must not slip through under the date-prefixed naming scheme.
{
  const siblingPath = recordPathIn(SIBLING_RECORD, "aidlc-state.md");
  const fixture = recordsOnlyFixture({
    changedPath: siblingPath,
    diverge: false,
  });
  try {
    record(
      "A25 autonomy hook denies records-only tolerance for a sibling record dir sharing the approving intent's name prefix (exit 2)",
      fixture.status === 2 &&
        fixture.stderr.includes(
          "changed path outside the approving intent's record dir",
        ) &&
        fixture.stderr.includes(SIBLING_RECORD),
      `exit ${fixture.status} :: ${fixture.stderr.trim().slice(0, DETAIL_WIDTH)}`,
    );
  } finally {
    fixture.repository.dispose();
  }
}

// IF-13's covered-set cases. Labels run A30..A40 rather than the lock's A20..A29:
// A1-A25 are taken in this file, and IF-13 requires Gate 4 to re-check the highest
// existing label before authoring rather than trust the table's numbering. Each
// case keeps the semantics the lock pinned to it; only the label moved.
{
  const fx = autonomyFixture("a30", {
    scope: "rin-harness",
    taskId: "slice-a30",
    gate: "rin-gate-2-plan-review",
  });
  const { status, stderr } = runAutonomyHook(fx.root, REPORT_CMD);
  record(
    "A30 autonomy hook denies a lean family member's approve carrying no review verdict, proving coverage is derived from the grid rather than pinned to rin-gates (exit 2)",
    status === 2 && stderr.includes("no decorrelated-review verdict"),
    `exit ${status} :: ${stderr.trim().slice(0, DETAIL_WIDTH)}`,
  );
}

{
  const fx = autonomyFixture("a31", {
    scope: "rin-harness",
    taskId: "slice-a31",
    gate: "rin-gate-2-plan-review",
  });
  writeFileSync(
    verdictFilePath(fx.root),
    readyVerdict("slice-a31", fx.head),
    "utf-8",
  );
  const { status, stderr } = runAutonomyHook(fx.root, REPORT_CMD);
  record(
    "A31 autonomy hook allows a lean family member's approve carrying a fresh emitter-stamped READY verdict (exit 0)",
    status === 0,
    `exit ${status} :: ${stderr.trim().slice(0, DETAIL_WIDTH)}`,
  );
}

{
  const fx = autonomyFixture("a32", {
    scope: "rin-audit",
    taskId: "slice-a32",
    gate: "rin-gate-2-plan-review",
  });
  const { status, stderr } = runAutonomyHook(fx.root, REPORT_CMD);
  record(
    "A32 autonomy hook denies a SECOND lean family member with no verdict, proving the predicate covers a family rather than one enumerated scope (exit 2)",
    status === 2 && stderr.includes("no decorrelated-review verdict"),
    `exit ${status} :: ${stderr.trim().slice(0, DETAIL_WIDTH)}`,
  );
}

{
  const fx = autonomyFixture("a33", {
    scope: "rin-retired",
    taskId: "slice-a33",
    gate: "rin-gate-2-plan-review",
    grid: { "rin-retired": gridRowOf([]) },
  });
  const { status, stderr } = runAutonomyHook(fx.root, REPORT_CMD);
  record(
    "A33 autonomy hook passes through rin-retired, whose grid row skips every gate, so the retire path is never deadlocked by a verdict demand (exit 0)",
    status === 0,
    `exit ${status} :: ${stderr.trim().slice(0, DETAIL_WIDTH)}`,
  );
}

{
  const fx = autonomyFixture("a34", {
    scope: "rin-gates",
    taskId: "slice-a34",
    gate: "rin-gate-2-plan-review",
    grid: undefined,
  });
  rmSync(join(fx.root, ".claude"), { recursive: true, force: true });
  const { status, stderr } = runAutonomyHook(fx.root, REPORT_CMD);
  record(
    "A34 autonomy hook still denies a verdict-less rin-gates approve when the grid is absent, the fallback covering rin-gates alone (exit 2)",
    status === 2 && stderr.includes("no decorrelated-review verdict"),
    `exit ${status} :: ${stderr.trim().slice(0, DETAIL_WIDTH)}`,
  );
}

{
  const fx = autonomyFixture("a35", {
    scope: "feature",
    taskId: "slice-a35",
    gate: "rin-gate-2-plan-review",
  });
  const { status, stderr } = runAutonomyHook(fx.root, REPORT_CMD);
  record(
    "A35 autonomy hook passes a stock scope through when the grid is absent, so a fresh pre-sync worktree never stops the whole pipeline (exit 0)",
    status === 0,
    `exit ${status} :: ${stderr.trim().slice(0, DETAIL_WIDTH)}`,
  );
}

{
  const fx = autonomyFixture("a1b", {
    scope: "poc",
    taskId: "slice-a1b",
    gate: "rin-gate-2-plan-review",
  });
  const { status, stderr } = runAutonomyHook(fx.root, REPORT_CMD);
  record(
    "A1b autonomy hook passes a SECOND stock scope through with no verdict, so the allow face is proven on more than one stock name (exit 0)",
    status === 0,
    `exit ${status} :: ${stderr.trim().slice(0, DETAIL_WIDTH)}`,
  );
}

{
  const fx = autonomyFixture("a36", {
    scope: "rin-ops",
    taskId: "slice-a36",
    gate: "rin-gate-2-plan-review",
    grid: {
      "rin-ops": {
        stages: {
          ...gridRowOf(["rin-gate-4-implement"]).stages,
          [GATE_5_STAGE]: "SKIP",
        },
      },
    },
  });
  const { status, stderr } = runAutonomyHook(fx.root, REPORT_CMD);
  record(
    "A36 autonomy hook passes through a row holding Gate-4 EXECUTE with Gate-5 SKIP, distinguishing a predicate keyed on Gate 5 from one keyed on Gate 4 (exit 0)",
    status === 0,
    `exit ${status} :: ${stderr.trim().slice(0, DETAIL_WIDTH)}`,
  );
}

{
  const fx = autonomyFixture("a37", {
    scope: "rin-harness",
    taskId: "slice-a37",
    gate: "rin-gate-2-plan-review",
    grid: {
      "rin-harness": { stages: { "rin-gate-4-implement": "EXECUTE" } },
    },
  });
  const { status, stderr } = runAutonomyHook(fx.root, REPORT_CMD);
  record(
    "A37 autonomy hook denies a well-formed row whose stages map holds no Gate-5 key, separating cannot-tell from positively-not-covered (exit 2)",
    status === 2 && stderr.includes("holds no"),
    `exit ${status} :: ${stderr.trim().slice(0, DETAIL_WIDTH)}`,
  );
}

{
  const fx = autonomyFixture("a38", {
    scope: "rin-harness",
    taskId: "slice-a38",
    gate: "rin-gate-2-plan-review",
    grid: { "rin-harness": { stages: { [GATE_5_STAGE]: "execute" } } },
  });
  const { status, stderr } = runAutonomyHook(fx.root, REPORT_CMD);
  record(
    "A38 autonomy hook denies a Gate-5 cell holding a value outside the EXECUTE/SKIP union, which the on-disk merge path admits without validating (exit 2)",
    status === 2 && stderr.includes("uninterpretable"),
    `exit ${status} :: ${stderr.trim().slice(0, DETAIL_WIDTH)}`,
  );
}

{
  const fx = autonomyFixture("a39", {
    scope: "rin-gates",
    taskId: "slice-a39",
    gate: "rin-gate-2-plan-review",
    grid: { "rin-harness": COVERED_GRID_ROW },
  });
  const { status, stderr } = runAutonomyHook(fx.root, REPORT_CMD);
  record(
    "A39 autonomy hook denies a verdict-less rin-gates approve against a well-formed grid carrying no rin-gates row, the pinned name surviving as a floor beneath the derived set (exit 2)",
    status === 2 && stderr.includes("carries no 'rin-gates' row"),
    `exit ${status} :: ${stderr.trim().slice(0, DETAIL_WIDTH)}`,
  );
}

{
  const fx = autonomyFixture("a40", {
    scope: "rin-gates",
    taskId: "slice-a40",
    gate: "rin-gate-2-plan-review",
    grid: {
      "rin-gates": {
        stages: {
          ...gridRowOf(["rin-gate-4-implement"]).stages,
          [GATE_5_STAGE]: "SKIP",
        },
      },
    },
  });
  const { status, stderr } = runAutonomyHook(fx.root, REPORT_CMD);
  record(
    "A40 autonomy hook denies a verdict-less rin-gates approve even when its own grid row flips Gate 5 to SKIP, so the floor is unconditional over the derived answer rather than applying only where a row is absent (exit 2)",
    status === 2 && stderr.includes("never un-gated by its own grid row"),
    `exit ${status} :: ${stderr.trim().slice(0, DETAIL_WIDTH)}`,
  );
}

// The emitter's `gh` half has no local ground truth to mint, so the E-series
// fakes exactly that one call through a stub `gh` placed first on PATH. Real git
// still computes the digest; RIN_GATES_WORKSPACE_ROOT pins every read to the
// minted repository.
//
// The PR number is deliberately one that cannot exist on the real repository. A
// stub that failed to intercept would then reach real `gh`, get "no pull requests
// found", and FAIL the case loudly — rather than coincidentally agreeing with
// whatever a real PR of that number happens to say today. That coincidence is the
// shape of a passing test that proves nothing, and this is what forecloses it.
const STUB_ONLY_PULL_REQUEST = "99000561";
const stubGhIn = (
  repository: MintedRepository,
  view: Record<string, unknown>,
): string => {
  const binDir = join(dirname(repository.path), "stub-bin");
  mkdirSync(binDir, { recursive: true });
  const payload = JSON.stringify(view).replace(/'/g, "'\\''");
  writeFileSync(join(binDir, "gh"), `#!/bin/sh\nprintf '%s' '${payload}'\n`, {
    encoding: "utf-8",
    mode: STUB_EXECUTABLE_MODE,
  });
  writeFileSync(
    join(binDir, "gh.cmd"),
    `@echo off\r\nbun -e "process.stdout.write(process.env.RIN_GATES_STUB_GH_VIEW)"\r\n`,
    "utf-8",
  );
  return binDir;
};

const runEmitterAt = (input: {
  readonly repository: MintedRepository;
  readonly args: readonly string[];
  readonly ghView?: Record<string, unknown>;
}): { status: number; stdout: string; stderr: string } => {
  const binDir =
    input.ghView === undefined
      ? undefined
      : stubGhIn(input.repository, input.ghView);
  const environment = tier2Environment(input.repository, {
    RIN_GATES_VERDICT_EMITTER: "1",
    RIN_GATES_WORKSPACE_ROOT: input.repository.path,
    RIN_GATES_SPACE: "default",
  });
  if (binDir !== undefined) {
    environment.PATH = `${binDir}${process.platform === "win32" ? ";" : ":"}${environment.PATH ?? ""}`;
    environment.RIN_GATES_STUB_GH_VIEW = JSON.stringify(input.ghView);
  }
  const out = spawnSync("bun", [VERDICT_EMITTER, ...input.args], {
    cwd: input.repository.path,
    encoding: "utf-8",
    env: environment,
  });
  return {
    status: out.status ?? -1,
    stdout: out.stdout ?? "",
    stderr: out.stderr ?? "",
  };
};

const emittedVerdictIn = (
  repository: MintedRepository,
  recordDirName: string,
  gate: string,
): Record<string, unknown> | null => {
  const path = join(
    repository.path,
    ...RECORD_RELATIVE,
    recordDirName,
    "inception",
    gate,
    "review-verdict.json",
  );
  return existsSync(path) ? JSON.parse(readFileSync(path, "utf-8")) : null;
};

const landedEmitterArgs = (input: {
  readonly mergeCommitSha: string;
  readonly reviewedHeadSha: string;
}): readonly string[] => [
  "--record-dir",
  LANDED_RECORD,
  "--gate",
  LANDED_GATE,
  "--task-id",
  "slice-e",
  "--verdict",
  "READY",
  "--lenses",
  GATE_2_FLOOR.join(","),
  "--pr",
  STUB_ONLY_PULL_REQUEST,
  "--reviewed-head-sha",
  input.reviewedHeadSha,
  "--merge-commit-sha",
  input.mergeCommitSha,
];

const REVIEWED_HEAD_SHA = "beef1111beef1111beef1111beef1111beef1111";
// FR-3's retro-unstick records when the review actually happened, not when the
// retro ran — which is the whole reason --reviewed-at is accepted on the landed
// path and refused on the live one.
const RETRO_REVIEWED_AT = "2026-08-01T12:34:56.000Z";

// E1 — the emitter's landed happy path: a merged PR whose shas agree yields a
// stamped landed verdict whose digest equals an independently computed sha256 of
// the merge patch, with NO top-level headSha / diffDigest / base.
{
  const repository = seedIntentRepository({
    recordDirName: LANDED_RECORD,
    gate: LANDED_GATE,
  });
  try {
    const mergeSha = seedMergedBranch({
      repository,
      branch: "feature-e1",
      mutatedLine: "export const echo = 51;",
      mergeIntoHead: true,
    });
    const expected = mergePatchDigestIn(repository, mergeSha);
    const out = runEmitterAt({
      repository,
      args: [
        ...landedEmitterArgs({
          mergeCommitSha: mergeSha,
          reviewedHeadSha: REVIEWED_HEAD_SHA,
        }),
        "--reviewed-at",
        RETRO_REVIEWED_AT,
      ],
      ghView: {
        state: "MERGED",
        headRefOid: REVIEWED_HEAD_SHA,
        mergeCommit: { oid: mergeSha },
      },
    });
    const written = emittedVerdictIn(repository, LANDED_RECORD, LANDED_GATE);
    const binding =
      written === null ? null : (written.binding as Record<string, unknown>);
    record(
      "E1 emitter writes a landed verdict whose digest equals an independently computed sha256 of the merge patch, records the supplied --reviewed-at, and omits top-level headSha/diffDigest/base (exit 0)",
      out.status === 0 &&
        binding?.mode === "landed" &&
        binding?.diffDigest === expected &&
        binding?.mergeCommitSha === mergeSha &&
        written?.emittedBy === "rin-gates-review-verdict" &&
        written?.reviewedAt === RETRO_REVIEWED_AT &&
        written?.headSha === undefined &&
        written?.diffDigest === undefined &&
        written?.base === undefined,
      written === null
        ? out.stderr.trim().slice(0, WIDE_DETAIL_WIDTH)
        : `digest-matches=${binding?.diffDigest === expected} reviewedAt=${String(written.reviewedAt)} top-level-headSha=${String(written.headSha)}`,
    );
  } finally {
    repository.dispose();
  }
}

// E2 — the reviewed head does not match the PR's head → refuse, exit 1, and
// crucially write NOTHING.
{
  const repository = seedIntentRepository({
    recordDirName: LANDED_RECORD,
    gate: LANDED_GATE,
  });
  try {
    const mergeSha = seedMergedBranch({
      repository,
      branch: "feature-e2",
      mutatedLine: "export const echo = 52;",
      mergeIntoHead: true,
    });
    const out = runEmitterAt({
      repository,
      args: landedEmitterArgs({
        mergeCommitSha: mergeSha,
        reviewedHeadSha: REVIEWED_HEAD_SHA,
      }),
      ghView: {
        state: "MERGED",
        headRefOid: "0000000000000000000000000000000000000000",
        mergeCommit: { oid: mergeSha },
      },
    });
    const written = emittedVerdictIn(repository, LANDED_RECORD, LANDED_GATE);
    record(
      "E2 emitter refuses a landed emission whose --reviewed-head-sha is not the PR's head and writes NO verdict file (exit 1)",
      out.status === 1 &&
        written === null &&
        out.stderr.includes("is not the pull request's head"),
      `exit ${out.status} file=${written === null ? "absent" : "written"} :: ${out.stderr.trim().slice(0, DETAIL_WIDTH)}`,
    );
  } finally {
    repository.dispose();
  }
}

// E3 — the merge commit does not resolve in this clone → refuse, no file.
{
  const repository = seedIntentRepository({
    recordDirName: LANDED_RECORD,
    gate: LANDED_GATE,
  });
  try {
    const absent = "1234567890123456789012345678901234567890";
    const out = runEmitterAt({
      repository,
      args: landedEmitterArgs({
        mergeCommitSha: absent,
        reviewedHeadSha: REVIEWED_HEAD_SHA,
      }),
      ghView: {
        state: "MERGED",
        headRefOid: REVIEWED_HEAD_SHA,
        mergeCommit: { oid: absent },
      },
    });
    const written = emittedVerdictIn(repository, LANDED_RECORD, LANDED_GATE);
    record(
      "E3 emitter refuses a landed emission whose merge commit does not resolve in the clone and writes NO verdict file (exit 1)",
      out.status === 1 &&
        written === null &&
        out.stderr.includes("does not resolve in this checkout"),
      `exit ${out.status} file=${written === null ? "absent" : "written"} :: ${out.stderr.trim().slice(0, DETAIL_WIDTH)}`,
    );
  } finally {
    repository.dispose();
  }
}

// E4 — an OPEN pull request is refused naming its state, never a sha mismatch.
{
  const repository = seedIntentRepository({
    recordDirName: LANDED_RECORD,
    gate: LANDED_GATE,
  });
  try {
    const out = runEmitterAt({
      repository,
      args: landedEmitterArgs({
        mergeCommitSha: "cafe0000cafe0000cafe0000cafe0000cafe0000",
        reviewedHeadSha: REVIEWED_HEAD_SHA,
      }),
      ghView: {
        state: "OPEN",
        headRefOid: REVIEWED_HEAD_SHA,
        mergeCommit: null,
      },
    });
    const written = emittedVerdictIn(repository, LANDED_RECORD, LANDED_GATE);
    record(
      "E4 emitter refuses a landed emission against an OPEN pull request, naming the state (exit 1)",
      out.status === 1 &&
        written === null &&
        out.stderr.includes("state is 'OPEN'"),
      `exit ${out.status} :: ${out.stderr.trim().slice(0, DETAIL_WIDTH)}`,
    );
  } finally {
    repository.dispose();
  }
}

// E5 — a PARTIAL landed flag set never silently falls back to live. Tier 1: the
// refusal precedes every read, so no repo is needed.
{
  const root = join(SANDBOX, "e5");
  mkdirSync(join(root, ...RECORD_RELATIVE, LANDED_RECORD), { recursive: true });
  const out = spawnSync(
    "bun",
    [
      VERDICT_EMITTER,
      "--record-dir",
      LANDED_RECORD,
      "--gate",
      LANDED_GATE,
      "--task-id",
      "slice-e5",
      "--verdict",
      "READY",
      "--lenses",
      "challenger",
      "--pr",
      "561",
    ],
    {
      encoding: "utf-8",
      env: {
        ...scrubbedGitEnv(),
        RIN_GATES_VERDICT_EMITTER: "1",
        RIN_GATES_WORKSPACE_ROOT: root,
        RIN_GATES_TEST_MODE: "1",
        RIN_GATES_HEAD_SHA: "deadbeefcafe",
        RIN_GATES_DIFF_DIGEST: "digest-e5",
      },
    },
  );
  const written = existsSync(
    join(
      root,
      ...RECORD_RELATIVE,
      LANDED_RECORD,
      "inception",
      LANDED_GATE,
      "review-verdict.json",
    ),
  );
  record(
    "E5 emitter refuses a PARTIAL landed flag set naming the missing flags, never falling back to live (exit 1)",
    (out.status ?? -1) === 1 &&
      !written &&
      (out.stderr ?? "").includes("--reviewed-head-sha") &&
      (out.stderr ?? "").includes("--merge-commit-sha"),
    `exit ${out.status} :: ${(out.stderr ?? "").trim().slice(0, DETAIL_WIDTH)}`,
  );
}

// E6 — the LIVE path is unchanged: the payload carries today's exact top-level
// fields in today's exact order, plus binding: { mode: "live" } carrying the same
// sha. This is the byte-comparability criterion, asserted over serialised text.
{
  const root = join(SANDBOX, "e6");
  mkdirSync(join(root, ...RECORD_RELATIVE, LANDED_RECORD), { recursive: true });
  const out = spawnSync(
    "bun",
    [
      VERDICT_EMITTER,
      "--record-dir",
      LANDED_RECORD,
      "--gate",
      LANDED_GATE,
      "--task-id",
      "slice-e6",
      "--verdict",
      "READY",
      "--lenses",
      "challenger,validator",
    ],
    {
      encoding: "utf-8",
      env: {
        ...scrubbedGitEnv(),
        RIN_GATES_VERDICT_EMITTER: "1",
        RIN_GATES_WORKSPACE_ROOT: root,
        RIN_GATES_TEST_MODE: "1",
        RIN_GATES_HEAD_SHA: "deadbeefcafe",
        RIN_GATES_DIFF_DIGEST: "digest-e6",
      },
    },
  );
  const path = join(
    root,
    ...RECORD_RELATIVE,
    LANDED_RECORD,
    "inception",
    LANDED_GATE,
    "review-verdict.json",
  );
  const written = existsSync(path)
    ? (JSON.parse(readFileSync(path, "utf-8")) as Record<string, unknown>)
    : null;
  const keys = written === null ? [] : Object.keys(written);
  record(
    "E6 emitter's LIVE payload keeps today's field set and order and gains binding: { mode: 'live' } carrying the same sha (exit 0)",
    (out.status ?? -1) === 0 &&
      keys.join(",") ===
        "gate,taskId,headSha,diffDigest,base,verdict,lenses,findings,blockingFindings,reviewedAt,emittedBy,binding" &&
      written?.headSha === "deadbeefcafe" &&
      written?.diffDigest === "digest-e6" &&
      written?.base === "origin/main" &&
      JSON.stringify(written?.binding) ===
        JSON.stringify({ mode: "live", headSha: "deadbeefcafe" }),
    written === null
      ? (out.stderr ?? "").trim().slice(0, DETAIL_WIDTH)
      : `keys=${keys.join(",")}`,
  );
}

// E7 — the shared-expression invariant. The emitter's digest and the gate's
// recomputation must agree over ONE real commit in ONE minted repository, both
// through the production code paths. A symmetric fixture would prove nothing
// about the two definitions and would pass through the one-flag divergence this
// case exists to catch.
{
  const repository = seedIntentRepository({
    recordDirName: LANDED_RECORD,
    gate: LANDED_GATE,
  });
  try {
    const mergeSha = seedMergedBranch({
      repository,
      branch: "feature-e7",
      mutatedLine: "export const echo = 57;",
      mergeIntoHead: true,
    });
    const emitted = runEmitterAt({
      repository,
      args: landedEmitterArgs({
        mergeCommitSha: mergeSha,
        reviewedHeadSha: REVIEWED_HEAD_SHA,
      }),
      ghView: {
        state: "MERGED",
        headRefOid: REVIEWED_HEAD_SHA,
        mergeCommit: { oid: mergeSha },
      },
    });
    repository.commitAll({ message: "emitted landed verdict" });
    const gateOutcome = runAutonomyHookAt(repository);
    record(
      "E7 the gate ACCEPTS the emitter's own landed verdict over one real commit — the two digest definitions agree through both production code paths (exit 0)",
      emitted.status === 0 && gateOutcome.status === 0,
      `emit=${emitted.status} gate=${gateOutcome.status} :: ${(emitted.stderr + gateOutcome.stderr).trim().slice(0, WIDE_DETAIL_WIDTH)}`,
    );
  } finally {
    repository.dispose();
  }
}

// E8 — --reviewed-at is refused on the LIVE path. A caller-supplied timestamp
// there is a freshness spoof: it would let a stale review present itself as
// having happened at whatever moment the caller names.
{
  const root = join(SANDBOX, "e8");
  mkdirSync(join(root, ...RECORD_RELATIVE, LANDED_RECORD), { recursive: true });
  const out = spawnSync(
    "bun",
    [
      VERDICT_EMITTER,
      "--record-dir",
      LANDED_RECORD,
      "--gate",
      LANDED_GATE,
      "--task-id",
      "slice-e8",
      "--verdict",
      "READY",
      "--lenses",
      "challenger",
      "--reviewed-at",
      RETRO_REVIEWED_AT,
    ],
    {
      encoding: "utf-8",
      env: {
        ...scrubbedGitEnv(),
        RIN_GATES_VERDICT_EMITTER: "1",
        RIN_GATES_WORKSPACE_ROOT: root,
        RIN_GATES_TEST_MODE: "1",
        RIN_GATES_HEAD_SHA: "deadbeefcafe",
        RIN_GATES_DIFF_DIGEST: "digest-e8",
      },
    },
  );
  const written = existsSync(
    join(
      root,
      ...RECORD_RELATIVE,
      LANDED_RECORD,
      "inception",
      LANDED_GATE,
      "review-verdict.json",
    ),
  );
  record(
    "E8 emitter refuses --reviewed-at on the LIVE path, naming it landed-path-only, and writes no verdict (exit 1)",
    (out.status ?? -1) === 1 &&
      !written &&
      (out.stderr ?? "").includes("landed-path-only"),
    `exit ${out.status} file=${written ? "written" : "absent"} :: ${(out.stderr ?? "").trim().slice(0, DETAIL_WIDTH)}`,
  );
}

// ---------------------------------------------------------------------------
rmSync(SANDBOX, { recursive: true, force: true });
const failed = results.filter((result) => !result.passed);
console.log(
  `\n${results.length - failed.length}/${results.length} derivation selftest cases passed`,
);
if (results.length < MINIMUM_CASE_FLOOR) {
  console.error(
    `derivation selftest ran ${results.length} cases, below the floor of ${MINIMUM_CASE_FLOOR} — the suite did not enumerate. Counting only failures cannot see this: a throw before the cases register, or a removed block, leaves zero failures over zero cases and exits 0.`,
  );
  process.exit(1);
}
if (failed.length > 0) process.exit(1);
