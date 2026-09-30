// rin-gates status projection — the materialized pipeline reconciliation view.
//
// Under repo-SoR the engine record dir is the SOLE system of
// record for a systems intent: stage + lifecycle live in intents.json +
// aidlc-state.md + <record>/audit/. The helen-tasks DB is an intake buffer only —
// a systems capture is promoted to a repo record once (Gate 0) and its row closed.
//
// So this projection ENUMERATES THE ENGINE, not the DB: every on-disk intent
// record (a dir holding aidlc-state.md — the engine's own visibility rule) is a
// pipeline Slice, classified by its Current Stage. The DB snapshot is consulted
// for ONE thing: the intake queue — the systems captures not yet promoted to a
// record (the Gate-0 pick list). There is no slice-binding join, no receipt read,
// and no DB-stage classification; those belonged to the retired second authority.
//
// Inputs:
//   --tasks-snapshot <file>   JSON from a live list_tasks call (raw MCP text
//                             payload or a task array). Used ONLY to compute the
//                             intake queue (unpromoted systems captures). Absent →
//                             the intake queue reports UNMEASURED, never 0: a
//                             structural zero read as a measurement silently
//                             no-op'd Gate 0's promotion duty on every run before
//                             2026-07-29 (019fa1fe-5e8c). Records still enumerate
//                             fully from the engine, so the ownership-totality
//                             gate runs with or without a snapshot.
//   --out <dir>               optional; defaults to <checkout>/aidlc — the INVOKING
//                             checkout (worktree or primary).
//
// Outputs: rin-gates-status.json + rin-gates-status.md under --out. GITIGNORED
// derived state — never committed (019f643e: committing it conflicts every pair of
// concurrent lanes). Regenerate with:
//   pnpm run rin-gates:status -- --tasks-snapshot <file>
//
// Classification per Slice (closed set):
//   in-pipeline      an engine record whose Current Stage is a gate 0..5 — the next
//                    gate is the Current Stage; the owning lane comes from the gate.
//   terminal-operate an engine record whose Current Stage is gate-6-operate — the
//                    operate lane's list (post-merge deploy/verify/close).
//   parked           an engine record parked AT ITS CURRENT STAGE — work PAUSED
//                    mid-gate and carrying a resume point, awaiting a lane to pick
//                    the handoff up.
//
//                    A PARK IS A HANDOFF, NOT A BLOCKER, AND NOT AN ELIGIBILITY
//                    FILTER. Agents are short-lived and context-bounded, so a park
//                    is the ordinary way one hands work to the next — the engine
//                    REFUSES to end a turn on a non-parked intent precisely so that
//                    stopping is never silent. Most parks are timebox or
//                    context-exhaustion handoffs; only a minority name an external
//                    blocker. A parked row in YOUR lane is MORE claimed than an
//                    untouched one, because a prior agent already spent context
//                    establishing where to resume.
//
//                    THE PREDICATE IS THE ENGINE'S, NOT A MARKER-PRESENCE TEST.
//                    `Parked` non-empty AND `Parked At Stage` === `Current Stage` —
//                    the engine's own STALE-BY-PROGRESS rule (aidlc-orchestrate.ts
//                    Branch 2.5): if the workflow advanced past the parked slug the
//                    marker is stale and is ignored. Nothing CLEARS the marker except
//                    an explicit unpark, so marker presence alone is a HISTORICAL fact
//                    ("was parked once"), never current state ("is parked now").
//   intake-queued    a systems DB capture with no promoted record yet — Gate 0's
//                    pick list (the ONLY DB-sourced class; from --tasks-snapshot).
//
// Totality gate: every gate an in-pipeline or terminal record can sit at MUST have
// an owner in transition-owners.json — an unowned gate is the "not my lane" hole
// and fails this tool loudly (exit 1). A parked record keeps its Current Stage and
// therefore its owner, so the gate stays owned; only its availability changes.
//
// Env seams (selftest hermeticity): RIN_GATES_WORKSPACE_ROOT (read root AND default
// output root), RIN_GATES_OWNERS_CONFIG, RIN_GATES_SPACE, AIDLC_STAGE_GRAPH,
// RIN_GATES_SELECTION_CONFIG, RIN_GATES_NOW.

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  gateDirSegments,
  REVIEW_VERDICT_FILENAME,
} from "./rin-gate-namespace.ts";
import {
  type BindingCoverage,
  coverageOf,
  IMPORTANCE_BINDING_FILENAME,
  type MetaTier,
  parseImportanceBinding,
  parseMetaTier,
  type ResolvedImportanceBinding,
} from "./rin-gates-importance-binding.ts";
import {
  type NeglectClock,
  readNeglectClock,
  resolveNeglectDays,
} from "./rin-gates-neglect-clock.ts";
import {
  createNodeSelectionRankingConfigReader,
  readSelectionRankingConfiguration,
  resolveSelectionRankingPath,
  type SelectionConfig,
  type SelectionRankingConfigPath,
  type SelectionRankingConfigReader,
  type SelectionRankingConfiguration,
} from "./rin-gates-selection-config.ts";
import {
  type RankedFlag,
  type RankedMilestone,
  type RankedRecord,
  rankMilestone,
  selectionOrderComparator,
} from "./rin-gates-selection-order.ts";
import {
  createNodeWorkflowUtilityExecutor,
  resolveConsumerWorkflowContext,
} from "./rin-gates-workflow-selection.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const checkoutRootFrom = (dir: string, fallback: string): string => {
  if (existsSync(join(dir, ".git"))) return dir;
  const parent = dirname(dir);
  return parent === dir ? fallback : checkoutRootFrom(parent, fallback);
};

const checkoutRootFromHere = (start: string): string =>
  checkoutRootFrom(resolve(start), resolve(start));
const PROJECT_DIR = checkoutRootFromHere(HERE);
const OWNERS_CONFIG_PATH =
  process.env["RIN_GATES_OWNERS_CONFIG"] ??
  join(HERE, "transition-owners.json");
// Seam for the same reason as OWNERS_CONFIG_PATH: without it a test's ordering
// assertions depend on the developer's real shipped config, so ratifying a
// milestone or tuning the threshold would turn a green case red with no code
// change (CD-47 — a test must not read state it did not create).
const RUN_INSTANT = (): Date => {
  const pinned = process.env["RIN_GATES_NOW"];
  if (pinned === undefined) return new Date();
  const parsed = new Date(pinned);
  if (Number.isNaN(parsed.getTime()))
    fail(`RIN_GATES_NOW must be an ISO-8601 instant (observed '${pinned}')`);
  return parsed;
};

const fail = (message: string): never => {
  console.error(`rin-gates-status: ${message}`);
  process.exit(1);
};

const argValue = (flag: string): string | null => {
  const index = process.argv.indexOf(flag);
  return index === -1 || index + 1 >= process.argv.length
    ? null
    : (process.argv[index + 1] ?? null);
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const readJson = (path: string, label: string): unknown => {
  if (!existsSync(path)) fail(`${label} not found at ${path}`);
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch (error) {
    fail(`${label} is not valid JSON (${path}): ${String(error)}`);
  }
};

const OPERATE_GATE = "rin-gate-6-operate";

type GateEntry = {
  readonly slug: string;
  readonly number: string;
  // The stage's declared `produces:`, carried through from the compiled graph
  // rather than restated here. A lane needs the EXPECTED set to read "0 of 2" as
  // "this gate's pass is owed" instead of "the record is empty" — and taking it
  // from the graph means adding an artefact to a stage file updates this
  // projection on the next compile, with no second list to drift.
  readonly produces: readonly string[];
};

// The rin gate order, read from the compiled stage-graph (the engine's own
// authority on which gates exist and in what order). The graph is engine CONFIG,
// resolved from the tool's own install checkout (PROJECT_DIR) — NOT the workspace
// being projected (CHECKOUT_ROOT), which may be a fixture or a bare records tree.
const loadGates = (): readonly GateEntry[] => {
  const path =
    process.env["AIDLC_STAGE_GRAPH"] ??
    join(PROJECT_DIR, ".claude", "tools", "data", "stage-graph.json");
  if (!existsSync(path)) return [];
  const graph = readJson(path, "stage graph");
  if (!Array.isArray(graph)) return [];
  return graph
    .filter(isRecord)
    .filter(
      (stage): stage is Record<string, unknown> & { readonly slug: string } =>
        typeof stage["slug"] === "string" &&
        stage["slug"].startsWith("rin-gate-"),
    )
    .map((stage) => ({
      slug: stage.slug,
      number: typeof stage["number"] === "string" ? stage["number"] : "",
      produces: Array.isArray(stage["produces"])
        ? stage["produces"].filter(
            (artefact): artefact is string => typeof artefact === "string",
          )
        : [],
    }));
};

const GATES = loadGates();
const GATE_SLUGS = GATES.map((g) => g.slug);

type TransitionOwner = {
  readonly gate: string;
  readonly owningLane: string;
  readonly actor: string;
  readonly requiredCapabilities: readonly string[];
};

type OwnersConfig = {
  readonly transitions: Record<string, TransitionOwner>;
  readonly doneChecks: Record<string, TransitionOwner>;
};

// gate slug → owning lane. The owners config keys transitions by DB stage but
// each entry carries its `gate`, named with the same `rin-gate-N-*` slug the
// engine's Current Stage carries, so a stage resolves its lane directly.
const laneByGate = (
  owners: OwnersConfig,
): ReadonlyMap<string, TransitionOwner> => {
  const entries = [
    ...Object.values(owners.transitions),
    ...Object.values(owners.doneChecks),
  ].map((owner): readonly [string, TransitionOwner] => [owner.gate, owner]);
  return new Map(entries);
};

type IntentRecord = {
  readonly dirName: string;
  readonly uuid: string;
  readonly status: string;
  readonly scope: string | null;
  readonly currentStage: string | null;
  readonly workflowStatus: string | null;
  readonly parkedAt: string | null;
  readonly parkedAtStage: string | null;
};

// The ranking facts a record carries, composed ALONGSIDE IntentRecord rather
// than widening it: keeping them separate is what makes it structurally
// impossible for a rung to rank on classification or owning lane (NFR-3).
type RecordRankingFacts = {
  readonly binding: ResolvedImportanceBinding;
  readonly tier: MetaTier;
  readonly clock: NeglectClock;
  readonly promotedTaskId: string | null;
  readonly readiness: RecordReadiness;
};

// Reads only the verdict token. Fail-safe to "none": an unreadable or malformed
// verdict must never present as READY, because the point of surfacing it is to
// tell a lane whether there is evidence worth testing.
const storedVerdictOf = (args: {
  readonly raw: string | null;
}): RecordReadiness["storedVerdict"] => {
  if (args.raw === null) return "none";
  const parsed = ((): unknown => {
    try {
      return JSON.parse(args.raw);
    } catch {
      return undefined;
    }
  })();
  if (!isRecord(parsed)) return "none";
  const verdict = parsed["verdict"];
  if (verdict === "READY") return "READY";
  if (verdict === "NOT-READY") return "NOT-READY";
  return "none";
};

// The gate directory and its declared artefacts both come from owned sources:
// the phase/gate path from rin-gate-namespace (the single owner of that mapping,
// so this tool cannot disagree with the emitter about where a verdict lives),
// and the expected artefact names from the compiled stage graph's `produces:`.
// The two filesystem reads arrive as an injected port so a test states the tree
// as data instead of building a real one. CD-47: a test fakes the subsystem —
// this reader's assertions are about which artefacts it COUNTS and which verdict
// token it extracts, and every one of those is expressible against a fake, so a
// real temp directory would be an unwarranted spawn (and one nothing disposes).
type RecordFileReader = {
  readonly fileExists: (path: string) => boolean;
  readonly readFile: (path: string) => string | null;
};

const nodeRecordFileReader: RecordFileReader = {
  fileExists: (path) => existsSync(path),
  readFile: (path) => readFileOrNull(path),
};

const readRecordReadiness = (args: {
  readonly recordDir: string;
  readonly currentStage: string;
  readonly produces: readonly string[];
  readonly reader?: RecordFileReader;
}): RecordReadiness => {
  const reader = args.reader ?? nodeRecordFileReader;
  const segments = gateDirSegments(args.currentStage);
  if (segments === null) {
    return {
      gateArtefactsPresent: 0,
      gateArtefactsExpected: args.produces.length,
      storedVerdict: "none",
    };
  }
  const gateDir = join(args.recordDir, segments[0], segments[1]);
  return {
    gateArtefactsPresent: args.produces.filter((artefact) =>
      reader.fileExists(join(gateDir, `${artefact}.md`)),
    ).length,
    gateArtefactsExpected: args.produces.length,
    storedVerdict: storedVerdictOf({
      raw: reader.readFile(join(gateDir, REVIEW_VERDICT_FILENAME)),
    }),
  };
};

type ResolvedRecordImportance = {
  readonly binding: ResolvedImportanceBinding;
  readonly tier: MetaTier;
};

const readRecordImportance = (args: {
  readonly raw: string | null;
}): ResolvedRecordImportance => {
  const binding = parseImportanceBinding({ raw: args.raw });
  if (binding === "unbound") return { binding, tier: { kind: "unscored" } };
  const parsed = ((): unknown => {
    try {
      return args.raw === null ? undefined : JSON.parse(args.raw);
    } catch {
      return undefined;
    }
  })();
  return { binding, tier: parseMetaTier({ parsed }) };
};

const fieldOf = (stateBody: string, label: string): string | null => {
  const match = stateBody.match(
    new RegExp(`^- \\*\\*${label}\\*\\*:\\s*(.+)$`, "m"),
  );
  return match?.[1]?.trim() ?? null;
};

type RegistryRow = {
  readonly dirName: string | null;
  readonly slug: string | null;
  readonly uuid: string;
  readonly status: string;
};

const readRegistry = (args: {
  readonly intentsRoot: string;
}): readonly RegistryRow[] => {
  const path = join(args.intentsRoot, "intents.json");
  if (!existsSync(path)) return [];
  const parsed = readJson(path, "intents registry");
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(isRecord).map((row) => ({
    dirName: typeof row["dirName"] === "string" ? row["dirName"] : null,
    slug: typeof row["slug"] === "string" ? row["slug"] : null,
    uuid: typeof row["uuid"] === "string" ? row["uuid"] : "",
    status: typeof row["status"] === "string" ? row["status"] : "unknown",
  }));
};

const readFileOrNull = (path: string): string | null =>
  existsSync(path) ? readFileSync(path, "utf-8") : null;

const readProvenance = (
  recordDir: string,
): { readonly taskId: string | null; readonly promotedAt: string | null } => {
  const raw = readFileOrNull(join(recordDir, "promoted-from.json"));
  if (raw === null) return { taskId: null, promotedAt: null };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return { taskId: null, promotedAt: null };
    return {
      taskId: typeof parsed["taskId"] === "string" ? parsed["taskId"] : null,
      promotedAt:
        typeof parsed["promotedAt"] === "string" ? parsed["promotedAt"] : null,
    };
  } catch {
    return { taskId: null, promotedAt: null };
  }
};

const readShardBodies = (recordDir: string): readonly string[] => {
  const auditDir = join(recordDir, "audit");
  if (!existsSync(auditDir)) return [];
  return readdirSync(auditDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => readFileOrNull(join(auditDir, entry.name)))
    .filter((body): body is string => body !== null);
};

// Enumerate every on-disk intent record — a dir holding aidlc-state.md, the
// engine's own visibility rule (listIntentDirs). A record with no registry row
// (an orphan, e.g. a migrated legacy Slice) still enumerates; its uuid is "".
//
// ONE per-dir pass, several consumers: the state read, the binding read, the
// provenance read (serving BOTH intake dedup and the fallback clock) and the
// shard read share this sweep rather than adding independent readdirSync passes.
const enumerateRecords = (args: {
  readonly intentsRoot: string;
}): readonly {
  readonly record: IntentRecord;
  readonly facts: RecordRankingFacts;
}[] => {
  const root = args.intentsRoot;
  if (!existsSync(root)) return [];
  const registry = readRegistry({ intentsRoot: args.intentsRoot });
  const rowByDir = new Map(
    registry
      .filter(
        (row): row is RegistryRow & { dirName: string } => row.dirName !== null,
      )
      .map((row) => [row.dirName, row] as const),
  );
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const recordDir = join(root, entry.name);
      const stateBody = readFileOrNull(join(recordDir, "aidlc-state.md"));
      if (stateBody === null) return null;
      const row = rowByDir.get(entry.name);
      const provenance = readProvenance(recordDir);
      return {
        record: {
          dirName: entry.name,
          uuid: row?.uuid ?? "",
          status: row?.status ?? "unknown",
          scope: fieldOf(stateBody, "Scope"),
          currentStage: fieldOf(stateBody, "Current Stage"),
          workflowStatus: fieldOf(stateBody, "Status"),
          parkedAt: fieldOf(stateBody, "Parked"),
          parkedAtStage: fieldOf(stateBody, "Parked At Stage"),
        },
        facts: {
          ...readRecordImportance({
            raw: readFileOrNull(join(recordDir, IMPORTANCE_BINDING_FILENAME)),
          }),
          clock: readNeglectClock({
            dirName: entry.name,
            shardBodies: readShardBodies(recordDir),
            promotedAt: provenance.promotedAt,
          }),
          promotedTaskId: provenance.taskId,
          readiness: readRecordReadiness({
            recordDir,
            currentStage: fieldOf(stateBody, "Current Stage") ?? "",
            produces:
              GATES.find(
                (gate) => gate.slug === fieldOf(stateBody, "Current Stage"),
              )?.produces ?? [],
          }),
        },
      };
    })
    .filter(
      (
        entry,
      ): entry is {
        readonly record: IntentRecord;
        readonly facts: RecordRankingFacts;
      } => entry !== null,
    );
};

type SliceClassification = "in-pipeline" | "terminal-operate" | "parked";

// What a lane otherwise hand-resolves per record before it can act: is this
// gate's work already written, and is there stored review evidence. Both are
// filesystem facts the enumerator's existing single pass already has in hand, so
// computing them here costs no extra traversal and removes a per-record `ls`
// round-trip from every lane. Measured 2026-09-01: re-deriving these by hand is
// what turned "what is the state of this record" into several turns apiece.
//
// The EXPECTED artefact set comes from the compiled stage graph's `produces:`,
// never from a list restated here — the stage file is the engine's authority and
// a second copy would drift the moment a stage gained an artefact.
//
// Deliberately NOT included: anything needing the network (an open PR) or a
// judgement (is a park's blocker still live, is a stored verdict still bound to
// current main). Those stay the lane's job — this is the mechanically-checkable
// floor, not a verdict.
type RecordReadiness = {
  readonly gateArtefactsPresent: number;
  readonly gateArtefactsExpected: number;
  // A verdict is STORED, which is not the same as BINDING: staleness needs a git
  // ancestry test against the sha inside it. Recorded so a lane knows whether
  // there is any evidence to test at all.
  readonly storedVerdict: "READY" | "NOT-READY" | "none";
};

type RecordStatus = {
  readonly dirName: string;
  readonly uuid: string;
  readonly scope: string | null;
  readonly currentStage: string;
  readonly classification: SliceClassification;
  readonly nextGate: string;
  readonly owningLane: string | null;
  readonly bindingCoverage: BindingCoverage;
  readonly neglectClockSource: NeglectClock["source"];
  readonly readiness: RecordReadiness;
  readonly rank: RecordRank;
};

// The rank each record was ordered by, carried onto the projection so a lane
// READS the ordering instead of remembering it. The tool already sorts by these
// inputs; before this they were computed in rankedRecordFor, used for the sort,
// and dropped — so the emitted table was a ranked list that looked unranked. A
// lane could not distinguish it from an arbitrary one, could not verify a
// selection, and could not cite the rank it acted on. That is how a run comes
// to re-sort the table by a key of its own and call the result selection.
type RecordRank = {
  readonly position: number;
  readonly flagged: RankedFlag;
  readonly milestone: string;
  readonly neglectDays: number;
  readonly neglectBreach: boolean;
};

const classifyRecord = ({
  currentStage,
  parkedAt,
  parkedAtStage,
}: {
  readonly currentStage: string;
  readonly parkedAt: string | null;
  readonly parkedAtStage: string | null;
}): SliceClassification => {
  const parkedNow =
    parkedAt !== null &&
    parkedAtStage !== null &&
    parkedAtStage === currentStage;
  if (parkedNow) return "parked";
  return currentStage === OPERATE_GATE ? "terminal-operate" : "in-pipeline";
};

const UNBOUND_RANKING_FACTS: RecordRankingFacts = {
  binding: "unbound",
  tier: { kind: "unscored" },
  clock: { source: "no-clock" },
  promotedTaskId: null,
  readiness: {
    gateArtefactsPresent: 0,
    gateArtefactsExpected: 0,
    storedVerdict: "none",
  },
};

// Position 0 reads as "not ranked" rather than "ranked first": callers that
// build a status outside the ordering path (the unit tests, and any future
// caller with no config) get a value that cannot be mistaken for a top pick.
// Ranks emitted by orderedRecords are 1-based for the same reason.
const UNRANKED: RecordRank = {
  position: 0,
  flagged: "unbound",
  milestone: "unbound",
  neglectDays: 0,
  neglectBreach: false,
};

const recordStatusFor = (args: {
  readonly record: IntentRecord;
  readonly owners: ReadonlyMap<string, TransitionOwner>;
  readonly facts?: RecordRankingFacts;
  readonly rank?: RecordRank;
}): RecordStatus | null => {
  const { record, owners } = args;
  const facts = args.facts ?? UNBOUND_RANKING_FACTS;
  if (record.workflowStatus === "Completed") return null;
  const currentStage = record.currentStage;
  if (currentStage === null || !GATE_SLUGS.includes(currentStage)) return null;
  const owner = owners.get(currentStage) ?? null;
  return {
    dirName: record.dirName,
    uuid: record.uuid,
    scope: record.scope,
    currentStage,
    classification: classifyRecord({
      currentStage,
      parkedAt: record.parkedAt,
      parkedAtStage: record.parkedAtStage,
    }),
    nextGate: currentStage,
    owningLane: owner?.owningLane ?? null,
    bindingCoverage: coverageOf({ binding: facts.binding }),
    neglectClockSource: facts.clock.source,
    readiness: facts.readiness,
    rank: args.rank ?? UNRANKED,
  };
};

// The milestone union rendered for a reader. `ratified` carries its list
// position, which IS its rank, so the emitted value stays orderable rather than
// becoming an opaque label.
const describeMilestone = (args: {
  readonly milestone: RankedMilestone;
  readonly ratifiedMilestones: readonly string[];
}): string => {
  switch (args.milestone.kind) {
    case "ratified":
      return args.ratifiedMilestones[args.milestone.rank] ?? "ratified";
    case "unratified":
      return "unratified";
    case "no-milestone":
      return "no-milestone";
    case "unbound":
      return "unbound";
  }
};

// The adapter: resolve each record's ranking facts into the comparator's fact
// bundle. The identifier -> list position resolution happens HERE so the
// comparator never learns the config's internals (IF-5).
const rankedRecordFor = (args: {
  readonly dirName: string;
  readonly facts: RecordRankingFacts;
  readonly config: SelectionConfig;
  readonly now: () => Date;
}): RankedRecord => {
  const { binding } = args.facts;
  return {
    dirName: args.dirName,
    flagged: binding === "unbound" ? "unbound" : binding.flagged,
    milestone: rankMilestone({
      milestone: binding === "unbound" ? "unbound" : binding.milestone,
      ratifiedMilestones: args.config.ratifiedMilestones,
    }),
    tier: args.facts.tier,
    neglectDays: resolveNeglectDays({ clock: args.facts.clock, now: args.now }),
  };
};

type IntakeCapture = {
  readonly taskId: string;
  readonly title: string;
};

// An MCP tool result arrives as a content-part envelope carrying the real payload
// as JSON text. The harness spills it either as the bare envelope object or as the
// top-level `content` array itself, so BOTH array shapes reach here: an array of
// task rows, and an array of content parts. Deciding by `Array.isArray` alone reads
// the latter as a one-row task array whose single row has no `category`, yielding a
// measured-looking `0 intake-queued` over a full queue — the false zero the
// UNMEASURED state exists to abolish, re-entering through the envelope arm.
const asContentEnvelope = (value: unknown): string | null => {
  const part = Array.isArray(value) ? value[0] : value;
  if (!isRecord(part)) return null;
  return typeof part["text"] === "string" ? part["text"] : null;
};

const extractTaskArray = (
  snapshot: unknown,
): readonly Record<string, unknown>[] => {
  const envelopeText = asContentEnvelope(snapshot);
  if (envelopeText !== null) {
    try {
      return extractTaskArray(JSON.parse(envelopeText));
    } catch {
      return fail("tasks snapshot content text is not valid JSON");
    }
  }
  if (Array.isArray(snapshot)) return snapshot.filter(isRecord);
  if (isRecord(snapshot)) {
    const candidates = [
      snapshot["tasks"],
      snapshot["items"],
      snapshot["result"],
    ];
    const found = candidates.find(Array.isArray);
    if (found !== undefined) return found.filter(isRecord);
    const content = snapshot["content"];
    const nestedText = asContentEnvelope(content);
    if (nestedText !== null) {
      try {
        return extractTaskArray(JSON.parse(nestedText));
      } catch {
        return fail("tasks snapshot content[0].text is not valid JSON");
      }
    }
  }
  return fail("tasks snapshot has no recognisable task array");
};

// The set of taskIds already promoted to a record — taken from the SINGLE
// per-dir sweep's provenance read rather than a second readdirSync pass, so
// promoted-from.json is read once and serves both intake dedup and the
// fallback neglect clock (IF-9).
const promotedTaskIdsFrom = (
  entries: readonly { readonly facts: RecordRankingFacts }[],
): ReadonlySet<string> =>
  new Set(
    entries
      .map((entry) => entry.facts.promotedTaskId)
      .filter((id): id is string => id !== null),
  );

// The intake predicate, pure and exported so the ruling it encodes is testable.
// A capture is Gate-0 intake iff it is a live `systems` row carrying NO stage and
// not already promoted. The absent stage is the POINT, not an edge case: the
// standing ruling is that anything in `systems` is Gate 0's job whether or not the
// capture remembered to include a stage, so the stage-bearing rows are the ones
// some other lane already owns.
const selectIntakeCaptures = (args: {
  readonly tasks: readonly Record<string, unknown>[];
  readonly promotedTaskIds: ReadonlySet<string>;
}): readonly IntakeCapture[] =>
  args.tasks
    .filter((task) => task["category"] === "systems")
    .filter((task) => task["stage"] === null || task["stage"] === undefined)
    .filter(
      (task) => task["archivedAt"] === null || task["archivedAt"] === undefined,
    )
    .map((task): IntakeCapture | null => {
      const taskId = typeof task["id"] === "string" ? task["id"] : null;
      if (taskId === null || args.promotedTaskIds.has(taskId)) return null;
      const title = typeof task["title"] === "string" ? task["title"] : taskId;
      return { taskId, title };
    })
    .filter((capture): capture is IntakeCapture => capture !== null);

// The intake queue is either MEASURED from a live snapshot or UNMEASURED — never
// silently zero. Collapsing "no snapshot" to an empty list is what let Gate 0 read
// a structural guarantee as a measurement and no-op its promotion duty for every
// run before 2026-07-29 (019fa1fe-5e8c).
type IntakeQueue =
  | { readonly kind: "measured"; readonly captures: readonly IntakeCapture[] }
  | { readonly kind: "unmeasured" };

const intakeQueue = (args: {
  readonly snapshotPath: string | null;
  readonly promotedTaskIds: ReadonlySet<string>;
}): IntakeQueue =>
  args.snapshotPath === null
    ? { kind: "unmeasured" }
    : {
        kind: "measured",
        captures: selectIntakeCaptures({
          tasks: extractTaskArray(
            readJson(args.snapshotPath, "tasks snapshot"),
          ),
          promotedTaskIds: args.promotedTaskIds,
        }),
      };

const describeIntake = (intake: IntakeQueue): string =>
  intake.kind === "measured"
    ? `${intake.captures.length} intake-queued`
    : "intake-queue UNMEASURED (no --tasks-snapshot)";

const checkTotality = (records: readonly RecordStatus[]): readonly string[] =>
  records
    .filter((record) => record.owningLane === null)
    .map(
      (record) =>
        `gate '${record.currentStage}' (record ${record.dirName}) has no owner in transition-owners.json`,
    );

// The gate's own work, stated so a lane does not `ls` the record dir to find out.
// "0/2" means this gate's pass is OWED, never that the record is empty — a
// promoted record already carries its intake framing and importance binding, and
// reading an artefact count as emptiness is how seven fully-framed records were
// once reported as "never started". "2/2" means the artefacts are written and the
// gate's remaining work is its review and completion report. A gate declaring no
// artefacts renders "—" rather than a misleading "0/0".
const describeGateWork = (args: {
  readonly readiness: RecordReadiness;
}): string =>
  args.readiness.gateArtefactsExpected === 0
    ? "—"
    : `${args.readiness.gateArtefactsPresent}/${args.readiness.gateArtefactsExpected}`;

// A breach is marked in the cell rather than left for the reader to derive by
// comparing against a threshold they would have to remember — the same failure
// this whole change exists to remove, one column down.
// Rounded for DISPLAY only. `neglectDays` stays the full float the comparator
// ranked on, because rounding the ranked value would silently reorder records
// that differ by hours; a reader needs "28d", not "28.49545616898148d".
const describeNeglect = (args: { readonly rank: RecordRank }): string =>
  args.rank.neglectBreach
    ? `${Math.floor(args.rank.neglectDays)}d BREACH`
    : `${Math.floor(args.rank.neglectDays)}d`;

// The ordering, stated in the artefact a lane reads at run start rather than
// left in a rules file the lane must remember to open. The tiers are derived
// from the live config, so this prose cannot drift from the comparator's
// thresholds the way a hand-maintained copy would.
const describeSelectionOrder = (args: {
  readonly config: SelectionConfig;
}): readonly string[] => [
  `**Rows are in ratified selection order.** Tiers, in order: neglect BREACH (\`>= ${args.config.neglectThresholdDays}d\`), then operator-flagged, then milestone rank (${args.config.ratifiedMilestones.join(" > ")}), then neglect age, then the record directory name as a final tiebreak.`,
  "",
  "Two consequences worth reading off the table rather than re-deriving. A high neglect age does NOT outrank a flag unless it BREACHES, so an unbreached 28d record loses to a flagged 2d one. And the milestone tier decides only between two RATIFIED milestones — a `no-milestone` record does not lose to an `M1` here; it skips the tier and is settled on neglect age instead, which is why unbound records can sit above milestone-bound ones.",
  "",
  "Take the first row eligible for your lane; do NOT re-sort by any key of your own, and cite the `#` you acted on. A run that re-sorts this table has replaced the ratified ordering with one it invented — which is the defect this column set exists to prevent.",
  "",
  "**Eligibility is the `owning lane` column, and NOTHING else.** In particular `classification` is NOT an eligibility filter: `parked` means work was PAUSED mid-gate with a resume point recorded, not that it is blocked. Agents are short-lived, so a park is the ordinary handoff between them — the engine refuses to end a turn on a non-parked intent so that stopping is never silent. Most parks are timebox or context handoffs; only a minority name an external blocker, and that blocker is named in the record, not in this column. **A parked row in your lane is MORE claimed than an untouched one**, because a prior agent already spent context establishing where to resume — resuming it is usually the cheapest work available.",
  "",
  "Select by the owning lane and ratified order; filtering only to `in-pipeline` would exclude resumable parked work.",
  "",
  "**`gate work`** — how many of THIS gate's declared `produces:` artefacts are already on disk, read from the compiled stage graph (the stage file is the authority; this table restates no artefact list of its own). `0/2` means the pass is OWED — it does NOT mean the record is empty: a promoted record already carries its `intake-framing.md` and `importance-binding.json`, and reading an artefact count as emptiness is how seven fully-framed records were once reported as \"never started\". `2/2` means the artefacts are written and what remains is the gate's review and completion. `—` means this gate declares no artefacts.",
  "",
  "**`stored verdict`** — whether a review verdict sits at this gate, and what it says. **STORED IS NOT BINDING**: a verdict authorises a completion only while its `headSha` is an ancestor of the head you are acting on, so test it (`git merge-base --is-ancestor <headSha> origin/main`) before treating `NOT-READY` as a live blocker or `READY` as usable. A malformed or unreadable verdict reads `none`, never `READY`.",
  "",
];

const renderMarkdown = (args: {
  readonly records: readonly RecordStatus[];
  readonly intake: IntakeQueue;
  readonly generatedFrom: string;
  readonly config: SelectionConfig;
  readonly selectionRankingConfigPath: SelectionRankingConfigPath;
  readonly space: string;
}): string => {
  const { records, intake, generatedFrom } = args;
  const counts = records.reduce<Record<string, number>>((acc, record) => {
    acc[record.classification] = (acc[record.classification] ?? 0) + 1;
    return acc;
  }, {});
  const summaryLine = [
    describeIntake(intake),
    ...Object.entries(counts).map(([cls, count]) => `${cls}: ${count}`),
  ].join(" · ");
  const recordRows = records.map(
    (record) =>
      `| ${record.rank.position || "—"} | ${record.dirName} | ${record.uuid || "—"} | ${record.scope ?? "—"} | ${record.currentStage} | ${record.classification} | ${record.owningLane ?? "—"} | ${record.rank.flagged} | ${record.rank.milestone} | ${describeNeglect({ rank: record.rank })} | ${describeGateWork({ readiness: record.readiness })} | ${record.readiness.storedVerdict} |`,
  );
  const intakeSection =
    intake.kind === "measured"
      ? [
          "| taskId | title |",
          "|---|---|",
          ...intake.captures.map(
            (capture) =>
              `| ${capture.taskId} | ${capture.title.replace(/\|/g, "\\|")} |`,
          ),
        ]
      : [
          "**UNMEASURED — this run passed no `--tasks-snapshot`.** The queue is not",
          "empty; it was not read. Regenerate with a live snapshot before treating",
          "intake as resolved (019fa1fe-5e8c).",
        ];
  return [
    "# rin-gates pipeline status",
    "",
    `Regenerable projection of the ENGINE record (repo-SoR). Records enumerate from intents.json + aidlc-state.md Current Stage; the intake queue is the unpromoted systems captures from the DB snapshot. Regenerate with \`pnpm run rin-gates:status -- --tasks-snapshot <file>\`. Snapshot: ${generatedFrom}.`,
    "",
    `Selection ranking policy: ${args.selectionRankingConfigPath}. Selected space: ${args.space}.`,
    "",
    `**${records.length} pipeline records + ${describeIntake(intake)}** — ${summaryLine}`,
    "",
    "## Pipeline records (engine-owned)",
    "",
    ...describeSelectionOrder({ config: args.config }),
    "| # | record | uuid | scope | current stage | classification | owning lane | flagged | milestone | neglect | gate work | stored verdict |",
    "|---|---|---|---|---|---|---|---|---|---|---|---|",
    ...recordRows,
    "",
    "## Intake queue (unpromoted systems captures — Gate 0's pick list)",
    "",
    ...intakeSection,
    "",
  ].join("\n");
};

// One parse per run, at the composition root (CD-45). A malformed config is a
// NAMED failure, never a silent empty list: empty-because-shipped-empty and
// empty-because-corrupt must stay distinguishable, since the shipped state IS
// the empty list.
const orderedRecords = (args: {
  readonly enumerated: readonly {
    readonly record: IntentRecord;
    readonly facts: RecordRankingFacts;
  }[];
  readonly laneMap: ReadonlyMap<string, TransitionOwner>;
  readonly config: SelectionConfig;
  readonly now: () => Date;
}): readonly RecordStatus[] => {
  const compare = selectionOrderComparator({ config: args.config });
  const rankByDirName = new Map(
    args.enumerated.map(
      (entry) =>
        [
          entry.record.dirName,
          rankedRecordFor({
            dirName: entry.record.dirName,
            facts: entry.facts,
            config: args.config,
            now: args.now,
          }),
        ] as const,
    ),
  );
  return args.enumerated
    .map((entry) =>
      recordStatusFor({
        record: entry.record,
        owners: args.laneMap,
        facts: entry.facts,
      }),
    )
    .filter((status): status is RecordStatus => status !== null)
    .slice()
    .sort((left, right) => {
      const leftRank = rankByDirName.get(left.dirName);
      const rightRank = rankByDirName.get(right.dirName);
      return leftRank === undefined || rightRank === undefined
        ? left.dirName.localeCompare(right.dirName)
        : compare(leftRank, rightRank);
    })
    .map((status, index) => {
      const ranked = rankByDirName.get(status.dirName);
      if (ranked === undefined) return status;
      return {
        ...status,
        rank: {
          position: index + 1,
          flagged: ranked.flagged,
          milestone: describeMilestone({
            milestone: ranked.milestone,
            ratifiedMilestones: args.config.ratifiedMilestones,
          }),
          neglectDays: ranked.neglectDays,
          neglectBreach: ranked.neglectDays >= args.config.neglectThresholdDays,
        },
      };
    });
};

const selectedRankingConfiguration = (args: {
  readonly toolsDir: string;
  readonly rawConfiguredPath: string | undefined;
  readonly selectionRankingConfigReader: SelectionRankingConfigReader;
}): SelectionRankingConfiguration => {
  const selectionRankingPath = resolveSelectionRankingPath({
    toolsDir: args.toolsDir,
    rawConfiguredPath: args.rawConfiguredPath,
  });
  if (selectionRankingPath.outcome === "failed") {
    return fail(
      `selection ranking path failed: ${JSON.stringify(selectionRankingPath.selectionRankingPathFailure)}`,
    );
  }
  const selectionRankingRead = readSelectionRankingConfiguration({
    selectionRankingConfigPath:
      selectionRankingPath.selectionRankingPath.selectionRankingConfigPath,
    selectionRankingConfigReader: args.selectionRankingConfigReader,
  });
  if (selectionRankingRead.outcome === "failed") {
    return fail(
      `selection ranking read failed: ${JSON.stringify(selectionRankingRead.selectionRankingReadFailure)}`,
    );
  }
  return selectionRankingRead.selectionRankingConfiguration;
};

const writeStatusProjection = (args: {
  readonly outDir: string;
  readonly generatedFrom: string;
  readonly space: string;
  readonly selectionRankingConfigPath: SelectionRankingConfigPath;
  readonly intake: IntakeQueue;
  readonly records: readonly RecordStatus[];
  readonly config: SelectionConfig;
}): void => {
  mkdirSync(args.outDir, { recursive: true });
  const jsonPath = join(args.outDir, "rin-gates-status.json");
  const markdownPath = join(args.outDir, "rin-gates-status.md");
  writeFileSync(
    jsonPath,
    `${JSON.stringify(
      {
        generatedFrom: args.generatedFrom,
        space: args.space,
        selectionRankingConfigPath: args.selectionRankingConfigPath,
        intakeMeasured: args.intake.kind === "measured",
        records: args.records,
        intake: args.intake.kind === "measured" ? args.intake.captures : [],
      },
      null,
      2,
    )}\n`,
    "utf-8",
  );
  writeFileSync(
    markdownPath,
    renderMarkdown({
      records: args.records,
      intake: args.intake,
      generatedFrom: args.generatedFrom,
      config: args.config,
      selectionRankingConfigPath: args.selectionRankingConfigPath,
      space: args.space,
    }),
    "utf-8",
  );
  console.log(
    `rin-gates-status: ${args.records.length} pipeline records + ${describeIntake(args.intake)} → ${jsonPath} + ${markdownPath}`,
  );
};

const assertOwnershipTotality = (records: readonly RecordStatus[]): void => {
  const totalityGaps = checkTotality(records);
  if (totalityGaps.length > 0) {
    fail(`gate ownership is not total:\n  ${totalityGaps.join("\n  ")}`);
  }
};

const run = (): void => {
  const snapshotPath = argValue("--tasks-snapshot");
  const consumerRoot = process.env["RIN_GATES_WORKSPACE_ROOT"] ?? PROJECT_DIR;
  const engineUtilityPath =
    process.env["RIN_GATES_ENGINE_CLI"] ??
    join(PROJECT_DIR, ".claude", "tools", "aidlc-utility.ts");
  const workflowSelection = resolveConsumerWorkflowContext({
    consumerRoot,
    engineUtilityPath,
    rawSelectedSpace: process.env["RIN_GATES_SPACE"],
    executor: createNodeWorkflowUtilityExecutor(),
  });
  const { intentsRoot, space } =
    workflowSelection.outcome === "failed"
      ? fail(
          `workflow selection failed: ${JSON.stringify(workflowSelection.consumerSpaceSelectionFailure)}`,
        )
      : workflowSelection.consumerWorkflowContext;
  const selectionRankingConfiguration = selectedRankingConfiguration({
    toolsDir: HERE,
    rawConfiguredPath: process.env["RIN_GATES_SELECTION_CONFIG"],
    selectionRankingConfigReader: createNodeSelectionRankingConfigReader(),
  });
  const { selectionRankingConfigPath, selectionConfig: config } =
    selectionRankingConfiguration;
  const outDir = argValue("--out") ?? join(consumerRoot, "aidlc");

  const laneMap = laneByGate(
    readJson(OWNERS_CONFIG_PATH, "transition owners") as OwnersConfig,
  );

  const enumerated = enumerateRecords({ intentsRoot });
  const records = orderedRecords({
    enumerated,
    laneMap,
    config,
    now: RUN_INSTANT,
  });

  assertOwnershipTotality(records);

  const intake = intakeQueue({
    snapshotPath,
    promotedTaskIds: promotedTaskIdsFrom(enumerated),
  });

  writeStatusProjection({
    outDir,
    generatedFrom:
      snapshotPath ?? "(no snapshot — intake queue UNMEASURED, not empty)",
    space,
    selectionRankingConfigPath,
    intake,
    records,
    config,
  });
};

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  run();
}

export {
  describeGateWork,
  describeMilestone,
  describeNeglect,
  extractTaskArray,
  type IntakeCapture,
  type IntentRecord,
  orderedRecords,
  type RecordRank,
  type RecordRankingFacts,
  type RecordReadiness,
  type RecordStatus,
  readRecordImportance,
  readRecordReadiness,
  recordStatusFor,
  selectIntakeCaptures,
  type TransitionOwner,
};
