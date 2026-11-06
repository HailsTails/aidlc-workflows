// plugin-contributions.ts — what a plugin contributes that core's declarative
// contribution path cannot carry on its own: hook registrations, and the plugin's
// own prose tokens.
//
// A plugin ships hook BODIES through the normal contribution path (they land
// in the install's hooks dir alongside core's). What it cannot do without this
// seam is get them REGISTERED with the harness and get its payload translated:
// registration lives in each harness's emit (hooks.json / plugin API) and
// translation lives in that harness's adapter, both upstream-authored surfaces.
//
// This reader lets a plugin declare rows in the SAME shape core's own wiring
// table uses, so a harness emit unions them in and the adapter resolves an
// unrecognised target to the declared body via its existing runCore. The
// adapter's payload normalisation, replay cache and forwarding are reused
// verbatim — a plugin never re-implements them.
//
// Declared in .aidlc-plugin/plugin.json:
//
//   "aidlc": {
//     "hooks": {
//       "codex":    [{ "event": "PreToolUse", "matcher": "Bash",
//                      "target": "rin-guard-navigation",
//                      "hookFile": "guard-navigation.ts" }],
//       "opencode": [{ "event": "PreToolUse", "target": "rin-guard-navigation",
//                      "hookFile": "guard-navigation.ts" }]
//     }
//   }
//
// Per-harness because the moments and matchers differ: codex matches a shell
// tool named "Bash", opencode has no matcher concept on tool.execute.before.
// A plugin declaring no block for a harness contributes nothing there, which is
// how a plugin opts out of a face it has not verified.

import { readPluginHookSource } from "./plugin-hook-source.ts";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { PluginHookRow } from "../core/tools/aidlc-plugin-hook-registrations.ts";

// `target` names the hook BODY the adapter dispatches to. `capabilityId` is
// optional and names the capability that body implements, for plugins whose
// adapters route by capability rather than by body: several bodies can be arms
// of one capability (a SessionStart hook and its PostToolUse follow-up), and a
// plugin's capability vocabulary is its own, so it cannot be derived from the
// target string. Absent means the plugin does not route by capability, which is
// the default and stays valid.
export type { PluginHookRow };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const rowsFromManifest = (
  pluginsRoot: string,
  pluginName: string,
  harnessName: string,
): PluginHookRow[] => {
  const manifestPath = join(pluginsRoot, pluginName, ".aidlc-plugin", "plugin.json");
  if (!existsSync(manifestPath)) return [];
  const read = readPluginHookSource({ manifest: JSON.parse(readFileSync(manifestPath, "utf-8")), pluginName, harness: harnessName });
  if (read.kind === "invalid") throw new Error(read.message);
  return [...read.rows];
};

/**
 * Every enabled plugin's hook rows for one harness, in stable plugin order.
 *
 * Target collisions across plugins are a hard error: two plugins claiming one
 * target name would make the adapter's dispatch ambiguous, and silently letting
 * the last writer win is how one plugin disables another's guard.
 */
export function pluginHookRows(
  repoRoot: string,
  harnessName: string,
): PluginHookRow[] {
  const pluginsRoot = join(repoRoot, "plugins");
  if (!existsSync(pluginsRoot)) return [];
  const rows = readdirSync(pluginsRoot)
    .filter((name) =>
      existsSync(join(pluginsRoot, name, ".aidlc-plugin", "plugin.json")),
    )
    .sort()
    .flatMap((name) => rowsFromManifest(pluginsRoot, name, harnessName));
  const claimedBy = new Map<string, string>();
  for (const row of rows) {
    const previous = claimedBy.get(row.target);
    if (previous !== undefined && previous !== row.pluginName)
      throw new Error(
        `hook target "${row.target}" is claimed by both plugins/${previous} and plugins/${row.pluginName}. Targets must be unique across plugins.`,
      );
    claimedBy.set(row.target, row.pluginName);
  }
  return rows;
}

export { renderPluginHookContributions } from "../core/projection/plugin-hook.ts";

/**
 * A plugin's own prose tokens, substituted into its projected content.
 *
 * Core declares exactly one transform class ({{HARNESS_DIR}}); a plugin whose
 * prose names project-specific things — the operator, the identities it acts
 * as, the commands it tells a reader to run — needs the same affordance or it
 * ships either a raw token or someone's actual name. Both are wrong for an
 * adopter: the first is broken text, the second is another project's identity.
 *
 * Declared in .aidlc-plugin/plugin.json as a flat token → default map:
 *
 *   "aidlc": { "tokens": { "{{OPERATOR}}": "the operator" } }
 *
 * The values are DEFAULTS, deliberately neutral. An installed project overrides
 * them through its own config; the projection's job is only to ensure no raw
 * token and no foreign identity reaches the adopter's tree.
 */
export function pluginTokens(
  repoRoot: string,
  pluginName: string,
  harnessName: string,
): Record<string, string> {
  const manifestPath = join(repoRoot, "plugins", pluginName, ".aidlc-plugin", "plugin.json");
  if (!existsSync(manifestPath)) return {};
  const manifest: unknown = JSON.parse(readFileSync(manifestPath, "utf-8"));
  if (!isRecord(manifest)) return {};
  const aidlc = manifest.aidlc;
  if (!isRecord(aidlc)) return {};
  const tokens = aidlc.tokens;
  if (!isRecord(tokens)) return {};

  const flatten = (source: Record<string, unknown>, where: string) => {
    const resolved: Record<string, string> = {};
    for (const [token, value] of Object.entries(source)) {
      if (typeof value !== "string")
        throw new Error(`plugins/${pluginName}: ${where}["${token}"] must be a string.`);
      resolved[token] = value;
    }
    return resolved;
  };

  // Shared defaults, then this harness's overrides. A token whose value is the
  // SAME on every face (an identity, a command contract) is declared once;
  // one that names a face-specific affordance is overridden per face, because
  // a single value there would be wrong on every face but one.
  const shared = flatten(
    Object.fromEntries(
      Object.entries(tokens).filter(([, value]) => typeof value === "string"),
    ),
    "aidlc.tokens",
  );
  const perHarness = tokens.harness;
  if (perHarness === undefined) return shared;
  if (!isRecord(perHarness))
    throw new Error(`plugins/${pluginName}: aidlc.tokens.harness must be an object.`);
  const overrides = perHarness[harnessName];
  if (overrides === undefined) return shared;
  if (!isRecord(overrides))
    throw new Error(
      `plugins/${pluginName}: aidlc.tokens.harness.${harnessName} must be an object.`,
    );
  return { ...shared, ...flatten(overrides, `aidlc.tokens.harness.${harnessName}`) };
}

/** Apply a plugin's declared tokens to one projected .md body. */
export function substitutePluginTokens(
  content: string,
  tokens: Record<string, string>,
): string {
  return Object.entries(tokens).reduce(
    (projected, [token, value]) => projected.replaceAll(token, value),
    content,
  );
}
