// The single roster resolver for the rin-gates review floor (IF-4).
//
// Three copies of this logic existed — one in the autonomy gate, one in the
// review scribe, one in the verdict emitter — and they drifted, which is how the
// floor came to be stated but unenforced. The shared unit is the fix rather than
// three coincidentally-agreeing edits.
//
// THE RESOLUTION IS A CLOSED UNION, and that is the load-bearing part. Every
// copy previously returned `[]` from its catch arm and its non-object guard, so
// `[]` carried two incompatible meanings — "the operator declared no floor" and
// "I could not read the config" — and `[].every(...)` is vacuously true. An
// unreadable config therefore disabled the floor at every enforcer with no config
// edit at all. Consolidating three readers into one whose catch still returned
// `[]` would have CENTRALISED that bypass, which is worse than three copies of it.
//
// A caller cannot ignore the unreadable arm: there is no roster to iterate on it.

import { readFileSync } from "node:fs";

const ANNOTATION_KEY_PREFIX = "$";

const stringArrayOf = (value: unknown): readonly string[] =>
  Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];

export type RosterConfig = {
  readonly defaultRoster: readonly string[];
  readonly byGate: Readonly<Record<string, readonly string[]>>;
};

export const readRosterConfig = (
  configPath: string,
): RosterConfig | { readonly unreadable: string } => {
  let raw: string;
  try {
    raw = readFileSync(configPath, "utf-8");
  } catch {
    return { unreadable: `cannot read ${configPath}` };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { unreadable: `${configPath} is not parseable JSON` };
  }
  // Array.isArray is not redundant with the typeof check: an array IS an object,
  // and a valid-JSON array reached the old guard's success path.
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed))
    return { unreadable: `${configPath} does not contain a JSON object` };
  const record = parsed as { defaultRoster?: unknown; byGate?: unknown };
  const byGateRaw =
    typeof record.byGate === "object" && record.byGate !== null
      ? (record.byGate as Record<string, unknown>)
      : {};
  const byGate = Object.fromEntries(
    Object.keys(byGateRaw)
      .filter((key) => !key.startsWith(ANNOTATION_KEY_PREFIX))
      .map((key) => [key, stringArrayOf(byGateRaw[key])] as const),
  );
  return { defaultRoster: stringArrayOf(record.defaultRoster), byGate };
};

// `source` rides on the resolved arm because the ONE place that decides which
// side of the fall-through was taken is the only place that can report it
// without re-deriving it. IF-2's refusal contract requires naming whether the
// floor came from `byGate` or `defaultRoster`, and the dispatch tool prints the
// same fact — two consumers, one derivation.
export type RosterResolution =
  | {
      readonly kind: "resolved";
      readonly roster: readonly string[];
      readonly source: "byGate" | "defaultRoster";
    }
  | { readonly kind: "unreadable"; readonly reason: string };

// The DECISION, separated from the READ so a caller can assert the fall-through
// rules without touching a filesystem. `sourceLabel` names the config in the
// no-floor-anywhere message; the reading caller passes its path.
export const rosterFrom = ({
  config,
  gate,
  sourceLabel,
}: {
  readonly config: RosterConfig;
  readonly gate: string;
  readonly sourceLabel: string;
}): RosterResolution => {
  // An EMPTY byGate entry falls through to defaultRoster. It never means "no
  // floor for this gate" — that reading is what made a one-character config edit
  // enough to silently disable the floor for any single gate.
  const declared = config.byGate[gate];
  const declaredInByGate = declared !== undefined && declared.length > 0;
  const roster = declaredInByGate ? declared : config.defaultRoster;
  if (roster.length === 0)
    return {
      kind: "unreadable",
      reason: `${sourceLabel} declares no lenses for '${gate}' and no defaultRoster`,
    };
  return {
    kind: "resolved",
    roster,
    source: declaredInByGate ? "byGate" : "defaultRoster",
  };
};

export const resolveReviewRoster = ({
  configPath,
  gate,
}: {
  readonly configPath: string;
  readonly gate: string;
}): RosterResolution => {
  const config = readRosterConfig(configPath);
  if ("unreadable" in config)
    return { kind: "unreadable", reason: config.unreadable };
  return rosterFrom({ config, gate, sourceLabel: configPath });
};
