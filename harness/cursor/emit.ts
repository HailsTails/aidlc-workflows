// emit.ts (cursor) — the plugin-contribution seam for this harness.
//
// Cursor's hooks.json is STATIC and copied verbatim: it routes every preToolUse
// call to the single `guards` target, and Cursor ignores matchers. So a
// plugin-contributed guard cannot register an entry of its own the way it does
// on codex or copilot — instead the adapter appends every contributed guard to
// the chain it already runs behind that one target.
//
// This emitter writes the map the adapter reads to find them. Without it a
// plugin's guards ship as files that nothing ever invokes.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { EmitContext } from "../../scripts/manifest-types.ts";

// Keyed by EVENT, unlike the flat target→file map the codex and copilot faces
// emit. Those harnesses record the event in their own hooks.json, so their
// adapter is told which event fired. Cursor's hooks.json is static and cannot
// carry a contributed row, so the event has to travel in this map — without it
// the adapter cannot tell a PreToolUse guard from a PostToolUse sensor and
// would run every contributed hook on every tool call.
export default function emit(ctx: EmitContext): void {
  const byEvent: Record<string, string[]> = {};
  const path = join(
    ctx.distRoot,
    ctx.harnessDir,
    "hooks",
    "plugin-hook-targets.json",
  );
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(byEvent, null, 2)}\n`, "utf-8");
}
