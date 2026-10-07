import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  IMPORTANCE_BINDING_FILENAME,
  type LaneFlag,
  type MetaTier,
  type MilestoneBinding,
  parseMetaTier,
  renderImportanceBinding,
  type TierValue,
  violatesMilestoneTierExclusion,
  type WritableImportanceBinding,
} from "./rin-gates-importance-binding.ts";
import {
  createNodeSelectionRankingConfigReader,
  type RatifiedMilestones,
  readSelectionRankingConfiguration,
  resolveSelectionRankingPath,
  type SelectionRankingConfigReader,
  type SelectionRankingConfiguration,
} from "./rin-gates-selection-config.ts";
import {
  assessTierClaim,
  parseTierClaim,
  type TierClaim,
} from "./rin-gates-tier-claim.ts";
import {
  parseRebindRequest,
  type RebindOutcome,
  type RebindPorts,
  rebindTier,
  renderRebindFailure,
  renderRebindOutcome,
} from "./rin-gates-tier-rebind.ts";
import {
  type ConsumerWorkflowContext,
  createNodeWorkflowUtilityExecutor,
  resolveConsumerWorkflowContext,
  type WorkflowUtilityExecutor,
} from "./rin-gates-workflow-selection.ts";

type Result<T, E> =
  | { readonly outcome: "ok"; readonly value: T }
  | { readonly outcome: "failed"; readonly error: E };

const succeed = <T>(value: T): Result<T, never> => ({ outcome: "ok", value });
const failWith = <E>(error: E): Result<never, E> => ({
  outcome: "failed",
  error,
});

type LaneImportance = {
  readonly flagged: LaneFlag;
  readonly milestone: MilestoneBinding;
  readonly tier: MetaTier;
};

type PromoteRequest = {
  readonly taskId: string;
  readonly label: string;
  readonly scope: string;
  readonly importance: LaneImportance;
  readonly tierClaim: TierClaim | null;
  readonly promotionArguments: string | null;
  readonly dryRun: boolean;
};

type PendingClose = {
  readonly taskId: string;
  readonly recordDirName: string;
  readonly archiveReason: string;
};

type PromoteOutcome =
  | {
      readonly kind: "already-promoted";
      readonly recordDirName: string;
      readonly pendingClose: PendingClose;
    }
  | {
      readonly kind: "promoted";
      readonly recordDirName: string;
      readonly pendingClose: PendingClose;
    }
  | {
      readonly kind: "planned";
      readonly taskId: string;
      readonly scope: string;
    };

type BindingWriteFailure =
  | { readonly kind: "record-dir-absent"; readonly recordDirName: string }
  | {
      readonly kind: "binding-write-failed";
      readonly recordDirName: string;
      readonly detail: string;
    };

type PromoteFailure =
  | { readonly kind: "missing-argument"; readonly flag: string }
  | { readonly kind: "unreadable-provenance"; readonly path: string }
  | { readonly kind: "intent-birth-failed"; readonly detail: string }
  | {
      readonly kind: "promotion-arguments-too-long";
      readonly length: number;
      readonly limit: number;
    }
  | { readonly kind: "record-dir-unresolvable"; readonly engineOutput: string }
  | {
      readonly kind: "provenance-write-failed";
      readonly recordDirName: string;
      readonly detail: string;
    }
  | { readonly kind: "malformed-importance"; readonly received: string }
  | {
      readonly kind: "operator-flag-not-lane-writable";
      readonly received: string;
    }
  | {
      readonly kind: "unscored-tier-on-no-milestone";
      readonly received: string;
    }
  | {
      readonly kind: "ratified-milestone-with-scored-tier";
      readonly milestoneIdentifier: string;
      readonly tier: TierValue;
    }
  | { readonly kind: "malformed-tier-claim"; readonly received: string }
  | BindingWriteFailure;

type BindingWriteOutcome = "created" | "replaced";

type IntentBirthRequest = {
  readonly scope: string;
  readonly label: string;
  readonly promotionArguments: string | null;
  readonly workspaceRoot: string;
};

type PromotePorts = {
  readonly listRecordDirNames: () => readonly string[];
  readonly readProvenanceTaskId: (
    recordDirName: string,
  ) => Result<string | null, string>;
  readonly birthIntent: (
    request: IntentBirthRequest,
  ) => Result<string, PromoteFailure>;
  readonly writeProvenance: (args: {
    readonly recordDirName: string;
    readonly taskId: string;
  }) => Result<void, string>;
  readonly writeImportanceBinding: (args: {
    readonly recordDirName: string;
    readonly binding: WritableImportanceBinding;
  }) => Result<BindingWriteOutcome, BindingWriteFailure>;
};

const archiveReasonFor = (recordDirName: string): string =>
  `promoted-to-repo:${recordDirName}`;

const pendingCloseFor = (args: {
  readonly taskId: string;
  readonly recordDirName: string;
}): PendingClose => ({
  taskId: args.taskId,
  recordDirName: args.recordDirName,
  archiveReason: archiveReasonFor(args.recordDirName),
});

const findPromotedRecord = (args: {
  readonly ports: PromotePorts;
  readonly taskId: string;
}): Result<string | null, PromoteFailure> =>
  args.ports
    .listRecordDirNames()
    .reduce<Result<string | null, PromoteFailure>>(
      (accumulated, recordDirName) => {
        if (accumulated.outcome === "failed") return accumulated;
        if (accumulated.value !== null) return accumulated;
        const provenance = args.ports.readProvenanceTaskId(recordDirName);
        if (provenance.outcome === "failed") {
          return failWith({
            kind: "unreadable-provenance",
            path: provenance.error,
          });
        }
        return succeed(provenance.value === args.taskId ? recordDirName : null);
      },
      succeed(null),
    );

const checkMilestoneTierExclusion = (args: {
  readonly importance: LaneImportance;
  readonly ratifiedMilestones: readonly string[];
}): Result<void, PromoteFailure> => {
  const { milestone, tier } = args.importance;
  if (milestone.kind === "no-milestone" || tier.kind === "unscored") {
    return succeed(undefined);
  }
  return violatesMilestoneTierExclusion({
    milestoneIsRatified: args.ratifiedMilestones.includes(milestone.identifier),
    tier,
  })
    ? failWith({
        kind: "ratified-milestone-with-scored-tier",
        milestoneIdentifier: milestone.identifier,
        tier: tier.value,
      })
    : succeed(undefined);
};

const resolveWrittenTier = (args: {
  readonly claimed: MetaTier;
  readonly tierClaim: TierClaim | null;
}): MetaTier => {
  if (args.claimed.kind === "unscored" || args.tierClaim === null) {
    return args.claimed;
  }
  return {
    kind: "scored",
    value: assessTierClaim({
      claimed: args.claimed.value,
      claim: args.tierClaim,
    }).assessed,
  };
};

const writtenImportanceFor = (args: {
  readonly importance: LaneImportance;
  readonly tierClaim: TierClaim | null;
}): LaneImportance => ({
  ...args.importance,
  tier: resolveWrittenTier({
    claimed: args.importance.tier,
    tierClaim: args.tierClaim,
  }),
});

const writeRecordArtefacts = (args: {
  readonly ports: PromotePorts;
  readonly recordDirName: string;
  readonly taskId: string;
  readonly importance: LaneImportance;
  readonly boundAt: string;
}): Result<void, PromoteFailure> => {
  const provenance = args.ports.writeProvenance({
    recordDirName: args.recordDirName,
    taskId: args.taskId,
  });
  if (provenance.outcome === "failed") {
    return failWith({
      kind: "provenance-write-failed",
      recordDirName: args.recordDirName,
      detail: provenance.error,
    });
  }

  const binding = args.ports.writeImportanceBinding({
    recordDirName: args.recordDirName,
    binding: {
      flagged: args.importance.flagged,
      milestone: args.importance.milestone,
      tier: args.importance.tier,
      boundAt: args.boundAt,
      boundBy: "gate-0-reconcile",
    },
  });
  if (binding.outcome === "failed") return failWith(binding.error);

  return succeed(undefined);
};

const alreadyPromotedOutcomeFor = (args: {
  readonly ports: PromotePorts;
  readonly taskId: string;
}): Result<PromoteOutcome | null, PromoteFailure> => {
  const existing = findPromotedRecord({
    ports: args.ports,
    taskId: args.taskId,
  });
  if (existing.outcome === "failed") return existing;
  if (existing.value === null) return succeed(null);
  return succeed({
    kind: "already-promoted",
    recordDirName: existing.value,
    pendingClose: pendingCloseFor({
      taskId: args.taskId,
      recordDirName: existing.value,
    }),
  });
};

const promote = (args: {
  readonly request: PromoteRequest;
  readonly workspaceRoot: string;
  readonly ratifiedMilestones: readonly string[];
  readonly boundAt: string;
  readonly ports: PromotePorts;
}): Result<PromoteOutcome, PromoteFailure> => {
  const { request, ports, workspaceRoot } = args;

  const writtenImportance = writtenImportanceFor({
    importance: request.importance,
    tierClaim: request.tierClaim,
  });

  const exclusion = checkMilestoneTierExclusion({
    importance: writtenImportance,
    ratifiedMilestones: args.ratifiedMilestones,
  });
  if (exclusion.outcome === "failed") return exclusion;

  const already = alreadyPromotedOutcomeFor({ ports, taskId: request.taskId });
  if (already.outcome === "failed") return already;
  if (already.value !== null) return succeed(already.value);

  if (request.dryRun) {
    return succeed({
      kind: "planned",
      taskId: request.taskId,
      scope: request.scope,
    });
  }

  const born = ports.birthIntent({
    scope: request.scope,
    label: request.label,
    promotionArguments: request.promotionArguments,
    workspaceRoot,
  });
  if (born.outcome === "failed") return born;

  const artefacts = writeRecordArtefacts({
    ports,
    recordDirName: born.value,
    taskId: request.taskId,
    importance: writtenImportance,
    boundAt: args.boundAt,
  });
  if (artefacts.outcome === "failed") return artefacts;

  return succeed({
    kind: "promoted",
    recordDirName: born.value,
    pendingClose: pendingCloseFor({
      taskId: request.taskId,
      recordDirName: born.value,
    }),
  });
};

const LANE_FLAGS: readonly LaneFlag[] = ["lane-flagged", "not-flagged"];
const NO_MILESTONE_TOKEN = "no-milestone";

const UNSCORED_TIER_TOKEN = "unscored";
const TIER_VALUES: readonly TierValue[] = ["T0", "T1", "T2", "T3"];
const IMPORTANCE_SLOT_COUNT = 3;

const parseTierToken = (args: {
  readonly token: string;
}): MetaTier | "malformed" => {
  if (args.token === UNSCORED_TIER_TOKEN) return { kind: "unscored" };
  const value = TIER_VALUES.find((candidate) => candidate === args.token);
  return value === undefined ? "malformed" : { kind: "scored", value };
};

const parseLaneImportance = (args: {
  readonly received: string;
}): Result<LaneImportance, PromoteFailure> => {
  const slots = args.received.split(":");
  const malformed = failWith({
    kind: "malformed-importance" as const,
    received: args.received,
  });
  const [flagToken, milestoneToken, tierToken] = slots;
  if (flagToken === "operator-flagged") {
    return failWith({
      kind: "operator-flag-not-lane-writable",
      received: args.received,
    });
  }
  if (
    slots.length !== IMPORTANCE_SLOT_COUNT ||
    milestoneToken === undefined ||
    tierToken === undefined
  ) {
    return malformed;
  }
  const flagged = LANE_FLAGS.find((candidate) => candidate === flagToken);
  if (flagged === undefined || milestoneToken === "") return malformed;
  const tier = parseTierToken({ token: tierToken });
  if (tier === "malformed") return malformed;
  if (tier.kind === "unscored" && milestoneToken === NO_MILESTONE_TOKEN) {
    return failWith({
      kind: "unscored-tier-on-no-milestone",
      received: args.received,
    });
  }
  return succeed({
    flagged,
    milestone:
      milestoneToken === NO_MILESTONE_TOKEN
        ? { kind: "no-milestone" }
        : { kind: "milestone", identifier: milestoneToken },
    tier,
  });
};

const parseRequest = (
  argv: readonly string[],
): Result<PromoteRequest, PromoteFailure> => {
  const flagValue = (flag: string): string | null => {
    const index = argv.indexOf(flag);
    return index === -1 ? null : (argv[index + 1] ?? null);
  };
  const taskId = flagValue("--task-id");
  if (taskId === null) {
    return failWith({ kind: "missing-argument", flag: "--task-id" });
  }
  const label = flagValue("--label");
  if (label === null) {
    return failWith({ kind: "missing-argument", flag: "--label" });
  }
  const scope = flagValue("--scope");
  if (scope === null) {
    return failWith({ kind: "missing-argument", flag: "--scope" });
  }
  const importanceRaw = flagValue("--importance");
  if (importanceRaw === null) {
    return failWith({ kind: "missing-argument", flag: "--importance" });
  }
  const importance = parseLaneImportance({ received: importanceRaw });
  if (importance.outcome === "failed") return importance;
  const tierClaimRaw = flagValue("--tier-claim");
  const tierClaim =
    tierClaimRaw === null
      ? succeed(null)
      : parseTierClaim({ raw: tierClaimRaw });
  if (tierClaim.outcome === "failed") {
    return failWith({
      kind: "malformed-tier-claim",
      received: tierClaimRaw ?? "",
    });
  }
  return succeed({
    taskId,
    label,
    scope,
    importance: importance.value,
    tierClaim: tierClaim.value,
    promotionArguments: flagValue("--arguments"),
    dryRun: argv.includes("--dry-run"),
  });
};

const renderPendingClose = (pendingClose: PendingClose): string =>
  [
    "NEXT (session, via MCP — the transaction's second step, still OPEN):",
    `  archive_task({ taskId: "${pendingClose.taskId}", reason: "${pendingClose.archiveReason}" })`,
    "  Until this lands the intake row stays open and the capture re-surfaces",
    "  in every later Gate-0 intake queue as unpromoted-looking work.",
  ].join("\n");

const renderOutcome = (outcome: PromoteOutcome): string => {
  switch (outcome.kind) {
    case "planned":
      return `PLAN  ${outcome.taskId} would be promoted (scope ${outcome.scope}) — dry run, nothing created`;
    case "already-promoted":
      return `SKIP  ${outcome.pendingClose.taskId} already promoted -> ${outcome.recordDirName} (no-op)\n${renderPendingClose(outcome.pendingClose)}`;
    case "promoted":
      return `PROMOTED  ${outcome.pendingClose.taskId} -> ${outcome.recordDirName}\n${renderPendingClose(outcome.pendingClose)}`;
  }
};

type OutcomeReport = {
  readonly disposition: PromoteOutcome["kind"];
  readonly taskId: string;
  readonly recordDirName: string | null;
  readonly archiveReason: string | null;
  readonly closeOutstanding: boolean;
};

const reportOf = (outcome: PromoteOutcome): OutcomeReport => {
  switch (outcome.kind) {
    case "planned":
      return {
        disposition: "planned",
        taskId: outcome.taskId,
        recordDirName: null,
        archiveReason: null,
        closeOutstanding: false,
      };
    case "already-promoted":
    case "promoted":
      return {
        disposition: outcome.kind,
        taskId: outcome.pendingClose.taskId,
        recordDirName: outcome.recordDirName,
        archiveReason: outcome.pendingClose.archiveReason,
        closeOutstanding: true,
      };
  }
};

const promotionOutcomeReportOf = (args: {
  readonly outcome: PromoteOutcome;
  readonly ratifiedMilestones: RatifiedMilestones;
}) => ({
  ...reportOf(args.outcome),
  selectionRankingConfigPath:
    args.ratifiedMilestones.selectionRankingConfigPath,
});

type FailureReport = {
  readonly disposition: "failed";
  readonly failure: PromoteFailure["kind"];
  readonly detail: string;
  readonly recordDirName: string | null;
  readonly manualRecoveryRequired: boolean;
};

const MINTED_RECORD_FAILURES: readonly PromoteFailure["kind"][] = [
  "provenance-write-failed",
  "binding-write-failed",
];

const leavesMintedRecord = (
  failure: PromoteFailure,
): failure is Extract<
  PromoteFailure,
  { kind: "provenance-write-failed" | "binding-write-failed" }
> => MINTED_RECORD_FAILURES.some((kind) => kind === failure.kind);

const failureReportOf = (failure: PromoteFailure): FailureReport => ({
  disposition: "failed",
  failure: failure.kind,
  detail: renderFailure(failure),
  recordDirName: leavesMintedRecord(failure) ? failure.recordDirName : null,
  manualRecoveryRequired: leavesMintedRecord(failure),
});

type ImportanceFailure = Extract<
  PromoteFailure,
  {
    kind:
      | "malformed-importance"
      | "operator-flag-not-lane-writable"
      | "unscored-tier-on-no-milestone"
      | "record-dir-absent"
      | "binding-write-failed";
  }
>;

const renderUnscoredTierRefusal = (args: {
  readonly received: string;
}): string =>
  [
    `--importance "${args.received}" scores a no-milestone record as "unscored",`,
    `which is no longer allowed. An intent that fits no milestone is still`,
    `scored, with evidence.`,
    ``,
    `Pick the tier the evidence supports and record the argument in the`,
    `record's importance-derivation.md:`,
    ``,
    `  T0  trust substrate — maintain-only; fund nothing new without a hole`,
    `  T1  a failure class with >= 1 real occurrence, priced per incident`,
    `  T2  metered economics — a measured before/after, or a recurrence`,
    `      (per-occurrence cost x occurrences / denominator)`,
    `  T3  ergonomics — THE ANSWER when the claim cannot name a currency,`,
    `      an amount and evidence. T3 is a decision, not a failure to make one.`,
    ``,
    `"unscored" stays legal on a MILESTONE-bound mint, and is the only legal`,
    `tier on a RATIFIED one — FR-4 keys on ratification, so a scored tier`,
    `remains legal on an unratified milestone identifier.`,
  ].join("\n");

const renderImportanceFailure = (failure: ImportanceFailure): string => {
  switch (failure.kind) {
    case "malformed-importance":
      return [
        `--importance "${failure.received}" is malformed.`,
        ``,
        `Expected <lane-flagged|not-flagged>:<milestone-id|no-milestone>:<tier>,`,
        `where <tier> is T0, T1, T2 or T3 on a no-milestone mint, and`,
        `"unscored" on a RATIFIED-milestone one. A scored tier stays legal`,
        `on an unratified milestone identifier.`,
        `The refusal is against SILENCE, not low importance —`,
        `"not-flagged:no-milestone:T3" is a valid, recorded decision.`,
      ].join("\n");
    case "unscored-tier-on-no-milestone":
      return renderUnscoredTierRefusal({ received: failure.received });
    case "operator-flag-not-lane-writable":
      return [
        `--importance "${failure.received}" requests operator-flagged, which the`,
        `lane-facing promotion path cannot write. Only the operator's own surface sets`,
        `the value the selection ordering honours. Record the lane's honest read`,
        `as lane-flagged (it ranks identically to not-flagged) and let the operator flag`,
        `the record afterwards if it warrants the queue jump.`,
      ].join("\n");
    case "record-dir-absent":
      return [
        `the engine reported intent ${failure.recordDirName} as born, but its record dir does not exist on disk.`,
        "No binding was written, and there is nothing to hand-write into: the",
        "record was never really minted. Do NOT create the dir by hand — re-run",
        "the promotion so the engine mints it, and check for a mid-run worktree",
        "reset if this repeats.",
      ].join("\n");
    case "binding-write-failed":
      return [
        `intent ${failure.recordDirName} was created but its importance-binding write FAILED: ${failure.detail}`,
        "The record exists WITHOUT its binding, so it reads as unbound and",
        "silently rejoins the standing pool with no recorded importance decision.",
        `Write ${join(failure.recordDirName, IMPORTANCE_BINDING_FILENAME)} by hand or delete the record before re-running.`,
      ].join("\n");
  }
};

const renderMalformedTierClaim = (args: {
  readonly received: string;
}): string =>
  [
    `--tier-claim "${args.received}" is not a valid tier claim.`,
    ``,
    `Expected JSON matching one of the two claim kinds:`,
    `  {"kind":"priced-incident","currency":...,"amount":...,"evidence":...}`,
    `  {"kind":"measured-recurrence","perOccurrenceCost":...,"occurrences":...,"denominator":...,"evidence":...}`,
    `Every component is a string or null — null (or an absent claim) means`,
    `not-yet-named, not a parse failure. Omit --tier-claim entirely to mint`,
    `with the claimed tier passed through unassessed.`,
  ].join("\n");

const renderFailure = (failure: PromoteFailure): string => {
  switch (failure.kind) {
    case "missing-argument":
      return `${failure.flag} is required`;
    case "unreadable-provenance":
      return `existing provenance at ${failure.path} is not valid JSON`;
    case "intent-birth-failed":
      return `intent creation failed:\n${failure.detail}`;
    case "promotion-arguments-too-long":
      return [
        `--arguments is ${failure.length} characters; the limit is ${failure.limit}.`,
        ``,
        `Do NOT shorten the framing to get past this — that succeeds and mints a`,
        `record carrying degraded framing, which is the failure this check exists`,
        `to prevent. Promote with a short --arguments summary, then write the full`,
        `framing into the record's own artefact where it has no length limit.`,
      ].join("\n");
    case "record-dir-unresolvable":
      return `intent created but its record dir was not resolvable from engine output:\n${failure.engineOutput}`;
    case "provenance-write-failed":
      return [
        `intent ${failure.recordDirName} was created but its provenance write FAILED: ${failure.detail}`,
        "The record exists WITHOUT promoted-from.json, so it reads as unpromoted:",
        "a re-run would mint a SECOND record for the same capture. Write",
        `${join(failure.recordDirName, "promoted-from.json")} by hand or delete the record before re-running.`,
      ].join("\n");
    case "ratified-milestone-with-scored-tier":
      return [
        `milestone ${failure.milestoneIdentifier} is ratified, so this record cannot also claim tier ${failure.tier}.`,
        ``,
        `Meta-work is the tax the milestones pay: a record either carries a`,
        `ratified goal or claims the budget that funds it, never both. Promote`,
        `either as <milestone-id>:unscored (the goal) or as no-milestone:<tier>`,
        `(the budget claim) — NOT no-milestone:unscored, which is refused`,
        `separately: a record fitting no milestone is still scored, with evidence.`,
      ].join("\n");
    case "malformed-tier-claim":
      return renderMalformedTierClaim({ received: failure.received });
    case "malformed-importance":
    case "operator-flag-not-lane-writable":
    case "unscored-tier-on-no-milestone":
    case "record-dir-absent":
    case "binding-write-failed":
      return renderImportanceFailure(failure);
  }
};

const readRatifiedMilestones = (
  selectionRankingConfiguration: SelectionRankingConfiguration,
): RatifiedMilestones => ({
  selectionRankingConfigPath:
    selectionRankingConfiguration.selectionRankingConfigPath,
  ratifiedMilestones:
    selectionRankingConfiguration.selectionConfig.ratifiedMilestones,
});

const selectedRatifiedMilestones = (args: {
  readonly commandName: string;
  readonly toolsDir: string;
  readonly rawConfiguredPath: string | undefined;
  readonly selectionRankingConfigReader: SelectionRankingConfigReader;
}): RatifiedMilestones | null => {
  const selectionRankingPath = resolveSelectionRankingPath({
    toolsDir: args.toolsDir,
    rawConfiguredPath: args.rawConfiguredPath,
  });
  if (selectionRankingPath.outcome === "failed") {
    process.stderr.write(
      `${args.commandName}: selection ranking path failed: ${JSON.stringify(selectionRankingPath.selectionRankingPathFailure)}\n`,
    );
    return null;
  }
  const selectionRankingRead = readSelectionRankingConfiguration({
    selectionRankingConfigPath:
      selectionRankingPath.selectionRankingPath.selectionRankingConfigPath,
    selectionRankingConfigReader: args.selectionRankingConfigReader,
  });
  if (selectionRankingRead.outcome === "failed") {
    process.stderr.write(
      `${args.commandName}: selection ranking read failed: ${JSON.stringify(selectionRankingRead.selectionRankingReadFailure)}\n`,
    );
    return null;
  }
  return readRatifiedMilestones(
    selectionRankingRead.selectionRankingConfiguration,
  );
};

const recordDirFromEngineOutput = (stdout: string): string | null => {
  const line = stdout
    .split("\n")
    .find((l) => /^(Intent born|Intent created):/.test(l));
  if (line === undefined) return null;
  const afterColon = line.slice(line.indexOf(":") + 1).trim();
  const spaceParen = afterColon.indexOf(" (space:");
  const recordDirName = (
    spaceParen === -1 ? afterColon : afterColon.slice(0, spaceParen)
  ).trim();
  return recordDirName === "" ? null : recordDirName;
};

const checkoutRootFrom = (dir: string, fallback: string): string => {
  if (existsSync(join(dir, ".git"))) return dir;
  const parent = dirname(dir);
  return parent === dir ? fallback : checkoutRootFrom(parent, fallback);
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const listRecordDirNamesIn = (intentsRoot: string): readonly string[] =>
  existsSync(intentsRoot)
    ? readdirSync(intentsRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
    : [];

const readProvenanceTaskIdAt = (args: {
  readonly intentsRoot: string;
  readonly recordDirName: string;
}): Result<string | null, string> => {
  const path = join(args.intentsRoot, args.recordDirName, "promoted-from.json");
  if (!existsSync(path)) return succeed(null);
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, "utf-8"));
    return succeed(
      isRecord(parsed) && typeof parsed["taskId"] === "string"
        ? parsed["taskId"]
        : null,
    );
  } catch {
    return failWith(path);
  }
};

const PROMOTION_ARGUMENTS_LIMIT = 1000;

const birthIntentVia = (args: {
  readonly engineCli: string;
  readonly request: IntentBirthRequest;
  readonly space: string;
  readonly executor: WorkflowUtilityExecutor;
}): Result<string, PromoteFailure> => {
  const { engineCli, request } = args;
  if (
    request.promotionArguments !== null &&
    request.promotionArguments.length > PROMOTION_ARGUMENTS_LIMIT
  ) {
    return failWith({
      kind: "promotion-arguments-too-long",
      length: request.promotionArguments.length,
      limit: PROMOTION_ARGUMENTS_LIMIT,
    });
  }
  const birth = args.executor.execute({
    executable: "bun",
    commandArguments: [
      engineCli,
      "intent-create",
      "--scope",
      request.scope,
      "--label",
      request.label,
      "--project-dir",
      request.workspaceRoot,
      "--space",
      args.space,
      ...(request.promotionArguments === null
        ? []
        : ["--arguments", request.promotionArguments]),
    ],
    workingDirectory: request.workspaceRoot,
  });
  if (birth.kind !== "completed") {
    return failWith({
      kind: "intent-birth-failed",
      detail: birth.kind === "interrupted" ? birth.terminationSignal : "engine utility could not be launched",
    });
  }
  if (birth.processStatus !== 0) {
    return failWith({
      kind: "intent-birth-failed",
      detail: birth.stderr || birth.stdout,
    });
  }
  const engineOutput = birth.stdout;
  const recordDirName = recordDirFromEngineOutput(engineOutput);
  return recordDirName === null
    ? failWith({ kind: "record-dir-unresolvable", engineOutput })
    : succeed(recordDirName);
};

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const isAlreadyPresent = (error: unknown): boolean =>
  error instanceof Error && "code" in error && error.code === "EEXIST";

const writeBindingFile = (args: {
  readonly path: string;
  readonly binding: WritableImportanceBinding;
  readonly exclusive: boolean;
}): Result<void, unknown> => {
  try {
    writeFileSync(
      args.path,
      renderImportanceBinding({ binding: args.binding }),
      args.exclusive ? { encoding: "utf-8", flag: "wx" } : "utf-8",
    );
    return succeed(undefined);
  } catch (error) {
    return failWith(error);
  }
};

const writeBindingAt = (args: {
  readonly recordDir: string;
  readonly recordDirName: string;
  readonly binding: WritableImportanceBinding;
}): Result<BindingWriteOutcome, BindingWriteFailure> => {
  if (!existsSync(args.recordDir)) {
    return failWith({
      kind: "record-dir-absent",
      recordDirName: args.recordDirName,
    });
  }
  const path = join(args.recordDir, IMPORTANCE_BINDING_FILENAME);
  const created = writeBindingFile({
    path,
    binding: args.binding,
    exclusive: true,
  });
  if (created.outcome === "ok") return succeed("created");
  if (!isAlreadyPresent(created.error)) {
    return failWith({
      kind: "binding-write-failed",
      recordDirName: args.recordDirName,
      detail: messageOf(created.error),
    });
  }
  const replaced = writeBindingFile({
    path,
    binding: args.binding,
    exclusive: false,
  });
  return replaced.outcome === "ok"
    ? succeed("replaced")
    : failWith({
        kind: "binding-write-failed",
        recordDirName: args.recordDirName,
        detail: messageOf(replaced.error),
      });
};

const filesystemPorts = (args: {
  readonly intentsRoot: string;
  readonly space: string;
  readonly executor: WorkflowUtilityExecutor;
  readonly engineCli: string;
  readonly now: () => Date;
}): PromotePorts => ({
  listRecordDirNames: () => listRecordDirNamesIn(args.intentsRoot),
  readProvenanceTaskId: (recordDirName) =>
    readProvenanceTaskIdAt({ intentsRoot: args.intentsRoot, recordDirName }),
  birthIntent: (request) =>
    birthIntentVia({ engineCli: args.engineCli, request, space: args.space, executor: args.executor }),
  writeProvenance: ({ recordDirName, taskId }) => {
    try {
      writeFileSync(
        join(args.intentsRoot, recordDirName, "promoted-from.json"),
        `${JSON.stringify(
          {
            taskId,
            promotedBy: "gate-0-reconcile",
            promotedAt: args.now().toISOString(),
          },
          null,
          2,
        )}\n`,
        "utf-8",
      );
      return succeed(undefined);
    } catch (error) {
      return failWith(error instanceof Error ? error.message : String(error));
    }
  },
  writeImportanceBinding: ({ recordDirName, binding }) =>
    writeBindingAt({
      recordDir: join(args.intentsRoot, recordDirName),
      recordDirName,
      binding,
    }),
});

const selectedConsumerWorkflowContext = (args: {
  readonly commandName: string;
  readonly consumerRoot: string;
  readonly engineUtilityPath: string;
  readonly rawSelectedSpace: string | undefined;
  readonly executor: WorkflowUtilityExecutor;
}): ConsumerWorkflowContext | null => {
  const workflowSelection = resolveConsumerWorkflowContext({
    consumerRoot: args.consumerRoot,
    engineUtilityPath: args.engineUtilityPath,
    rawSelectedSpace: args.rawSelectedSpace,
    executor: args.executor,
  });
  if (workflowSelection.outcome === "ok") {
    return workflowSelection.consumerWorkflowContext;
  }
  process.stderr.write(
    `${args.commandName}: workflow selection failed: ${JSON.stringify(workflowSelection.consumerSpaceSelectionFailure)}\n`,
  );
  return null;
};

const writeRebindSuccess = (args: {
  readonly asJson: boolean;
  readonly outcome: RebindOutcome;
  readonly ratifiedMilestones: RatifiedMilestones;
}): void => {
  process.stdout.write(
    args.asJson
      ? `${JSON.stringify(rebindOutcomeReportOf(args), null, 2)}\n`
      : `${renderRebindOutcome(args.outcome)}\nSelection ranking policy: ${args.ratifiedMilestones.selectionRankingConfigPath}\n`,
  );
};

const runRebindTier = (argv: readonly string[]): number => {
  const flagValue = (flag: string): string | undefined => {
    const index = argv.indexOf(flag);
    return index === -1 ? undefined : argv[index + 1];
  };
  const request = parseRebindRequest({ flagValue });
  if (request.outcome === "failed") {
    process.stderr.write(
      `rin-gates-promote rebind-tier: ${renderRebindFailure(request.error)}\n`,
    );
    return 1;
  }
  const here = dirname(fileURLToPath(import.meta.url));
  const invokingCheckout = checkoutRootFrom(resolve(here), resolve(here));
  const workspaceRoot =
    process.env["RIN_GATES_WORKSPACE_ROOT"] ?? invokingCheckout;
  const engineUtilityPath =
    process.env["RIN_GATES_ENGINE_CLI"] ??
    join(invokingCheckout, ".claude", "tools", "aidlc-utility.ts");
  const workflowUtilityExecutor = createNodeWorkflowUtilityExecutor();
  const consumerWorkflowContext = selectedConsumerWorkflowContext({
    commandName: "rin-gates-promote rebind-tier",
    consumerRoot: workspaceRoot,
    engineUtilityPath,
    rawSelectedSpace: process.env["RIN_GATES_SPACE"],
    executor: workflowUtilityExecutor,
  });
  if (consumerWorkflowContext === null) return 1;
  const ratifiedMilestones = selectedRatifiedMilestones({
    commandName: "rin-gates-promote rebind-tier",
    toolsDir: here,
    rawConfiguredPath: process.env["RIN_GATES_SELECTION_CONFIG"],
    selectionRankingConfigReader: createNodeSelectionRankingConfigReader(),
  });
  if (ratifiedMilestones === null) return 1;

  const result = rebindTier({
    request: request.value,
    ratifiedMilestones: ratifiedMilestones.ratifiedMilestones,
    boundAt: new Date().toISOString(),
    ports: rebindFilesystemPorts({
      intentsRoot: consumerWorkflowContext.intentsRoot,
    }),
  });
  if (result.outcome === "failed") {
    process.stderr.write(
      `rin-gates-promote rebind-tier: ${renderRebindFailure(result.error)}\n`,
    );
    return 1;
  }
  writeRebindSuccess({
    asJson: argv.includes("--json"),
    outcome: result.value,
    ratifiedMilestones,
  });
  return 0;
};

const rebindOutcomeReportOf = (args: {
  readonly outcome: RebindOutcome;
  readonly ratifiedMilestones: RatifiedMilestones;
}) => ({
  ...args.outcome,
  selectionRankingConfigPath:
    args.ratifiedMilestones.selectionRankingConfigPath,
});

const rebindFilesystemPorts = (args: {
  readonly intentsRoot: string;
}): RebindPorts => ({
  readBinding: (recordDirName) => {
    const path = join(
      args.intentsRoot,
      recordDirName,
      IMPORTANCE_BINDING_FILENAME,
    );
    if (!existsSync(join(args.intentsRoot, recordDirName))) {
      return { outcome: "failed", error: "record-dir-absent" };
    }
    return {
      outcome: "ok",
      value: existsSync(path) ? readFileSync(path, "utf-8") : null,
    };
  },
  readTier: (recordDirName) => {
    const path = join(
      args.intentsRoot,
      recordDirName,
      IMPORTANCE_BINDING_FILENAME,
    );
    if (!existsSync(path)) return { kind: "unscored" };
    try {
      return parseMetaTier({ parsed: JSON.parse(readFileSync(path, "utf-8")) });
    } catch {
      return { kind: "unscored" };
    }
  },
  writeImportanceBinding: ({ recordDirName, binding }) => {
    const outcome = writeBindingAt({
      recordDir: join(args.intentsRoot, recordDirName),
      recordDirName,
      binding,
    });
    return outcome.outcome === "ok"
      ? outcome
      : {
          outcome: "failed",
          error: {
            kind: "write-failed",
            recordDirName,
            detail: JSON.stringify(outcome.error),
          },
        };
  },
});

const writePromotionSuccess = (args: {
  readonly asJson: boolean;
  readonly outcome: PromoteOutcome;
  readonly ratifiedMilestones: RatifiedMilestones;
}): void => {
  process.stdout.write(
    args.asJson
      ? `${JSON.stringify(promotionOutcomeReportOf(args), null, 2)}\n`
      : `${renderOutcome(args.outcome)}\nSelection ranking policy: ${args.ratifiedMilestones.selectionRankingConfigPath}\n`,
  );
};

const requestedPromotion = (args: {
  readonly argv: readonly string[];
}): PromoteRequest | null => {
  const request = parseRequest(args.argv);
  if (request.outcome === "ok") return request.value;
  if (args.argv.includes("--json")) {
    process.stdout.write(
      `${JSON.stringify(failureReportOf(request.error), null, 2)}\n`,
    );
  }
  process.stderr.write(`rin-gates-promote: ${renderFailure(request.error)}\n`);
  return null;
};

const run = (argv: readonly string[]): number => {
  if (argv[0] === "rebind-tier") return runRebindTier(argv.slice(1));
  const request = requestedPromotion({ argv });
  if (request === null) return 1;
  const here = dirname(fileURLToPath(import.meta.url));
  const invokingCheckout = checkoutRootFrom(resolve(here), resolve(here));
  const workspaceRoot =
    process.env["RIN_GATES_WORKSPACE_ROOT"] ?? invokingCheckout;
  const engineCli =
    process.env["RIN_GATES_ENGINE_CLI"] ??
    join(invokingCheckout, ".claude", "tools", "aidlc-utility.ts");
  const workflowUtilityExecutor = createNodeWorkflowUtilityExecutor();
  const consumerWorkflowContext = selectedConsumerWorkflowContext({
    commandName: "rin-gates-promote",
    consumerRoot: workspaceRoot,
    engineUtilityPath: engineCli,
    rawSelectedSpace: process.env["RIN_GATES_SPACE"],
    executor: workflowUtilityExecutor,
  });
  if (consumerWorkflowContext === null) return 1;
  const ratifiedMilestones = selectedRatifiedMilestones({
    commandName: "rin-gates-promote",
    toolsDir: here,
    rawConfiguredPath: process.env["RIN_GATES_SELECTION_CONFIG"],
    selectionRankingConfigReader: createNodeSelectionRankingConfigReader(),
  });
  if (ratifiedMilestones === null) return 1;

  const now = (): Date => new Date();
  const result = promote({
    request,
    workspaceRoot,
    ratifiedMilestones: ratifiedMilestones.ratifiedMilestones,
    boundAt: now().toISOString(),
    ports: filesystemPorts({
      intentsRoot: consumerWorkflowContext.intentsRoot,
      space: consumerWorkflowContext.space,
      executor: workflowUtilityExecutor,
      engineCli,
      now,
    }),
  });

  const asJson = argv.includes("--json");
  if (result.outcome === "failed") {
    if (asJson) {
      process.stdout.write(
        `${JSON.stringify(failureReportOf(result.error), null, 2)}\n`,
      );
    }
    process.stderr.write(`rin-gates-promote: ${renderFailure(result.error)}\n`);
    return 1;
  }
  writePromotionSuccess({
    asJson,
    outcome: result.value,
    ratifiedMilestones,
  });
  return 0;
};

if (import.meta.main) {
  process.exit(run(process.argv.slice(2)));
}

export type {
  FailureReport,
  IntentBirthRequest,
  OutcomeReport,
  PendingClose,
  PromoteFailure,
  PromoteOutcome,
  PromotePorts,
  PromoteRequest,
  Result,
};

export {
  failureReportOf,
  filesystemPorts,
  parseRequest,
  promote,
  recordDirFromEngineOutput,
  renderFailure,
  renderOutcome,
  renderPendingClose,
  reportOf,
};
