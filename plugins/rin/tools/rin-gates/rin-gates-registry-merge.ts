import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const CONFLICT_MARKER = /^(<{7}|={7}|>{7}|\|{7})/m;

type Result<T, E> =
  | { readonly outcome: "ok"; readonly value: T }
  | { readonly outcome: "failed"; readonly error: E };

const succeed = <T>(value: T): Result<T, never> => ({ outcome: "ok", value });
const fail = <E>(error: E): Result<never, E> => ({ outcome: "failed", error });

type RegistryRow = {
  readonly uuid: string;
  readonly slug: string;
  readonly dirName?: string;
  readonly scope?: string;
  readonly repos?: readonly string[];
  readonly status: string;
};

type RegistryParseFailure =
  | { readonly reason: "not-json"; readonly detail: string }
  | { readonly reason: "not-an-array" }
  | { readonly reason: "row-missing-identity"; readonly index: number };

type RegistryMergeFailure =
  | {
      readonly reason: "side-unparseable";
      readonly side: string;
      readonly cause: RegistryParseFailure;
    }
  | { readonly reason: "source-unreadable"; readonly locator: string }
  | { readonly reason: "conflict-markers-present"; readonly locator: string }
  | {
      readonly reason: "divergent-row";
      readonly uuid: string;
      readonly ours: string;
      readonly theirs: string;
    };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const stringField = (
  row: Record<string, unknown>,
  key: string,
): string | null =>
  typeof row[key] === "string" ? (row[key] as string) : null;

const parseRow = (
  value: unknown,
  index: number,
): Result<RegistryRow, RegistryParseFailure> => {
  if (!isRecord(value)) return fail({ reason: "row-missing-identity", index });
  const uuid = stringField(value, "uuid");
  const slug = stringField(value, "slug");
  const status = stringField(value, "status");
  if (uuid === null || slug === null || status === null) {
    return fail({ reason: "row-missing-identity", index });
  }
  const repos = value.repos;
  return succeed({
    uuid,
    slug,
    ...(typeof value.dirName === "string" ? { dirName: value.dirName } : {}),
    ...(typeof value.scope === "string" ? { scope: value.scope } : {}),
    ...(Array.isArray(repos) &&
    repos.every((entry) => typeof entry === "string")
      ? { repos: repos as readonly string[] }
      : {}),
    status,
  });
};

const parseRegistry = (
  raw: string,
): Result<readonly RegistryRow[], RegistryParseFailure> => {
  const parsed: unknown = (() => {
    try {
      return JSON.parse(raw.replace(/\r\n/g, "\n"));
    } catch (cause) {
      return cause instanceof Error ? cause : new Error(String(cause));
    }
  })();
  if (parsed instanceof Error) {
    return fail({ reason: "not-json", detail: parsed.message });
  }
  if (!Array.isArray(parsed)) return fail({ reason: "not-an-array" });
  return parsed
    .map((value, index) => parseRow(value, index))
    .reduce<Result<readonly RegistryRow[], RegistryParseFailure>>(
      (accumulated, row) => {
        if (accumulated.outcome === "failed") return accumulated;
        if (row.outcome === "failed") return row;
        return succeed([...accumulated.value, row.value]);
      },
      succeed([]),
    );
};

const canonicalOf = (row: RegistryRow): string => JSON.stringify(row);

const byUuid = (
  rows: readonly RegistryRow[],
): ReadonlyMap<string, RegistryRow> =>
  new Map(rows.map((row) => [row.uuid, row]));

const resolveRow = (args: {
  readonly uuid: string;
  readonly ours: RegistryRow | undefined;
  readonly theirs: RegistryRow | undefined;
  readonly base: RegistryRow | undefined;
}): Result<RegistryRow | null, RegistryMergeFailure> => {
  const { uuid, ours, theirs, base } = args;
  if (ours === undefined) return succeed(theirs ?? null);
  if (theirs === undefined) return succeed(ours);
  if (canonicalOf(ours) === canonicalOf(theirs)) return succeed(ours);
  const baseCanonical = base === undefined ? null : canonicalOf(base);
  if (baseCanonical === canonicalOf(ours)) return succeed(theirs);
  if (baseCanonical === canonicalOf(theirs)) return succeed(ours);
  return fail({
    reason: "divergent-row",
    uuid,
    ours: canonicalOf(ours),
    theirs: canonicalOf(theirs),
  });
};

type RegistryMergeSummary = {
  readonly ours: number;
  readonly theirs: number;
  readonly merged: number;
  readonly addedFromTheirs: number;
  readonly takenFromTheirs: number;
};

type RegistryMergeSuccess = {
  readonly rows: readonly RegistryRow[];
  readonly summary: RegistryMergeSummary;
};

const mergeRegistries = (args: {
  readonly ours: readonly RegistryRow[];
  readonly theirs: readonly RegistryRow[];
  readonly base: readonly RegistryRow[];
}): Result<RegistryMergeSuccess, RegistryMergeFailure> => {
  const oursByUuid = byUuid(args.ours);
  const theirsByUuid = byUuid(args.theirs);
  const baseByUuid = byUuid(args.base);
  const orderedUuids = [
    ...args.ours.map((row) => row.uuid),
    ...args.theirs
      .map((row) => row.uuid)
      .filter((uuid) => !oursByUuid.has(uuid)),
  ];
  return orderedUuids.reduce<
    Result<RegistryMergeSuccess, RegistryMergeFailure>
  >(
    (accumulated, uuid) => {
      if (accumulated.outcome === "failed") return accumulated;
      const resolved = resolveRow({
        uuid,
        ours: oursByUuid.get(uuid),
        theirs: theirsByUuid.get(uuid),
        base: baseByUuid.get(uuid),
      });
      if (resolved.outcome === "failed") return resolved;
      if (resolved.value === null) return accumulated;
      const wasOurs = oursByUuid.has(uuid);
      const ourRow = oursByUuid.get(uuid);
      const tookTheirs =
        wasOurs &&
        ourRow !== undefined &&
        canonicalOf(resolved.value) !== canonicalOf(ourRow);
      return succeed({
        rows: [...accumulated.value.rows, resolved.value],
        summary: {
          ours: args.ours.length,
          theirs: args.theirs.length,
          merged: accumulated.value.summary.merged + 1,
          addedFromTheirs:
            accumulated.value.summary.addedFromTheirs + (wasOurs ? 0 : 1),
          takenFromTheirs:
            accumulated.value.summary.takenFromTheirs + (tookTheirs ? 1 : 0),
        },
      });
    },
    succeed({
      rows: [],
      summary: {
        ours: args.ours.length,
        theirs: args.theirs.length,
        merged: 0,
        addedFromTheirs: 0,
        takenFromTheirs: 0,
      },
    }),
  );
};

const renderRegistry = (rows: readonly RegistryRow[]): string =>
  `${JSON.stringify(rows, null, 2)}\n`;

const readSide = (args: {
  readonly locator: string;
  readonly side: string;
}): Result<readonly RegistryRow[], RegistryMergeFailure> => {
  if (!existsSync(args.locator)) {
    return fail({ reason: "source-unreadable", locator: args.locator });
  }
  const raw = readFileSync(args.locator, "utf-8");
  if (CONFLICT_MARKER.test(raw)) {
    return fail({ reason: "conflict-markers-present", locator: args.locator });
  }
  const parsed = parseRegistry(raw);
  return parsed.outcome === "failed"
    ? fail({ reason: "side-unparseable", side: args.side, cause: parsed.error })
    : succeed(parsed.value);
};

type MergeSides = {
  readonly ours: readonly RegistryRow[];
  readonly theirs: readonly RegistryRow[];
  readonly base: readonly RegistryRow[];
};

const readAllSides = (args: {
  readonly oursPath: string;
  readonly theirsPath: string;
  readonly basePath: string | null;
}): Result<MergeSides, RegistryMergeFailure> => {
  const ours = readSide({ locator: resolve(args.oursPath), side: "ours" });
  if (ours.outcome === "failed") return ours;
  const theirs = readSide({
    locator: resolve(args.theirsPath),
    side: "theirs",
  });
  if (theirs.outcome === "failed") return theirs;
  const base =
    args.basePath === null || !existsSync(resolve(args.basePath))
      ? succeed([] as readonly RegistryRow[])
      : readSide({ locator: resolve(args.basePath), side: "base" });
  if (base.outcome === "failed") return base;
  return succeed({ ours: ours.value, theirs: theirs.value, base: base.value });
};

const describeParseFailure = (failure: RegistryParseFailure): string => {
  switch (failure.reason) {
    case "not-json":
      return `not valid JSON (${failure.detail})`;
    case "not-an-array":
      return "the registry must be a JSON array";
    case "row-missing-identity":
      return `row ${failure.index} lacks a string uuid/slug/status`;
  }
};

const describeFailure = (failure: RegistryMergeFailure): string => {
  switch (failure.reason) {
    case "source-unreadable":
      return `cannot read registry source: ${failure.locator}`;
    case "conflict-markers-present":
      return `refusing a side that already carries conflict markers: ${failure.locator}`;
    case "side-unparseable":
      return `the ${failure.side} side is unusable — ${describeParseFailure(failure.cause)}`;
    case "divergent-row":
      return [
        `both sides changed intent ${failure.uuid} differently, and neither matches the merge base.`,
        `  ours:   ${failure.ours}`,
        `  theirs: ${failure.theirs}`,
        "  Resolve by hand — a registry row carries mutable state (status), so",
        "  picking a side automatically would silently discard a real transition.",
      ].join("\n");
  }
};

const USAGE = `rin-gates-registry-merge — three-way union merge for aidlc intents.json

  Rows are keyed on uuid. A row present on one side only is kept. A row changed
  on one side only takes that side. A row changed on BOTH sides to different
  values fails loudly rather than guessing, because status is mutable state.

  pnpm rin-gates:registry-merge --base <file> --ours <file> --theirs <file> [--out <file>]

  As a git merge driver the three files are %O %A %B and the output is %A.
  Omit --out to print to stdout. --json prints only the counts.`;

const argValue = (argv: readonly string[], flag: string): string | null => {
  const index = argv.indexOf(flag);
  return index === -1 || index + 1 >= argv.length
    ? null
    : (argv[index + 1] ?? null);
};

const runCli = (argv: readonly string[]): number => {
  if (argv.includes("--help")) {
    process.stdout.write(`${USAGE}\n`);
    return 0;
  }
  const oursPath = argValue(argv, "--ours");
  const theirsPath = argValue(argv, "--theirs");
  const basePath = argValue(argv, "--base");
  if (oursPath === null || theirsPath === null) {
    process.stderr.write(
      `rin-gates-registry-merge: --ours and --theirs are required.\n\n${USAGE}\n`,
    );
    return 2;
  }

  const sides = readAllSides({ oursPath, theirsPath, basePath });
  if (sides.outcome === "failed") {
    process.stderr.write(
      `rin-gates-registry-merge: ${describeFailure(sides.error)}\n`,
    );
    return 1;
  }

  const merged = mergeRegistries(sides.value);
  if (merged.outcome === "failed") {
    process.stderr.write(
      `rin-gates-registry-merge: ${describeFailure(merged.error)}\n`,
    );
    return 1;
  }

  const outPath = argValue(argv, "--out");
  const rendered = renderRegistry(merged.value.rows);
  if (outPath !== null) writeFileSync(resolve(outPath), rendered, "utf-8");
  if (argv.includes("--json")) {
    process.stdout.write(`${JSON.stringify(merged.value.summary)}\n`);
    return 0;
  }
  if (outPath === null) process.stdout.write(rendered);
  return 0;
};

if (import.meta.main) process.exit(runCli(process.argv.slice(2)));

export type {
  RegistryMergeFailure,
  RegistryMergeSummary,
  RegistryParseFailure,
  RegistryRow,
};

export {
  describeFailure,
  mergeRegistries,
  parseRegistry,
  renderRegistry,
  runCli,
};
