// harness/copilot/emit.ts — the GitHub Copilot per-shell emission plugin.
//
// The unified packager copies core/ → dist/copilot/.aidlc/ and runs graph
// compile there, then calls this emit() for the .github/ shell — the project
// discovery surface BOTH Copilot surfaces read (CLI 1.0.74+ and VS Code agent
// mode 1.130+; verified by the compatibility-spike evidence).
// MERGE NOTE: in the dist tree .github/ is wholly AIDLC-owned (clean-swept
// each build for --check parity). A USER'S project .github/ is shared with
// real repo content — the install step merges these aidlc-named files in;
// it never replaces the directory. All emissions are aidlc-prefixed so the
// merge is collision-free.

import { rmSync } from "node:fs";
import { join } from "node:path";
import type { EmitContext } from "../../scripts/manifest-types.ts";
import { copilotCommandPath } from "../../src/hosts/copilot/projection/command-renderer.ts";

function emit(ctx: EmitContext): void {
  const { distRoot } = ctx;
  const SHELL = join(distRoot, ".github");

  // Clean-sweep the shell so a removed persona/runner cannot linger. In
  // --check mode the packager supplies an isolated distRoot, then compares
  // the complete generated tree with the independently generated counterpart.
  rmSync(SHELL, { recursive: true, force: true });
  ctx.emitCommands(copilotCommandPath);
}

export default emit;
