// harness/opencode/emit.ts — the opencode per-shell emission plugin.
//
//   - .opencode/command/aidlc.md — the user-invoked /aidlc entry (authored).
//
// WHY the engine is NOT inside .opencode/: opencode auto-imports every *.ts
// under .opencode/tools/ and .opencode/tool/ as custom tool definitions, and
// importing a CLI-style script (top-level argv dispatch, process.exit) crashes
// the session (live-reproduced). The engine tree therefore ships at .aidlc/,
// which opencode never scans; the shipped opencode.json registers
// `skills.paths: [".aidlc/skills"]` for skill discovery there.

import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { EmitContext } from "../../scripts/manifest-types.ts";
import { openCodeCommandPath } from "../../src/hosts/opencode/projection/command-renderer.ts";
export const authoredInputs: readonly string[] = [
  "command/aidlc.md",
];

function authoredShellEmissions(ctx: EmitContext, shell: string):
  Array<{ path: string; content: () => string }> {
  const { substituteToken } = ctx;
  const emissions: Array<{ path: string; content: () => string }> = [];
  // Authored shell surfaces, copied with token substitution on the .md.
  for (const authored of ctx.hostSources.filter((file) => file.source === "command/aidlc.md")) {
    emissions.push({
      path: join(shell, "command", "aidlc.md"),
      content: () => substituteToken(ctx.hostSourceText(authored)),
    });
  }

  return emissions;
}

function emit(ctx: EmitContext): void {
  const { distRoot } = ctx;
  const SHELL = join(distRoot, ".opencode");
  const ACTIVE_MEMORY = join(distRoot, "aidlc", "spaces", "default", "memory");
  if (!existsSync(ACTIVE_MEMORY)) {
    throw new Error(`opencode emission requires the shipped memory tree at ${ACTIVE_MEMORY}.`);
  }

  const emissions: Array<{ path: string; content: () => string }> = [];

  emissions.push(...authoredShellEmissions(ctx, SHELL));

  // Clean-sweep the shell so a removed persona/command cannot linger. In
  // --check mode the packager supplies an isolated distRoot, then compares the
  // complete generated tree with the independently generated counterpart.
  rmSync(SHELL, { recursive: true, force: true });
  for (const { path, content } of emissions) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content(), "utf-8");
  }
  ctx.emitCommands(openCodeCommandPath);
}

export default Object.assign(emit, { authoredInputs });
