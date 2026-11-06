import type { PluginHookRow, PluginHookContribution, ProjectedPluginHookContributions, PluginHookProjectionInput } from "./plugin-hook-types.ts";
export type { PluginHookRow, NativeHookGroup, PluginHookContribution, ProjectedPluginHookContributions, PluginHookProjectionInput } from "./plugin-hook-types.ts";

const runnerFor = (hookFile: string): string =>
  hookFile.endsWith(".mjs") || hookFile.endsWith(".js") ? "node" : "bun";

type HookRowProjectionInput = { readonly projection: PluginHookProjectionInput<string>; readonly row: PluginHookRow };

const adapterHookContributions = ({ projection, row }: HookRowProjectionInput): PluginHookContribution[] => {
  if (projection.harness !== "codex" && projection.harness !== "copilot") return [];
  const command = projection.harness === "codex"
    ? `${projection.invocation} ${projection.trustedNamespace} adapter codex ${row.target}`
    : `bun ${projection.harnessDir}/hooks/aidlc-copilot-adapter.ts ${row.target}`;
  return [{ kind: "group", path: projection.harness === "codex" ? `${projection.harnessDir}/hooks.json` : ".github/hooks/aidlc.json", event: row.event, group: projection.harness === "codex"
    ? { ...(row.matcher === undefined ? {} : { matcher: row.matcher }), hooks: [{ type: "command", command }] }
    : { type: "command", bash: command, powershell: command, timeoutSec: 30 } },
  { kind: "target", path: `${projection.harnessDir}/hooks/plugin-hook-targets.json`, target: row.target, hookFile: row.hookFile }];
};

const hookRowContributions = ({ projection, row }: HookRowProjectionInput): PluginHookContribution[] => {
  if (row.target === "aidlc-plugin-compose") return [];
  if (projection.harness === "cursor") return [{ kind: "event-body", path: `${projection.harnessDir}/hooks/plugin-hook-targets.json`, event: row.event, hookFile: row.hookFile }];
  if (projection.harness === "opencode") return [{ kind: "event-row", path: `${projection.harnessDir}/hooks/plugin-hook-rows.json`, row }];
  if (projection.harness === "claude") return [{ kind: "group", path: `${projection.harnessDir}/settings.json`, event: row.event, group: {
    ...(row.matcher === undefined ? {} : { matcher: row.matcher }),
    hooks: [{ type: "command", command: `${runnerFor(row.hookFile)} "$CLAUDE_PROJECT_DIR/${projection.harnessDir}/hooks/${row.hookFile}"` }],
  } }];
  return adapterHookContributions({ projection, row });
};

export function renderPluginHookContributions<Harness extends string>(input: PluginHookProjectionInput<Harness>): ProjectedPluginHookContributions<Harness> {
  return { schemaVersion: 1, pluginName: input.pluginName, harness: input.harness,
    registrations: input.rows.flatMap((row) => hookRowContributions({ projection: input, row })),
  };
}
