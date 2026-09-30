// rin-gates review roster resolver — answers "who must I convene at this gate?"
//
// The roster has always been machine-readable (review-rosters.json, read by the
// SubagentStop review-scribe and the autonomy gate). Nothing derived the
// DISPATCH list from it, so a session convening a board picked lenses by hand.
// Pick the wrong set and the scribe captures every lens faithfully, withholds
// the aggregate as "roster incomplete", and writes no verdict — a silent
// no-verdict that looks exactly like a successful review round: real agents,
// real findings, no artefact. That is the failure this tool removes, by making
// the dispatch list derived rather than remembered (2026-07-26).
//
// Read-only. Resolves the active intent's gate the same way the scribe does —
// engine Current Stage, normalised to the bare slug — then prints that gate's
// minimum roster. Coverage is still proven by the scribe from harness-set
// agent identities; this tool only stops a session convening the wrong board.
//
// Usage:
//   bun .claude/tools/rin-gates/rin-gates-review-roster.ts [--gate <slug>] [--json]
//     --gate   resolve for an explicit gate instead of the active intent's
//     --json   machine-readable output
//
// Env seams (selftest hermeticity): RIN_GATES_WORKSPACE_ROOT, RIN_GATES_SPACE,
//   RIN_GATES_ROSTER_CONFIG.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  type RosterConfig,
  readRosterConfig,
  rosterFrom,
} from "../../hooks/shared-review-roster.ts";

const HERE = dirname(fileURLToPath(import.meta.url));

const nearestCheckoutAt = (dir: string, fallback: string): string => {
  if (existsSync(join(dir, ".git"))) return dir;
  const parent = dirname(dir);
  return parent === dir ? fallback : nearestCheckoutAt(parent, fallback);
};

const checkoutRootFrom = (start: string): string =>
  nearestCheckoutAt(resolve(start), resolve(start));

const WORKSPACE_ROOT =
  process.env.RIN_GATES_WORKSPACE_ROOT ?? checkoutRootFrom(HERE);
const SPACE = process.env.RIN_GATES_SPACE ?? "default";

export const ROSTER_CONFIG_PATH =
  process.env.RIN_GATES_ROSTER_CONFIG ??
  join(dirname(dirname(HERE)), "hooks", "review-rosters.json");

const argValue = (flag: string): string | null => {
  const index = process.argv.indexOf(flag);
  return index === -1 || index + 1 >= process.argv.length
    ? null
    : process.argv[index + 1];
};

const intentsRoot = (): string =>
  join(WORKSPACE_ROOT, "aidlc", "spaces", SPACE, "intents");

const activeRecordDir = (): string | null => {
  const root = intentsRoot();
  const cursor = join(root, "active-intent");
  if (existsSync(cursor)) {
    const name = readFileSync(cursor, "utf-8").trim();
    if (name !== "" && existsSync(join(root, name))) return join(root, name);
  }
  if (!existsSync(root)) return null;
  const dirs = readdirSync(root, { withFileTypes: true }).filter(
    (entry) =>
      entry.isDirectory() &&
      existsSync(join(root, entry.name, "aidlc-state.md")),
  );
  return dirs.length === 1 ? join(root, dirs[0].name) : null;
};

const fieldFrom = (content: string, field: string): string | null => {
  const match = content.match(
    new RegExp(`^\\s*-\\s*\\*\\*${field}\\*\\*\\s*:\\s*(.+?)\\s*$`, "m"),
  );
  return match === null ? null : match[1];
};

const currentGateOf = (recordDir: string): string | null => {
  const statePath = join(recordDir, "aidlc-state.md");
  if (!existsSync(statePath)) return null;
  return fieldFrom(readFileSync(statePath, "utf8"), "Current Stage");
};

export type RosterResolution =
  | {
      readonly kind: "resolved";
      readonly gate: string;
      readonly roster: readonly string[];
      readonly source: "byGate" | "defaultRoster";
    }
  | { readonly kind: "no-gate"; readonly reason: string }
  | { readonly kind: "unreadable"; readonly reason: string };

// IF-4's shape freeze is "one exported resolver consumed by all THREE call
// sites". This is the third. It previously carried its own copy which returned
// `defaultRoster: []` on a non-object config, had no parse catch at all, and
// omitted the Array.isArray guard — so a valid-JSON array reached the success
// path and this tool printed a ZERO-LENS roster and exited 0.
//
// That is this tool's own stated failure mode arriving one layer out: it exists
// to stop a session convening the wrong board, and an empty roster advises
// convening nothing. Not on the approve-authorising path (the autonomy gate
// resolves its own floor), so not a gate bypass — but the drift surface IF-4
// consolidated to remove.
export const resolveRoster = (args: {
  readonly rawGate: string | null;
  readonly config: RosterConfig;
}): RosterResolution => {
  if (args.rawGate === null) {
    return {
      kind: "no-gate",
      reason:
        "no gate resolvable — no active intent with a Current Stage; pass --gate <slug>",
    };
  }
  const gate = args.rawGate;
  const resolution = rosterFrom({
    config: args.config,
    gate,
    sourceLabel: ROSTER_CONFIG_PATH,
  });
  // `unreadable` passes straight through rather than being relabelled: it means
  // here exactly what it means in the shared unit, and these are the same layer.
  // `no-gate` is the arm this tool genuinely owns — gate resolution is its own
  // concern, which the shared resolver knows nothing about.
  if (resolution.kind === "unreadable") return resolution;
  return {
    kind: "resolved",
    gate,
    roster: resolution.roster,
    source: resolution.source,
  };
};

const run = (): void => {
  const explicitGate = argValue("--gate");
  const recordDir = explicitGate === null ? activeRecordDir() : null;
  const rawGate =
    explicitGate ?? (recordDir === null ? null : currentGateOf(recordDir));

  const config = readRosterConfig(ROSTER_CONFIG_PATH);
  if ("unreadable" in config) {
    console.error(`rin-gates-review-roster: ${config.unreadable}`);
    process.exit(1);
  }

  const resolution = resolveRoster({ rawGate, config });
  if (resolution.kind !== "resolved") {
    console.error(`rin-gates-review-roster: ${resolution.reason}`);
    process.exit(1);
  }

  const { gate, roster, source } = resolution;

  if (process.argv.includes("--json")) {
    console.log(
      JSON.stringify(
        {
          gate,
          recordDir: recordDir === null ? null : recordDir.replace(/\\/g, "/"),
          roster,
          source,
        },
        null,
        2,
      ),
    );
    return;
  }

  console.log(`gate:   ${gate}`);
  console.log(`source: ${source}`);
  console.log(`roster (${roster.length} lenses — ALL must be dispatched):`);
  roster.forEach((lens) => {
    console.log(`  - ${lens}`);
  });
  console.log("");
  console.log(
    "Each lens ends its final message with the rin-gates-lens:v1 block declaring",
  );
  console.log(
    `gate "${gate}". Convening fewer than the full roster yields NO verdict —`,
  );
  console.log(
    "the scribe captures what ran and withholds the aggregate as roster-incomplete.",
  );
};

const invokedDirectly =
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) run();
