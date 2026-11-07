import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { z } from "zod";

const manifestPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  ".aidlc-plugin",
  "plugin.json",
);

const hookRowSchema = z.object({
  event: z.string(),
  target: z.string(),
  hookFile: z.string(),
  matcher: z.string().optional(),
});

const manifestSchema = z.object({
  aidlc: z.object({
    hooks: z.record(z.string(), z.array(hookRowSchema)),
  }),
});

const hooksByFace = manifestSchema.parse(
  JSON.parse(readFileSync(manifestPath, "utf8")),
).aidlc.hooks;

const faces = Object.keys(hooksByFace);

const targetsFor = (face: string): ReadonlySet<string> =>
  new Set(hooksByFace[face].map((row) => row.target));

// Targets that legitimately live on a subset of faces, each with the reason it
// does not generalise. Anything NOT listed here must appear on every face: a
// guard silently absent from one face is a rail that reads as installed
// everywhere and enforces nothing there.
const FACE_SCOPED_TARGETS: Readonly<Record<string, string>> = {
  "aidlc-plugin-compose":
    "opencode has no hook registry, so the plugin composer can only run as an adapter-dispatched row",
  "rin-provision-worktree":
    "provisioning a fresh agent worktree keys on the EnterWorktree affordance, which only the Claude face has; elsewhere a worktree is created by hand and provisioned by the operator",
  "rin-provision-worktree-on-enter":
    "the PostToolUse arm of the same capability — no other face emits an EnterWorktree tool call for it to follow",
  "rin-prune-worktree-husks":
    "registered on SessionStart, but the husks it prunes are only ever created by the Claude face's EnterWorktree affordance, so on every other face it would sweep a directory nothing populates",
  "rin-stamp-preview-target":
    "the Claude-Preview registry it stamps has no counterpart on any other face",
  "rin-stamp-preview-target-on-enter":
    "the PostToolUse arm of the same capability, and inherits the same absent registry",
  "rin-gates-review-scribe-on-handback":
    "the PostToolUse arm of the review scribe, keyed on the SubagentHandback tool only the Claude face emits; every other face delivers a lens report in SubagentStop's last message, which the universal rin-gates-review-scribe row already reads",
};

const universalTargets = (): readonly string[] => {
  const everyTarget = new Set(faces.flatMap((face) => [...targetsFor(face)]));
  return [...everyTarget].filter(
    (target) => FACE_SCOPED_TARGETS[target] === undefined,
  );
};

describe("plugin hook coverage is total across every hook-bearing face", () => {
  test("the manifest declares at least one face", () => {
    expect(faces.length).toBeGreaterThan(0);
  });

  test("every face declares a non-empty row set", () => {
    expect(faces.filter((face) => hooksByFace[face].length === 0)).toEqual([]);
  });

  test.each(
    universalTargets(),
  )("%s is declared on every face", (target: string) => {
    expect(faces.filter((face) => !targetsFor(face).has(target))).toEqual([]);
  });

  test("every face-scoped exemption is still actually face-scoped", () => {
    const noLongerScoped = Object.keys(FACE_SCOPED_TARGETS).filter((target) =>
      faces.every((face) => targetsFor(face).has(target)),
    );
    expect(noLongerScoped).toEqual([]);
  });

  test("every exemption names a target the manifest still declares", () => {
    const declared = new Set(faces.flatMap((face) => [...targetsFor(face)]));
    const stale = Object.keys(FACE_SCOPED_TARGETS).filter(
      (target) => !declared.has(target),
    );
    expect(stale).toEqual([]);
  });
});
