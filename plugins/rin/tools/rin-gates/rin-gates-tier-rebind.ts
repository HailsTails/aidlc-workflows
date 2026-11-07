import {
  type ImportanceBinding,
  type MetaTier,
  parseImportanceBinding,
  type ResolvedImportanceBinding,
  type TierValue,
  violatesMilestoneTierExclusion,
  type WritableImportanceBinding,
} from "./rin-gates-importance-binding.ts";

type BindingWriteOutcome = "created" | "replaced";

type BindingWriteFailure = {
  readonly kind: "write-failed";
  readonly recordDirName: string;
  readonly detail: string;
};

type Result<T, E> =
  | { readonly outcome: "ok"; readonly value: T }
  | { readonly outcome: "failed"; readonly error: E };

const succeed = <T>(value: T): Result<T, never> => ({ outcome: "ok", value });
const failWith = <E>(error: E): Result<never, E> => ({
  outcome: "failed",
  error,
});

type RebindRequest = {
  readonly recordDirName: string;
  readonly tier: TierValue;
  readonly evidence: string;
};

type RebindFailure =
  | { readonly kind: "record-unbound"; readonly recordDirName: string }
  | {
      readonly kind: "binding-write-failed";
      readonly recordDirName: string;
      readonly detail: string;
    }
  | { readonly kind: "missing-argument"; readonly flag: string }
  | { readonly kind: "unknown-tier"; readonly received: string }
  | { readonly kind: "record-dir-absent"; readonly recordDirName: string };

type RebindOutcome = {
  readonly recordDirName: string;
  readonly previous: MetaTier;
  readonly rebound: TierValue;
  readonly write: BindingWriteOutcome;
  readonly note: ExclusionNote;
};

type RebindPorts = {
  readonly readBinding: (
    recordDirName: string,
  ) => Result<string | null, string>;
  readonly readTier: (recordDirName: string) => MetaTier;
  readonly writeImportanceBinding: (args: {
    readonly recordDirName: string;
    readonly binding: WritableImportanceBinding;
  }) => Result<BindingWriteOutcome, BindingWriteFailure>;
};

type ExclusionNote =
  | { readonly kind: "none" }
  | {
      readonly kind: "milestone-bound-record-scored";
      readonly milestone: string;
      readonly tier: TierValue;
    };

const noteExclusion = (args: {
  readonly existing: ImportanceBinding;
  readonly tier: TierValue;
  readonly ratifiedMilestones: readonly string[];
}): ExclusionNote => {
  if (args.existing.milestone.kind === "no-milestone") return { kind: "none" };
  const identifier = args.existing.milestone.identifier;
  return violatesMilestoneTierExclusion({
    milestoneIsRatified: args.ratifiedMilestones.includes(identifier),
    tier: { kind: "scored", value: args.tier },
  })
    ? {
        kind: "milestone-bound-record-scored",
        milestone: identifier,
        tier: args.tier,
      }
    : { kind: "none" };
};

const rebindTier = (args: {
  readonly request: RebindRequest;
  readonly ports: RebindPorts;
  readonly ratifiedMilestones: readonly string[];
  readonly boundAt: string;
}): Result<RebindOutcome, RebindFailure> => {
  const raw = args.ports.readBinding(args.request.recordDirName);
  if (raw.outcome === "failed") {
    return failWith({
      kind: "record-dir-absent",
      recordDirName: args.request.recordDirName,
    });
  }
  const existing: ResolvedImportanceBinding = parseImportanceBinding({
    raw: raw.value,
  });
  if (existing === "unbound") {
    return failWith({
      kind: "record-unbound",
      recordDirName: args.request.recordDirName,
    });
  }

  const note = noteExclusion({
    existing,
    tier: args.request.tier,
    ratifiedMilestones: args.ratifiedMilestones,
  });

  const previous = args.ports.readTier(args.request.recordDirName);

  const binding: WritableImportanceBinding = {
    flagged: existing.flagged,
    milestone: existing.milestone,
    boundAt: args.boundAt,
    boundBy: `tier-rebind:${args.request.evidence}`,
    tier: { kind: "scored", value: args.request.tier },
  };
  const written = args.ports.writeImportanceBinding({
    recordDirName: args.request.recordDirName,
    binding,
  });
  if (written.outcome === "failed") {
    return failWith({
      kind: "binding-write-failed",
      recordDirName: args.request.recordDirName,
      detail: JSON.stringify(written.error),
    });
  }
  return succeed({
    recordDirName: args.request.recordDirName,
    previous,
    rebound: args.request.tier,
    write: written.value,
    note,
  });
};

const TIER_VALUES: readonly TierValue[] = ["T0", "T1", "T2", "T3"];

const isTierValue = (candidate: string): candidate is TierValue =>
  TIER_VALUES.some((value) => value === candidate);

const parseRebindRequest = (args: {
  readonly flagValue: (flag: string) => string | undefined;
}): Result<RebindRequest, RebindFailure> => {
  const recordDirName = args.flagValue("--record");
  if (recordDirName === undefined || recordDirName === "") {
    return failWith({ kind: "missing-argument", flag: "--record" });
  }
  const tierToken = args.flagValue("--tier");
  if (tierToken === undefined || tierToken === "") {
    return failWith({ kind: "missing-argument", flag: "--tier" });
  }
  if (!isTierValue(tierToken)) {
    return failWith({ kind: "unknown-tier", received: tierToken });
  }
  const evidence = args.flagValue("--evidence");
  if (evidence === undefined || evidence === "") {
    return failWith({ kind: "missing-argument", flag: "--evidence" });
  }
  return succeed({ recordDirName, tier: tierToken, evidence });
};

const renderRebindFailure = (failure: RebindFailure): string => {
  switch (failure.kind) {
    case "record-unbound":
      return `${failure.recordDirName} has no importance-binding.json — it is unbound, not unscored. Mint its binding through promote before rebinding a tier.`;
    case "binding-write-failed":
      return `writing ${failure.recordDirName} failed: ${failure.detail}`;
    case "missing-argument":
      return `${failure.flag} is required`;
    case "unknown-tier":
      return `unknown tier "${failure.received}" — expected one of ${TIER_VALUES.join(", ")}`;
    case "record-dir-absent":
      return `${failure.recordDirName} is not a record directory`;
  }
};

const renderExclusionNote = (note: ExclusionNote): string => {
  switch (note.kind) {
    case "none":
      return "";
    case "milestone-bound-record-scored":
      return ` [note: bound to ratified milestone ${note.milestone}; the meta-work rule says milestone-bound work takes no tier — written as asked, reported so it is not silent]`;
  }
};

const renderRebindOutcome = (outcome: RebindOutcome): string =>
  `rebound ${outcome.recordDirName}: ${outcome.previous.kind === "scored" ? outcome.previous.value : "unscored"} → ${outcome.rebound} (${outcome.write})${renderExclusionNote(outcome.note)}`;

export {
  isTierValue,
  parseRebindRequest,
  type RebindFailure,
  type RebindOutcome,
  type RebindPorts,
  type RebindRequest,
  rebindTier,
  renderRebindFailure,
  renderRebindOutcome,
  TIER_VALUES,
};
