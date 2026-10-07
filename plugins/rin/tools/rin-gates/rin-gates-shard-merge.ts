import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { relative, resolve } from "node:path";

export const SHARD_HEADER = "# AI-DLC Audit Log";
const BLOCK_SEPARATOR = "\n---\n";
const TIMESTAMP_FIELD = /^\*\*Timestamp\*\*:[ \t]*(.+)$/m;
const EVENT_FIELD = /^\*\*Event\*\*:[ \t]*(.+)$/m;
const CONFLICT_MARKER = /^(<{7}|={7}|>{7}|\|{7})/m;

export type AuditEvent = {
  readonly identity: string;
  readonly timestamp: string;
  readonly eventType: string;
  readonly rendered: string;
};

export type ShardParseFailure =
  | { readonly reason: "missing-header" }
  | { readonly reason: "block-without-timestamp"; readonly block: string };

export type ShardMergeFailure =
  | {
      readonly reason: "side-unparseable";
      readonly side: string;
      readonly cause: ShardParseFailure;
    }
  | { readonly reason: "source-unreadable"; readonly locator: string }
  | { readonly reason: "conflict-markers-present"; readonly locator: string };

export type Result<T, E> =
  | { readonly outcome: "ok"; readonly value: T }
  | { readonly outcome: "failed"; readonly error: E };

const succeed = <T>(value: T): Result<T, never> => ({ outcome: "ok", value });
const fail = <E>(error: E): Result<never, E> => ({ outcome: "failed", error });

const normaliseLineEndings = (raw: string): string =>
  raw.replace(/\r\n/g, "\n");

const identityOf = (block: string): string =>
  block
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line !== "")
    .join("\n");

const parseBlock = (block: string): Result<AuditEvent, ShardParseFailure> => {
  const timestampMatch = block.match(TIMESTAMP_FIELD);
  if (timestampMatch === null) {
    return fail({ reason: "block-without-timestamp", block });
  }
  const eventMatch = block.match(EVENT_FIELD);
  return succeed({
    identity: identityOf(block),
    timestamp: timestampMatch[1].trim(),
    eventType: eventMatch === null ? "" : eventMatch[1].trim(),
    rendered: block.replace(/^\n+/, "").replace(/\n+$/, ""),
  });
};

export const parseShard = (
  raw: string,
): Result<readonly AuditEvent[], ShardParseFailure> => {
  const content = normaliseLineEndings(raw);
  if (!content.startsWith(SHARD_HEADER))
    return fail({ reason: "missing-header" });

  return content
    .slice(SHARD_HEADER.length)
    .split(BLOCK_SEPARATOR)
    .filter((segment) => segment.trim() !== "")
    .map(parseBlock)
    .reduce<Result<readonly AuditEvent[], ShardParseFailure>>(
      (accumulated, block) =>
        accumulated.outcome === "failed"
          ? accumulated
          : block.outcome === "failed"
            ? block
            : succeed([...accumulated.value, block.value]),
      succeed([]),
    );
};

const orderEvents = (
  events: readonly (AuditEvent & { readonly arrival: number })[],
): readonly AuditEvent[] =>
  [...events]
    .sort((left, right) =>
      left.timestamp === right.timestamp
        ? left.arrival - right.arrival
        : left.timestamp < right.timestamp
          ? -1
          : 1,
    )
    .map(({ identity, timestamp, eventType, rendered }) => ({
      identity,
      timestamp,
      eventType,
      rendered,
    }));

export type ShardUnion = {
  readonly events: readonly AuditEvent[];
  readonly oursCount: number;
  readonly theirsCount: number;
  readonly sharedCount: number;
  readonly mergedCount: number;
};

export const unionShards = (
  ours: readonly AuditEvent[],
  theirs: readonly AuditEvent[],
): ShardUnion => {
  const byIdentity = new Map<
    string,
    AuditEvent & { readonly arrival: number }
  >();
  ours.forEach((event, index) => {
    if (!byIdentity.has(event.identity)) {
      byIdentity.set(event.identity, { ...event, arrival: index });
    }
  });
  const oursIdentities = new Set(byIdentity.keys());
  let sharedCount = 0;
  theirs.forEach((event, index) => {
    if (oursIdentities.has(event.identity)) {
      sharedCount += 1;
      return;
    }
    if (!byIdentity.has(event.identity)) {
      byIdentity.set(event.identity, {
        ...event,
        arrival: ours.length + index,
      });
    }
  });

  return {
    events: orderEvents([...byIdentity.values()]),
    oursCount: ours.length,
    theirsCount: theirs.length,
    sharedCount,
    mergedCount: byIdentity.size,
  };
};

export const renderShard = (events: readonly AuditEvent[]): string =>
  events.reduce(
    (document, event) => `${document}\n${event.rendered}\n${BLOCK_SEPARATOR}`,
    `${SHARD_HEADER}\n`,
  );

export const mergeShardContents = (
  oursRaw: string,
  theirsRaw: string,
): Result<ShardUnion, ShardMergeFailure> => {
  const ours = parseShard(oursRaw);
  if (ours.outcome === "failed")
    return fail({
      reason: "side-unparseable",
      side: "ours",
      cause: ours.error,
    });
  const theirs = parseShard(theirsRaw);
  if (theirs.outcome === "failed")
    return fail({
      reason: "side-unparseable",
      side: "theirs",
      cause: theirs.error,
    });
  return succeed(unionShards(ours.value, theirs.value));
};

export type ShardSource =
  | { readonly kind: "file"; readonly path: string }
  | { readonly kind: "git-ref"; readonly ref: string; readonly path: string };

export type SourceReader = (
  source: ShardSource,
) => Result<string, ShardMergeFailure>;

const locatorOf = (source: ShardSource): string =>
  source.kind === "file" ? source.path : `${source.ref}:${source.path}`;

export const readSource: SourceReader = (source) => {
  if (source.kind === "file") {
    if (!existsSync(source.path))
      return fail({ reason: "source-unreadable", locator: source.path });
    return succeed(readFileSync(source.path, "utf-8"));
  }
  const shown = spawnSync("git", ["show", `${source.ref}:${source.path}`], {
    encoding: "utf-8",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (shown.status !== 0 || typeof shown.stdout !== "string")
    return fail({ reason: "source-unreadable", locator: locatorOf(source) });
  return succeed(shown.stdout);
};

export const mergeShardSources = ({
  ours,
  theirs,
  readSourceContent,
}: {
  readonly ours: ShardSource;
  readonly theirs: ShardSource;
  readonly readSourceContent: SourceReader;
}): Result<ShardUnion, ShardMergeFailure> => {
  const oursRaw = readSourceContent(ours);
  if (oursRaw.outcome === "failed") return oursRaw;
  const theirsRaw = readSourceContent(theirs);
  if (theirsRaw.outcome === "failed") return theirsRaw;
  if (CONFLICT_MARKER.test(normaliseLineEndings(oursRaw.value)))
    return fail({
      reason: "conflict-markers-present",
      locator: locatorOf(ours),
    });
  if (CONFLICT_MARKER.test(normaliseLineEndings(theirsRaw.value)))
    return fail({
      reason: "conflict-markers-present",
      locator: locatorOf(theirs),
    });
  return mergeShardContents(oursRaw.value, theirsRaw.value);
};

export const describeFailure = (failure: ShardMergeFailure): string => {
  if (failure.reason === "source-unreadable")
    return `cannot read shard source: ${failure.locator}`;
  if (failure.reason === "conflict-markers-present")
    return `refusing to merge: ${failure.locator} still contains conflict markers; supply the two clean sides (git refs or files), not a conflicted working-tree file`;
  const cause = failure.cause;
  const detail =
    cause.reason === "missing-header"
      ? `missing the '${SHARD_HEADER}' header — not an audit shard`
      : `an event block carries no **Timestamp** field:\n${cause.block.trim()}`;
  return `${failure.side} side is not a parseable audit shard: ${detail}`;
};

const argValue = (argv: readonly string[], flag: string): string | null => {
  const index = argv.indexOf(flag);
  return index === -1 || index + 1 >= argv.length ? null : argv[index + 1];
};

const sourceFromFlags = (
  argv: readonly string[],
  sideFlag: string,
  refFlag: string,
  path: string | null,
): ShardSource | null => {
  const ref = argValue(argv, refFlag);
  if (ref !== null && path !== null) return { kind: "git-ref", ref, path };
  const file = argValue(argv, sideFlag);
  return file === null ? null : { kind: "file", path: file };
};

const GATE_PROOF_EVENTS = new Set(["GATE_APPROVED", "STAGE_COMPLETED"]);
const AUDIT_DESTINATION = /\/intents\/[^/]+\/audit\//i;

export const resolveDestination = (outPath: string): string =>
  resolve(outPath).replace(/\\/g, "/");

export const isAuditDestination = (outPath: string): boolean =>
  AUDIT_DESTINATION.test(resolveDestination(outPath));

export type ProvenanceVerdict =
  | { readonly admissible: true }
  | {
      readonly admissible: false;
      readonly unprovenanced: readonly AuditEvent[];
    };

export const checkGateProofProvenance = ({
  events,
  committedIdentities,
}: {
  readonly events: readonly AuditEvent[];
  readonly committedIdentities: ReadonlySet<string>;
}): ProvenanceVerdict => {
  const unprovenanced = events.filter(
    (event) =>
      GATE_PROOF_EVENTS.has(event.eventType) &&
      !committedIdentities.has(event.identity),
  );
  return unprovenanced.length === 0
    ? { admissible: true }
    : { admissible: false, unprovenanced };
};

const committedGateProofIdentities = (
  resolvedOutPath: string,
): ReadonlySet<string> => {
  const tracked = spawnSync(
    "git",
    ["log", "--all", "--format=%H", "--", resolvedOutPath],
    { encoding: "utf-8", maxBuffer: 64 * 1024 * 1024 },
  );
  const revisions: readonly string[] =
    tracked.status === 0 && typeof tracked.stdout === "string"
      ? tracked.stdout.split("\n").filter((line: string) => line.trim() !== "")
      : [];
  return revisions.reduce((identities: Set<string>, revision: string) => {
    const shown = spawnSync(
      "git",
      [
        "show",
        `${revision}:./${relative(process.cwd(), resolvedOutPath).replace(/\\/g, "/")}`,
      ],
      { encoding: "utf-8", maxBuffer: 64 * 1024 * 1024 },
    );
    if (shown.status !== 0 || typeof shown.stdout !== "string") {
      process.stderr.write(
        `rin-gates-shard-merge: warning — revision ${revision} of the shard could not be read; its events are absent from the provenance set\n`,
      );
      return identities;
    }
    const parsed = parseShard(shown.stdout);
    if (parsed.outcome === "failed") {
      process.stderr.write(
        `rin-gates-shard-merge: warning — revision ${revision} of the shard did not parse; its events are absent from the provenance set\n`,
      );
      return identities;
    }
    parsed.value.forEach((event) => {
      identities.add(event.identity);
    });
    return identities;
  }, new Set<string>());
};

const USAGE = `rin-gates:shard-merge — timestamp-ordered, identity-deduplicated union of two audit-shard versions.

  Two files:
    pnpm rin-gates:shard-merge --ours <file> --theirs <file> --out <file>

  Two git refs sharing one path:
    pnpm rin-gates:shard-merge --path <shard-path> --ours-ref <ref> --theirs-ref <ref> --out <file>

  Omit --out to print the merged shard to stdout. --json prints only the counts.`;

export const runCli = (argv: readonly string[]): number => {
  if (argv.includes("--help")) {
    process.stdout.write(`${USAGE}\n`);
    return 0;
  }

  const path = argValue(argv, "--path");
  const ours = sourceFromFlags(argv, "--ours", "--ours-ref", path);
  const theirs = sourceFromFlags(argv, "--theirs", "--theirs-ref", path);
  if (ours === null || theirs === null) {
    process.stderr.write(
      `rin-gates-shard-merge: both sides are required.\n\n${USAGE}\n`,
    );
    return 2;
  }

  const merged = mergeShardSources({
    ours,
    theirs,
    readSourceContent: readSource,
  });
  if (merged.outcome === "failed") {
    process.stderr.write(
      `rin-gates-shard-merge: ${describeFailure(merged.error)}\n`,
    );
    return 1;
  }

  const { events, oursCount, theirsCount, sharedCount, mergedCount } =
    merged.value;
  const outPath = argValue(argv, "--out");

  const resolvedOutPath = outPath === null ? null : resolveDestination(outPath);

  if (resolvedOutPath !== null && isAuditDestination(resolvedOutPath)) {
    const provenance = checkGateProofProvenance({
      events,
      committedIdentities: committedGateProofIdentities(resolvedOutPath),
    });
    if (!provenance.admissible) {
      process.stderr.write(
        `rin-gates-shard-merge: refusing to write ${resolvedOutPath} — ${provenance.unprovenanced.length} gate-proof event(s) in the merged output are absent from every committed revision of this shard. A conflict resolution unions committed history; it never introduces new gate proof. Offending event(s):\n${provenance.unprovenanced
          .map((event) => `  ${event.timestamp} ${event.eventType}`)
          .join("\n")}\n`,
      );
      return 1;
    }
  }

  const summary = {
    ours: oursCount,
    theirs: theirsCount,
    sharedDropped: sharedCount,
    merged: mergedCount,
    unionInvariantHolds: mergedCount === oursCount + theirsCount - sharedCount,
  };
  process.stderr.write(`${JSON.stringify(summary)}\n`);
  if (!summary.unionInvariantHolds) {
    process.stderr.write(
      "rin-gates-shard-merge: refusing to write — the union invariant does not hold, so the merge would lose or duplicate an audit event. The destination is left untouched.\n",
    );
    return 1;
  }

  if (resolvedOutPath !== null)
    writeFileSync(resolvedOutPath, renderShard(events), "utf-8");
  else if (!argv.includes("--json")) process.stdout.write(renderShard(events));

  return 0;
};

if (import.meta.main) process.exit(runCli(process.argv.slice(2)));
