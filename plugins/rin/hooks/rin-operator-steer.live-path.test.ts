// Live-path proof for the operator-steer hook.
//
// The unit tests build synthetic transcripts, so they prove the matcher and not
// the SHAPE the harness actually writes. This suite runs the hook against a
// transcript assembled from the entry shapes observed in a real Claude Code
// session on 2026-09-05 (72 `type:"user"` entries, of which exactly one was a
// genuine human prompt and the rest were tool_result carriers) — the ratio that
// makes the synthetic-turn filtering load-bearing rather than decorative.
//
// The steer is placed BEFORE a run of tool_result entries, reproducing the
// suspended-parent window: the operator sends during a seat, the seat's output
// lands after it, and the hook must still find the steer on resume.

import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import {
  runRanHookProcess,
  transcriptAssistantEntry,
  transcriptPayload,
  transcriptUserEntry,
} from "./run-hook-process.ts";
import { emittedAdvisoryFrom } from "./shared-core-bare.ts";

const hookPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "rin-operator-steer.ts",
);

const humanPrompt = (text: string) => transcriptUserEntry({ content: text });

const TOOL_USE_ID_FIELD = "tool_use_id";

const toolResultTurn = (output: string) =>
  transcriptUserEntry({
    content: [
      {
        type: "tool_result",
        [TOOL_USE_ID_FIELD]: "toolu_live",
        content: output,
      },
    ],
  });

const assistantToolUse = (name: string) =>
  transcriptAssistantEntry({
    content: [{ type: "tool_use", name, id: "toolu_live", input: {} }],
  });

// The observed session ratio: one genuine prompt against many tool_result
// carriers. Anything less than this understates how much the filter must reject.
const seatChatter = (turns: number): readonly string[] =>
  Array.from({ length: turns }, (_unused, index) => [
    assistantToolUse("Agent"),
    toolResultTurn(`seat output ${index}`),
  ]).flat();

const invokeAgainst = async (lines: readonly string[]) => {
  const workingDirectory = mkdtempSync(
    join(tmpdir(), "rin-operator-steer-live-"),
  );
  const transcriptPath = join(workingDirectory, "transcript.jsonl");
  writeFileSync(transcriptPath, lines.join("\n"), "utf8");
  return runRanHookProcess({
    hookFileName: "rin-operator-steer.ts",
    hookPath,
    runtime: "bun",
    stdinPayload: transcriptPayload({
      hookEventName: "SubagentStop",
      transcriptPath,
      cwd: workingDirectory,
    }),
  });
};

// The ledger is per-clone runtime and must resolve to the PRIMARY checkout via
// the git common dir, so a session that changes worktrees mid-run still reads
// one ledger. Proven against a real worktree layout rather than asserted: a
// worktree's `.git` is a FILE pointing at `<primary>/.git/worktrees/<name>`,
// which carries a `commondir` pointer back. If the resolution regressed to the
// invoking cwd, the ledger would appear in the worktree instead.
describe("the ledger resolves to the primary checkout, not the invoking worktree", () => {
  test("a steer surfaced from a worktree writes its ledger into the primary git dir", async () => {
    const root = mkdtempSync(join(tmpdir(), "rin-steer-worktree-"));
    const primaryGitDir = join(root, "primary", ".git");
    const worktreeGitDir = join(primaryGitDir, "worktrees", "lane");
    const worktree = join(root, "worktree");
    mkdirSync(worktreeGitDir, { recursive: true });
    mkdirSync(worktree, { recursive: true });
    writeFileSync(join(worktreeGitDir, "commondir"), "../..\n", "utf8");
    writeFileSync(
      join(worktree, ".git"),
      `gitdir: ${worktreeGitDir}\n`,
      "utf8",
    );

    const transcriptPath = join(worktree, "transcript.jsonl");
    writeFileSync(
      transcriptPath,
      humanPrompt("URGENT — resolve my ledger to the primary"),
      "utf8",
    );

    await runRanHookProcess({
      hookFileName: "rin-operator-steer.ts",
      hookPath,
      runtime: "bun",
      stdinPayload: transcriptPayload({
        hookEventName: "SubagentStop",
        transcriptPath,
        cwd: worktree,
      }),
    });

    expect(
      existsSync(join(primaryGitDir, ".rin-operator-steer-surfaced")),
    ).toBe(true);
    expect(existsSync(join(worktree, ".rin-operator-steer-surfaced"))).toBe(
      false,
    );
  });
});

describe("against a transcript shaped like a real suspended-parent window", () => {
  test("a steer sent during a seat is surfaced when the seat returns", async () => {
    const outcome = await invokeAgainst([
      humanPrompt("the original dispatch brief"),
      ...seatChatter(20),
      humanPrompt("URGENT — stop the merge, I have changed my mind"),
      ...seatChatter(15),
    ]);

    const emitted = emittedAdvisoryFrom({ stdout: outcome.stdout });
    expect(emitted.state).toBe("advised");
    if (emitted.state !== "advised") return;
    expect(emitted.advisory.hookSpecificOutput.additionalContext).toContain(
      "URGENT — stop the merge, I have changed my mind",
    );
  });

  test("the same window with no steer stays silent", async () => {
    const outcome = await invokeAgainst([
      humanPrompt("the original dispatch brief"),
      ...seatChatter(35),
    ]);

    expect(emittedAdvisoryFrom({ stdout: outcome.stdout }).state).toBe(
      "silent",
    );
  });

  test("seat output that merely quotes a marker is not mistaken for a steer", async () => {
    const outcome = await invokeAgainst([
      humanPrompt("the original dispatch brief"),
      assistantToolUse("Agent"),
      toolResultTurn("the lens report mentions URGENT — as an example string"),
    ]);

    expect(emittedAdvisoryFrom({ stdout: outcome.stdout }).state).toBe(
      "silent",
    );
  });
});
