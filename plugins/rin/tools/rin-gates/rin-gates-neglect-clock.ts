type NeglectClock =
  | { readonly source: "stage-advance"; readonly at: string }
  | { readonly source: "promotion-date"; readonly at: string }
  | { readonly source: "dir-name-prefix"; readonly at: string }
  | { readonly source: "no-clock" };

const ADVANCE_EVENTS = ["STAGE_COMPLETED", "GATE_APPROVED"] as const;

const BLOCK_SEPARATOR = "\n---\n";

const MS_PER_DAY = 86_400_000;

const CENTURY_PREFIX = "20";

// A gate advance names its stage as `rin-gate-N-*` today, but 24 shards in the
// corpus carry the LEGACY bare `gate-N-*` spelling from before the rin- prefix.
// Matching only the modern spelling silently rejects those records' real
// advances and drops them to a weaker clock level — a fail-open on precisely
// the oldest records the starvation guard exists to surface. Measured
// 2026-08-16: 428 shards modern, 24 legacy.
const GATE_STAGE_PATTERN = /^(?:rin-)?gate-\d/;

const fieldIn = (block: string, label: string): string | null => {
  const match = block.match(new RegExp(`^\\*\\*${label}\\*\\*:\\s*(.+)$`, "m"));
  const captured = match?.[1];
  return captured === undefined ? null : captured.trim();
};

type BlockKind = "gate-advance" | "not-an-advance";

// Keys on the event's OWN Stage field, never on presence in the directory: a
// shard can carry events naming a SIBLING record, so "newest timestamp in the
// dir" would read another record's activity as this record's progress.
const blockKind = (block: string): BlockKind => {
  const event = fieldIn(block, "Event");
  if (event === null) return "not-an-advance";
  if (!ADVANCE_EVENTS.some((advance) => advance === event)) {
    return "not-an-advance";
  }
  const stage = fieldIn(block, "Stage");
  return stage !== null && GATE_STAGE_PATTERN.test(stage)
    ? "gate-advance"
    : "not-an-advance";
};

// Read backwards and stop at the first hit: blocks are append-only, so the last
// matching block is the newest. Locked design property (IF-6) — a naive full
// read is ~18x the projection's current byte volume against a 4.31 MB worst case.
const lastAdvanceInShard = (args: {
  readonly shardBody: string;
}): string | null => {
  const blocks = args.shardBody.split(BLOCK_SEPARATOR);
  const found = blocks
    .slice()
    .reverse()
    .find((block) => blockKind(block) === "gate-advance");
  return found === undefined ? null : fieldIn(found, "Timestamp");
};

const latestAdvanceAcrossShards = (args: {
  readonly shardBodies: readonly string[];
}): string | null => {
  const stamps = args.shardBodies
    .map((shardBody) => lastAdvanceInShard({ shardBody }))
    .filter((stamp): stamp is string => stamp !== null);
  return stamps.length === 0
    ? null
    : stamps.reduce((latest, stamp) => (stamp > latest ? stamp : latest));
};

// A record dir is named YYMMDD-<slug>. The prefix EXISTING is guaranteed by
// construction; that it PARSES is not — a hand-created dir, a migrated legacy
// record or a rename can yield an unparseable prefix, which is why this returns
// null and the chain bottoms out in `no-clock` rather than a silent NaN.
const DIR_NAME_DATE_PREFIX =
  /^(?<year>\d{2})(?<month>\d{2})(?<day>\d{2})(?:-|$)/;

const dirNamePrefixDate = (args: {
  readonly dirName: string;
}): string | null => {
  const parts = DIR_NAME_DATE_PREFIX.exec(args.dirName)?.groups;
  if (parts === undefined) return null;
  const candidate = `${CENTURY_PREFIX}${parts["year"]}-${parts["month"]}-${parts["day"]}`;
  return Number.isNaN(Date.parse(candidate)) ? null : candidate;
};

const readNeglectClock = (args: {
  readonly dirName: string;
  readonly shardBodies: readonly string[];
  readonly promotedAt: string | null;
}): NeglectClock => {
  const advance = latestAdvanceAcrossShards({ shardBodies: args.shardBodies });
  if (advance !== null) return { source: "stage-advance", at: advance };
  if (args.promotedAt !== null) {
    return { source: "promotion-date", at: args.promotedAt };
  }
  const prefixDate = dirNamePrefixDate({ dirName: args.dirName });
  return prefixDate === null
    ? { source: "no-clock" }
    : { source: "dir-name-prefix", at: prefixDate };
};

// `no-clock` resolves to POSITIVE_INFINITY — an absolute encoding, never a
// pool-relative one, so a record the pipeline knows nothing about ranks as
// maximally neglected knowing only itself. This is fail-closed ONLY because
// rung 5 sorts neglect descending (IF-6); the two decisions hold together.
const resolveNeglectDays = (args: {
  readonly clock: NeglectClock;
  readonly now: () => Date;
}): number => {
  if (args.clock.source === "no-clock") return Number.POSITIVE_INFINITY;
  const at = Date.parse(args.clock.at);
  if (Number.isNaN(at)) return Number.POSITIVE_INFINITY;
  return (args.now().getTime() - at) / MS_PER_DAY;
};

export {
  dirNamePrefixDate,
  lastAdvanceInShard,
  latestAdvanceAcrossShards,
  type NeglectClock,
  readNeglectClock,
  resolveNeglectDays,
};
