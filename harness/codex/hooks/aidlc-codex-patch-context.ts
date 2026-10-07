// apply_patch helpers for the Codex adapter's audit-and-sensors case. Runs
// nothing on import, so tests can load it without the adapter's top-level
// dispatch.

import { isAbsolute, join } from "node:path";

export interface PatchWriteTarget {
  readonly path: string;
  readonly tool: "Write" | "Edit";
}

export const PATCH_CONTEXT_CHARACTER_LIMIT = 8000;

const FILE_HEADER = /^\*\*\* (Add|Update|Delete) File: (.+)$/;
const MOVE_HEADER = /^\*\*\* Move to: (.+)$/;

function projectPathOf(path: string, projectDir: string): string {
  const trimmed = path.trim();
  return isAbsolute(trimmed) ? trimmed : join(projectDir, trimmed);
}

// The files a patch leaves written, in patch order: each added file as a
// Write, each updated file as an Edit, and a moved file as its destination,
// because its source no longer exists. A deleted file is not written.
export function patchWriteTargetsOf(input: {
  readonly command: string;
  readonly projectDir: string;
}): readonly PatchWriteTarget[] {
  const lines = input.command.split(/\r?\n/);
  const targets: PatchWriteTarget[] = [];
  for (let i = 0; i < lines.length; i++) {
    const header = FILE_HEADER.exec(lines[i]);
    if (!header || header[1] === "Delete") continue;
    if (header[1] === "Add") {
      targets.push({
        path: projectPathOf(header[2], input.projectDir),
        tool: "Write",
      });
      continue;
    }
    const move = MOVE_HEADER.exec(lines[i + 1] ?? "");
    targets.push({
      path: projectPathOf(move ? move[1] : header[2], input.projectDir),
      tool: "Edit",
    });
  }
  return targets;
}

function additionalContextOf(coreStdout: string): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(coreStdout);
  } catch {
    return "";
  }
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("hookSpecificOutput" in parsed)
  ) {
    return "";
  }
  const output = parsed.hookSpecificOutput;
  if (
    typeof output !== "object" ||
    output === null ||
    !("additionalContext" in output)
  ) {
    return "";
  }
  const context = output.additionalContext;
  return typeof context === "string" ? context : "";
}

function mergedTextOf(
  contexts: readonly string[],
  fullCount: number,
): string {
  const summaries = contexts.map((context) => context.split("\n")[0]);
  const dropped = contexts.length - fullCount;
  const head = [
    ...summaries,
    ...(dropped > 0
      ? [`… ${dropped} more files' findings not shown in full; see their detail files`]
      : []),
  ].join("\n");
  return fullCount === 0
    ? head
    : `${head}\n\n${contexts.slice(0, fullCount).join("\n\n")}`;
}

// One PostToolUse envelope for a whole patch. Codex delivers none of several
// envelopes, so the per-file contexts are merged: every summary line first
// (so they survive Codex's head-keeping truncation), then whole contexts in
// patch order while the text fits the per-patch limit. The summary section
// is never cut; contexts past the limit are dropped and counted.
export function mergedPatchContextOf(coreStdouts: readonly string[]): string {
  const contexts = coreStdouts
    .map(additionalContextOf)
    .filter((context) => context !== "");
  if (contexts.length === 0) return "";
  let merged = mergedTextOf(contexts, 0);
  for (let fullCount = contexts.length; fullCount > 0; fullCount--) {
    const candidate = mergedTextOf(contexts, fullCount);
    if (candidate.length <= PATCH_CONTEXT_CHARACTER_LIMIT) {
      merged = candidate;
      break;
    }
  }
  return `${JSON.stringify({
    hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: merged },
  })}\n`;
}

export function patchMutationTargetsOf(input: {
  readonly command: string;
  readonly projectDir: string;
}): readonly PatchWriteTarget[] {
  return input.command.split(/\r?\n/).flatMap((line) => {
    const file = FILE_HEADER.exec(line);
    const move = MOVE_HEADER.exec(line);
    return file
      ? [{ path: projectPathOf(file[2], input.projectDir), tool: file[1] === "Add" ? "Write" as const : "Edit" as const }]
      : move
        ? [{ path: projectPathOf(move[1], input.projectDir), tool: "Edit" as const }]
        : [];
  });
}

export interface PatchGuardOutcome {
  readonly code: number;
  readonly stdout: string;
  readonly stderr: string;
}

export function runPluginPatchGuards(input: {
  readonly command: string;
  readonly projectDir: string;
  readonly event: string;
  readonly dispatch: (payload: string) => PatchGuardOutcome;
}): PatchGuardOutcome | null {
  const targets = input.event === "PostToolUse"
    ? patchWriteTargetsOf(input)
    : patchMutationTargetsOf(input);
  return targets.reduce<PatchGuardOutcome | null>((denial, target) =>
    denial ?? ((outcome) => outcome.code === 2 ? outcome : null)(input.dispatch(JSON.stringify({
      hook_event_name: input.event,
      tool_name: target.tool,
      tool_input: { file_path: target.path },
    }))), null);
}
