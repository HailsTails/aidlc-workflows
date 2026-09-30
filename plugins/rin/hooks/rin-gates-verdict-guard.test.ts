import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const GUARD = join(HERE, "rin-gates-verdict-guard.ts");

type GuardOutcome = {
  readonly exitCode: number;
  readonly stderr: string;
};

const runGuard = (payload: string): Promise<GuardOutcome> =>
  new Promise((resolvePromise, reject) => {
    const child = spawn("bun", [GUARD], { stdio: ["pipe", "pipe", "pipe"] });
    const stderrChunks: string[] = [];
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => stderrChunks.push(chunk));
    child.on("error", reject);
    child.on("close", (code: number | null) =>
      resolvePromise({ exitCode: code ?? 0, stderr: stderrChunks.join("") }),
    );
    child.stdin.end(payload);
  });

const bashPayload = (command: string): string =>
  JSON.stringify({ tool_name: "Bash", tool_input: { command } });

const writePayload = (filePath: string): string =>
  JSON.stringify({ tool_name: "Write", tool_input: { file_path: filePath } });

const VERDICT =
  "aidlc/spaces/default/intents/260724-support-router/operation/gate-6-operate/review-verdict.json";
const OTHER_VERDICT =
  "aidlc/spaces/default/intents/260724-support-router/operation/rin-gate-6-operate/review-verdict.json";

describe("deletion allowance reads quoted and unquoted operands identically", () => {
  const Spellings: ReadonlyArray<readonly [string, string]> = [
    ["bare", `rm ${VERDICT}`],
    ["double-quoted", `rm "${VERDICT}"`],
    ["single-quoted", `rm '${VERDICT}'`],
    ["git rm bare", `git rm ${VERDICT}`],
    ["git rm double-quoted", `git rm "${VERDICT}"`],
    ["git rm single-quoted", `git rm '${VERDICT}'`],
    ["rm -f double-quoted", `rm -f "${VERDICT}"`],
    ["two quoted verdict operands", `rm "${VERDICT}" "${OTHER_VERDICT}"`],
    ["mixed quoting across operands", `rm ${VERDICT} "${OTHER_VERDICT}"`],
    ["native Windows path spelling", `rm "${VERDICT.replaceAll("/", "\\")}"`],
  ];

  test.each(
    Spellings,
  )("allows a pure verdict deletion: %s", async (_l, cmd) => {
    const outcome = await runGuard(bashPayload(cmd));
    expect(outcome.exitCode).toBe(0);
    expect(outcome.stderr).toBe("");
  });
});

describe("deletion allowance denies identically regardless of quoting", () => {
  const NonDeletions: ReadonlyArray<readonly [string, string]> = [
    ["bare non-verdict co-operand", `rm ${VERDICT} aidlc/spaces/x/notes.md`],
    [
      "quoted non-verdict co-operand",
      `rm "${VERDICT}" "aidlc/spaces/x/notes.md"`,
    ],
    ["quoted cp fabrication", `cp "/tmp/forged.json" "${VERDICT}"`],
    ["quoted mv fabrication", `mv "/tmp/forged.json" "${VERDICT}"`],
    ["quoted redirect fabrication", `echo '{}' > "${VERDICT}"`],
    ["quoted tee fabrication", `echo '{}' | tee "${VERDICT}"`],
  ];

  test.each(NonDeletions)("denies: %s", async (_label, command) => {
    const outcome = await runGuard(bashPayload(command));
    expect(outcome.exitCode).toBe(2);
    expect(outcome.stderr).toContain("tool-writable-only");
  });
});

describe("quoting cannot launder an injected fabrication into the allowance", () => {
  const Injections: ReadonlyArray<readonly [string, string]> = [
    [
      "chained write after a quoted deletion",
      `rm "${VERDICT}"; echo '{}' > "${VERDICT}"`,
    ],
    [
      "unbalanced quotes hiding a chained write",
      `rm "${VERDICT}; echo forged > ${VERDICT}"`,
    ],
    ["command substitution in an operand", `rm "$(echo ${VERDICT})"`],
    [
      "glob operand",
      `rm "aidlc/spaces/default/intents/*/**/review-verdict.json"`,
    ],
  ];

  test.each(Injections)("denies: %s", async (_label, command) => {
    const outcome = await runGuard(bashPayload(command));
    expect(outcome.exitCode).toBe(2);
  });
});

describe("reads are allowed — the verdict is writable-only, not readable-only", () => {
  const Reads: ReadonlyArray<readonly [string, string]> = [
    ["cat", `cat ${VERDICT}`],
    ["cat quoted", `cat "${VERDICT}"`],
    ["git show", `git show HEAD:${VERDICT}`],
    ["git show quoted", `git show "HEAD:${VERDICT}"`],
    ["git log", `git log --oneline -- ${VERDICT}`],
    ["git diff", `git diff -- "${VERDICT}"`],
    ["ls with silenced stderr", `ls -la ${VERDICT} 2>/dev/null`],
  ];

  test.each(Reads)("allows: %s", async (_label, command) => {
    const outcome = await runGuard(bashPayload(command));
    expect(outcome.exitCode).toBe(0);
    expect(outcome.stderr).toBe("");
  });
});

describe("hand-authoring a verdict stays denied", () => {
  test("denies a Write at a verdict path", async () => {
    const outcome = await runGuard(writePayload(VERDICT));
    expect(outcome.exitCode).toBe(2);
    expect(outcome.stderr).toContain("tool-writable-only");
  });

  test("denies a Write regardless of slash direction", async () => {
    const outcome = await runGuard(writePayload(VERDICT.replaceAll("/", "\\")));
    expect(outcome.exitCode).toBe(2);
  });

  test("denies deleting the scribe accumulation (anyNotReady poison)", async () => {
    const outcome = await runGuard(
      bashPayload(`rm "aidlc/.rin-gates-review-captures/board.jsonl"`),
    );
    expect(outcome.exitCode).toBe(2);
  });

  test("denies a Write at the captures accumulation", async () => {
    const outcome = await runGuard(
      writePayload("aidlc/.rin-gates-review-captures/board.jsonl"),
    );
    expect(outcome.exitCode).toBe(2);
  });

  test("denies a Write at the captures accumulation, backslashes", async () => {
    const outcome = await runGuard(
      writePayload("aidlc\\.rin-gates-review-captures\\board.jsonl"),
    );
    expect(outcome.exitCode).toBe(2);
  });

  test("exits 0 on empty stdin", async () => {
    const outcome = await runGuard("");
    expect(outcome.exitCode).toBe(0);
  });
});
