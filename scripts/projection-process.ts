import { spawnSync } from "node:child_process";
import { join } from "node:path";

export function projectionModes({ platform, umask }: { readonly platform: string; readonly umask: number }): { readonly fileMode: number; readonly directoryMode: number } {
  return { fileMode: platform === "win32" ? 0o666 : 0o666 & ~umask, directoryMode: 0o777 & ~umask };
}

export function usesCleanClaudeCopy({ name, harnessDir, invoke, environmentCap, buildVersion, sourceVersion }: { readonly name: string; readonly harnessDir: string; readonly invoke: string; readonly environmentCap: string | null; readonly buildVersion: string; readonly sourceVersion: string }): boolean {
  return name === "claude" && harnessDir === ".claude" && invoke === "bun .claude/tools/aidlc.ts" && environmentCap === null && buildVersion === sourceVersion;
}

export function projectClaudeCopyTree({ sourceRoot, outRoot }: { readonly sourceRoot: string; readonly outRoot: string }): void {
  const result = spawnSync(process.execPath, ["--no-env-file", "--no-install", join(sourceRoot, "scripts/project-claude.ts")], {
    cwd: sourceRoot, encoding: "utf8", input: JSON.stringify({ sourceRoot, outRoot }), maxBuffer: 8 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr.trim() || result.stdout.trim() || "Claude projection process failed");
}
