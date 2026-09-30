import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

type GuardManifestEntry = {
  id: string;
  runtimePath: string;
  matcher: string;
};

type PluginHookRow = {
  event: string;
  matcher?: string;
  target: string;
  hookFile: string;
};

const pluginManifestPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  ".aidlc-plugin",
  "plugin.json",
);

const isPluginHookRow = (value: unknown): value is PluginHookRow => {
  if (typeof value !== "object" || value === null) return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row["event"] === "string" &&
    typeof row["target"] === "string" &&
    typeof row["hookFile"] === "string" &&
    (row["matcher"] === undefined || typeof row["matcher"] === "string")
  );
};

const claudeHookRows = (manifestContent: string): readonly PluginHookRow[] => {
  const parsed: unknown = JSON.parse(manifestContent);
  if (typeof parsed !== "object" || parsed === null) return [];
  const aidlc = (parsed as Record<string, unknown>)["aidlc"];
  if (typeof aidlc !== "object" || aidlc === null) return [];
  const hooks = (aidlc as Record<string, unknown>)["hooks"];
  if (typeof hooks !== "object" || hooks === null) return [];
  const claude = (hooks as Record<string, unknown>)["claude"];
  return Array.isArray(claude) ? claude.filter(isPluginHookRow) : [];
};

const guardManifestFrom = (
  manifestContent: string,
): readonly GuardManifestEntry[] =>
  claudeHookRows(manifestContent)
    .filter((row) => row.event === "PreToolUse" && row.matcher !== undefined)
    .map((row) => ({
      id: row.target,
      runtimePath: join(".claude", "hooks", row.hookFile).replaceAll("\\", "/"),
      matcher: row.matcher ?? "",
    }));

const GUARD_MANIFEST: readonly GuardManifestEntry[] = guardManifestFrom(
  readFileSync(pluginManifestPath, "utf-8"),
);

export type { GuardManifestEntry };
export { GUARD_MANIFEST, guardManifestFrom };
