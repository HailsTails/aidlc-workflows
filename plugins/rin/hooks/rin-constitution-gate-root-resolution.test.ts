import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { env } from "node:process";
import { describe, expect, test } from "vitest";
import {
  bashInvocationPayload,
  runRanHookProcess,
} from "./run-hook-process.ts";

const HOOK = "rin-constitution-gate.ts";
const STAGE_COMPLETION_COMMAND =
  "bun .claude/tools/aidlc-orchestrate.ts report --stage gate-4-implement --result approved";

const recordedProjectDirMarker = ({
  toolRoot,
}: {
  readonly toolRoot: string;
}): string => join(toolRoot, "recorded-project-dir");

const buildGitCheckoutToolRoot = (): string => {
  const toolRoot = mkdtempSync(join(tmpdir(), "rin-gate-root-"));
  const gitDir = join(toolRoot, ".git");
  mkdirSync(gitDir, { recursive: true });
  const toolsDir = join(toolRoot, ".claude", "tools");
  mkdirSync(toolsDir, { recursive: true });
  const marker = recordedProjectDirMarker({ toolRoot });
  const recordingTool =
    'import { writeFileSync } from "node:fs";\n' +
    "const projectDir = process.argv[process.argv.indexOf('--project-dir') + 1];\n" +
    `writeFileSync(${JSON.stringify(marker)}, projectDir);\n` +
    "console.log(JSON.stringify({ pass: true, violations_count: 0, violations: [] }));\n";
  writeFileSync(
    join(toolsDir, "rin-harness-constitution-audit.ts"),
    recordingTool,
  );
  writeFileSync(
    join(toolsDir, "rin-harness-carve-out-decay.ts"),
    "console.log(JSON.stringify({ pass: true, violations_count: 0, violations: [] }));\n",
  );
  return toolRoot;
};

describe("rin-constitution-gate audit-root resolution (worktree correctness)", () => {
  test("audits the invoking checkout, not a CLAUDE_PROJECT_DIR pinned elsewhere", async () => {
    const invokingCheckout = buildGitCheckoutToolRoot();
    const pinnedElsewhere = mkdtempSync(join(tmpdir(), "rin-gate-primary-"));

    const outcome = await runRanHookProcess({
      hookFileName: HOOK,
      stdinPayload: bashInvocationPayload({
        command: STAGE_COMPLETION_COMMAND,
      }),
      runtime: "bun",
      env: Object.fromEntries([
        ["PATH", env.PATH ?? ""],
        ["SYSTEMROOT", env.SYSTEMROOT ?? ""],
        ["RIN_CONSTITUTION_GATE_TOOL_ROOT", invokingCheckout],
        ["CLAUDE_PROJECT_DIR", pinnedElsewhere],
      ]),
    });

    expect(outcome.exitCode).toBe(0);
    const auditedRoot = readFileSync(
      recordedProjectDirMarker({ toolRoot: invokingCheckout }),
      "utf-8",
    );
    expect(auditedRoot).toBe(invokingCheckout);
    expect(auditedRoot).not.toBe(pinnedElsewhere);
  });
});
