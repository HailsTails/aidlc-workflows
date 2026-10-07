import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const GUARD = join(HERE, "rin-gates-verdict-guard.ts");

const runGuard = (command: string): Promise<number> =>
  new Promise((resolvePromise, reject) => {
    const child = spawn("bun", [GUARD], { stdio: ["pipe", "pipe", "pipe"] });
    child.on("error", reject);
    child.on("close", (code: number | null) => resolvePromise(code ?? 0));
    child.stdin.end(
      JSON.stringify({ tool_name: "Bash", tool_input: { command } }),
    );
  });

const VERDICT =
  "aidlc/spaces/default/intents/260807-x/inception/rin-gate-0-reconcile/review-verdict.json";

// Task 019fd9b0. The guard scans the WHOLE Bash command string, so a commit
// MESSAGE that merely NAMES the guarded file is read as a write. The one moment a
// session most needs to explain the verdict mechanism in a commit message is when
// a gate is blocked on it — precisely when the guard fires. Per Helen's standing
// ruling (2026-07-29) an over-block is itself the defect, the same class of
// matcher defect as an under-block.
describe("a commit MESSAGE naming the verdict file is not a write", () => {
  const Messages: ReadonlyArray<readonly [string, string]> = [
    [
      "heredoc body naming the file",
      `git commit -F - <<EOF\npark: no ${VERDICT} was produced this run\nEOF`,
    ],
    [
      "message with a redirect-shaped character",
      `git commit -m "gate blocked: no review-verdict.json > nothing emitted"`,
    ],
    [
      "message describing a deletion of the file",
      `git commit -m "explains the rm of review-verdict.json and notes.md"`,
    ],
    [
      "message naming the captures accumulation",
      `git commit -m "notes why .rin-gates-review-captures stayed empty"`,
    ],
    [
      "message mentioning tee",
      `git commit -m "review-verdict.json is never written by tee"`,
    ],
    [
      "-am spelling",
      `git commit -am "park: review-verdict.json absent, board discarded"`,
    ],
  ];

  test.each(Messages)("allows: %s", async (_label, command) => {
    expect(await runGuard(command)).toBe(0);
  });
});

// The precision fix must not cost a single real deny. `git commit` is exempted as
// a VERB, so any construct that is not a commit is untouched, and a commit that
// ALSO writes outside its message is still denied.
describe("real writes stay denied, including via a commit-shaped command", () => {
  const Denied: ReadonlyArray<readonly [string, string]> = [
    ["redirect into the verdict", `echo '{}' > ${VERDICT}`],
    ["tee into the verdict", `echo '{}' | tee ${VERDICT}`],
    ["cp onto the verdict", `cp /tmp/forged.json ${VERDICT}`],
    ["mv onto the verdict", `mv /tmp/forged.json ${VERDICT}`],
    ["sed -i on the verdict", `sed -i 's/NOT-READY/READY/' ${VERDICT}`],
    [
      "commit chained with a redirect write",
      `git commit -m "note" && echo '{}' > ${VERDICT}`,
    ],
    [
      "commit chained with a semicolon write",
      `git commit -m "note"; echo '{}' > ${VERDICT}`,
    ],
    [
      "commit chained with a pipe into tee",
      `git commit -m "note" | tee ${VERDICT}`,
    ],
    [
      "commit message used to smuggle a substitution write",
      `git commit -m "$(echo '{}' > ${VERDICT})"`,
    ],
    [
      "deleting the captures accumulation",
      `rm aidlc/.rin-gates-review-captures/board.jsonl`,
    ],
    // The heredoc body would otherwise be stripped as inert data. It is not,
    // because the substitution test runs against the ORIGINAL command — a
    // substitution executes even inside a quoted/heredoc region, so the whole
    // command is scanned rather than stripped.
    [
      "substitution smuggled inside a heredoc body",
      `git commit -F - <<EOF\nnote $(echo '{}' > ${VERDICT})\nEOF`,
    ],
    [
      "backtick substitution inside a quoted message",
      `git commit -m "note \`echo '{}' > ${VERDICT}\`"`,
    ],
    [
      "commit chained with a captures deletion",
      `git commit -m "note" && rm aidlc/.rin-gates-review-captures/board.jsonl`,
    ],
    // Task 01a02632. The substitution test now reads the RESIDUE, so an inert
    // single-quoted message no longer forces the whole-command scan. A backtick
    // CHAINED after that message survives stripping and must still deny.
    [
      "inert single-quoted message chained with a backtick write",
      `git commit -m 'note' && \`echo '{}' > ${VERDICT}\``,
    ],
    // An UNESCAPED backtick inside double quotes is evaluated by the shell, so the
    // span is not inert: it stays in the residue and forces the whole-command scan.
    [
      "unescaped backtick in a double-quoted message naming a mutator",
      `git commit -m "docs: the \`rm\` of ${VERDICT} explained"`,
    ],
    // `\\` is an escaped BACKSLASH, so the backtick that follows it is unescaped
    // and executes. Only a single `\` before the backtick makes the span inert.
    [
      "double-backslash leaves the following backtick live",
      `git commit -m "docs: the \\\\\`rm\\\\\` of ${VERDICT} explained"`,
    ],
    // An UNQUOTED heredoc delimiter expands, so its body is never inert.
    [
      "unquoted-delimiter heredoc body carrying a substitution",
      `git commit -F - <<EOF\nnote \`echo '{}' > ${VERDICT}\`\nEOF`,
    ],
  ];

  test.each(Denied)("denies: %s", async (_label, command) => {
    expect(await runGuard(command)).toBe(2);
  });
});

// Task 01a02632. A message may DESCRIBE the mechanism using the identifiers'
// natural markdown spelling — backticks — without being read as a substitution.
// A single-quoted span is inert under every shell; a double-quoted span is
// stripped only when it carries neither a backtick nor `$(`.
describe("a backticked identifier inside an inert message is not a substitution", () => {
  const InertMessages: ReadonlyArray<readonly [string, string]> = [
    // Each row pairs a backtick with a word MUTATING_SHELL matches (`rm`, `tee`,
    // `cp`) and the guarded path. That combination is what the old whole-command
    // fallback turned into a deny: the backtick discarded the stripped result, and
    // the re-scanned original then satisfied both the path test and the mutator
    // test from prose alone. A row carrying a backtick but no mutator would pass
    // against the old code too and would prove nothing.
    // ESCAPED inside double quotes. An UNESCAPED backtick there executes and is
    // covered by the deny row above — only the escaped spelling is inert.
    [
      "double-quoted message, escaped backticks beside a mutator word",
      `git commit -m "docs: explain why the \\\`rm\\\` of review-verdict.json is allowed"`,
    ],
    [
      "single-quoted message, backticked mutator and the captures path",
      `git commit -m 'note: no \`cp\` ever targets .rin-gates-review-captures/board.jsonl'`,
    ],
    [
      "-am spelling, backticked mutator and the verdict path",
      `git commit -am 'park: \`tee\` never wrote review-verdict.json this run'`,
    ],
    [
      "quoted-delimiter heredoc body, backticked mutator and both paths",
      `git commit -F - <<'EOF'\npark: no \`rm\` of review-verdict.json and none of .rin-gates-review-captures/board.jsonl\nEOF`,
    ],
  ];

  test.each(InertMessages)("allows: %s", async (_label, command) => {
    expect(await runGuard(command)).toBe(0);
  });
});

// Task 01a02ba0. The guard protects a file NAMED review-verdict.json and a
// directory NAMED .rin-gates-review-captures — not every path that merely ends
// with, or contains, those strings.
describe("a strictly-larger filename is a different object", () => {
  const Neighbours: ReadonlyArray<readonly [string, string]> = [
    ["docs example", "docs/examples/sample-review-verdict.json"],
    ["test fixture", "test-fixtures/fake-review-verdict.json"],
    ["captures notes file", "docs/.rin-gates-review-captures-notes.md"],
    ["docs example, backslashes", "docs\\examples\\sample-review-verdict.json"],
    ["test fixture, backslashes", "test-fixtures\\fake-review-verdict.json"],
    [
      "captures notes, backslashes",
      "docs\\.rin-gates-review-captures-notes.md",
    ],
  ];

  test.each(Neighbours)("allows a Write at %s", async (_label, filePath) => {
    const child = await new Promise<number>((resolvePromise, reject) => {
      const proc = spawn("bun", [GUARD], { stdio: ["pipe", "pipe", "pipe"] });
      proc.on("error", reject);
      proc.on("close", (code: number | null) => resolvePromise(code ?? 0));
      proc.stdin.end(
        JSON.stringify({
          tool_name: "Write",
          tool_input: { file_path: filePath },
        }),
      );
    });
    expect(child).toBe(0);
  });

  test.each(
    Neighbours,
  )("allows a redirect write to %s", async (_l, filePath) => {
    expect(await runGuard(`echo '{}' > ${filePath}`)).toBe(0);
  });
});
