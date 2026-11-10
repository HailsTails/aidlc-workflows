// harness/codex/emit.ts — the Codex CLI per-shell emission plugin.
//
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, posix, win32 } from "node:path";
import type { EmitContext } from "../../scripts/manifest-types.ts";
import { createCopyChannelAllowSource } from "../../src/projection/adapters/legacy-dispatcher.ts";
import { codexHookTrustHash } from "../../src/projection/adapters/legacy-trusted-commands.ts";
import { codexCommandPath } from "../../src/hosts/codex/projection/command-renderer.ts";
import { extendedSubprocessTimeoutMs } from "../../src/projection/adapters/legacy-runtime-budget.ts";
import {
  emitDefaultRules as renderDefaultRules,
  emitTrustSeed as renderTrustSeed,
  trustEntries as renderTrustEntries,
} from "../../src/hosts/codex/projection/settings-renderer.ts";

// Compatibility only; removed with F3's retained emitter deletion.
export function emitDefaultRules(harnessDir: string, invoke: string, trustedNamespace: string): string {
  const result = renderDefaultRules({ harnessDir, invoke, trustedNamespace }, createCopyChannelAllowSource().read());
  if (!result.ok) throw new Error(result.refusal.reason);
  return result.value;
}
export function emitTrustSeed(harnessDir: string, harnessName = "codex", invoke = "aidlc", trustedNamespace?: string): string {
  const result = renderTrustSeed({ harnessDir, harnessName, invoke, trustedNamespace }, {
    extendedSubprocessTimeoutMs: extendedSubprocessTimeoutMs(),
    hookTrust: ({ event, command, timeoutSeconds, matcher }) =>
      codexHookTrustHash(event, command, timeoutSeconds, matcher),
  });
  if (!result.ok) throw new Error(result.refusal.reason);
  return result.value;
}
export function trustEntries(
  projectDir: string,
  hooksJsonPath?: string,
  harnessDir = ".codex",
  harnessName = "codex",
  invoke = "aidlc",
  trustedNamespace?: string,
): string {
  const projectPath = win32.isAbsolute(projectDir) &&
    (!posix.isAbsolute(projectDir) || projectDir.startsWith("//")) ? win32 : posix;
  const result = renderTrustEntries({ hooksJsonPath: hooksJsonPath ?? projectPath.join(projectDir, harnessDir, "hooks.json"),
    harnessName, invoke, trustedNamespace }, {
    extendedSubprocessTimeoutMs: extendedSubprocessTimeoutMs(),
    hookTrust: ({ event, command, timeoutSeconds, matcher }) =>
      codexHookTrustHash(event, command, timeoutSeconds, matcher),
  });
  if (!result.ok) throw new Error(result.refusal.reason);
  return result.value;
}
// ---------------------------------------------------------------------------
// emit() — the manifest entry point. Assembles every codex-only emission as a
// {path, content} list, then writes it into the packager-provided dist root.
// ---------------------------------------------------------------------------
function emit(ctx: EmitContext): void {
  const {
    distRoot,
  } = ctx;
  const SKILLS_DST = join(distRoot, ".agents", "skills");

  const emissions: Array<{ path: string; content: () => string }> = [];

  // Clean-sweep the emitted skills tree so a removed runner doesn't linger.
  // In --check mode distRoot is temporary; the packager compares its complete
  // inventory with the independently generated counterpart after emit returns.
  rmSync(SKILLS_DST, { recursive: true, force: true });
  for (const { path, content } of emissions) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content(), "utf-8");
  }
  ctx.emitCommands(codexCommandPath);
}

export default emit;
