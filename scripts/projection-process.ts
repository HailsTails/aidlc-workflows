import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { qualifiedHarnessByName } from "./projection/src/adapters/qualified-harness-profile.ts";
import type { Tier } from "./projection/src/domain/model.ts";

export type ClaudeCopyProfile = { readonly buildVersion: string; readonly environmentCap: Tier | null };
export type ClaudeCopyRequest = ClaudeCopyProfile & { readonly sourceRoot: string; readonly outRoot: string };

export function projectionModes({ platform, umask }: { readonly platform: string; readonly umask: number }): { readonly fileMode: number; readonly directoryMode: number } {
  return { fileMode: platform === "win32" ? 0o666 : 0o666 & ~umask, directoryMode: 0o777 & ~umask };
}

export function usesCleanClaudeCopy({ name, harnessDir, invoke }: { readonly name: string; readonly harnessDir: string; readonly invoke: string }): boolean {
  return name === "claude" && harnessDir === ".claude" && invoke === "bun .claude/tools/aidlc.ts";
}

function projectClaudeTree({ sourceRoot, outRoot, buildVersion, environmentCap }: ClaudeCopyRequest, delivery: "copy" | "native"): void {
  const result = spawnSync(process.execPath, ["--no-env-file", "--no-install", join(sourceRoot, "scripts/project-claude.ts")], {
    cwd: sourceRoot, encoding: "utf8", input: JSON.stringify({ sourceRoot, outRoot, buildVersion, environmentCap, ...(delivery === "native" ? { delivery } : {}) }), maxBuffer: 8 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr.trim() || result.stdout.trim() || "Claude projection process failed");
}

export function usesCleanClaudeNative({ name, harnessDir }: { readonly name: string; readonly harnessDir: string }): boolean {
  return name === "claude" && harnessDir === ".claude";
}
export function projectClaudeCopyTree(request: ClaudeCopyRequest): void { projectClaudeTree(request, "copy"); }
export function projectClaudeNativeTree(request: ClaudeCopyRequest): void { projectClaudeTree(request, "native"); }

export function usesRetainedProjection({ name, harnessDir }: { readonly name: string; readonly harnessDir: string }): boolean {
  return qualifiedHarnessByName({ name, harnessDir }) !== null;
}
export function projectRetainedTree(request: ClaudeCopyRequest, host: { readonly name: string; readonly harnessDir: string }, delivery: "copy" | "native"): void {
  const binding = qualifiedHarnessByName(host);
  if (binding === null) throw new Error("Host projection profile is not qualified");
  const result = spawnSync(process.execPath, ["--no-env-file", "--no-install", join(request.sourceRoot, "scripts/project-core.ts")], {
    cwd: request.sourceRoot, encoding: "utf8", input: JSON.stringify({ ...request, harness: binding.harness, delivery }), maxBuffer: 8 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr.trim() || result.stdout.trim() || "Retained projection process failed");
}
