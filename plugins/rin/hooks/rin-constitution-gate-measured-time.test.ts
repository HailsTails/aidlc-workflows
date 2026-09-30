// The refusal must name the MEASURED runtime, not only the budget.
//
// A gate refusal reading "cold-start exceeded 120000ms even warm" tells an
// operator nothing about whether the audit missed by a second or by ten minutes,
// so the only remedy it implies is AIDLC_CONSTITUTION_BYPASS=1 — which lanes
// correctly refuse, leaving them with no action at all. Lanes W and V sat parked
// on exactly this. These tests pin the elapsed figure into the refusal so the
// next operator can tell the two cases apart without instrumenting anything.

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { invokeBashHook } from "./run-hook-process.ts";

const HOOK = "rin-constitution-gate.ts";
const STAGE_COMPLETION_COMMAND =
  "bun .claude/tools/aidlc-orchestrate.ts report --stage rin-gate-0-reconcile --result approved";

// Long enough that a real bun spawn never beats it, so a "timed out" outcome in
// these tests is always the fixture hanging on purpose and never a slow machine.
const WINDOW_OUTLIVING_ANY_REAL_SPAWN_MS = "180000";
const TIGHT_WINDOW_MS = "1500";
const REAL_SPAWN_TEST_TIMEOUT_MS = 120_000;

const createdToolRoots: string[] = [];

afterEach(() => {
  createdToolRoots.splice(0).forEach((root) => {
    rmSync(root, { recursive: true, force: true });
  });
});

const buildToolRoot = ({
  auditBody,
}: {
  readonly auditBody: string;
}): string => {
  const toolRoot = mkdtempSync(join(tmpdir(), "rin-gate-measured-"));
  createdToolRoots.push(toolRoot);
  const toolsDir = join(toolRoot, ".claude", "tools");
  mkdirSync(toolsDir, { recursive: true });
  writeFileSync(join(toolsDir, "rin-harness-constitution-audit.ts"), auditBody);
  // The decay tool always passes fast, so it is never the blocker under test.
  writeFileSync(
    join(toolsDir, "rin-harness-carve-out-decay.ts"),
    "console.log(JSON.stringify({ pass: true, violations_count: 0, violations: [] }));\n",
  );
  return toolRoot;
};

const runGate = ({
  toolRoot,
  coldWindowMs,
  warmWindowMs,
}: {
  readonly toolRoot: string;
  readonly coldWindowMs: string;
  readonly warmWindowMs: string;
}): Promise<{ readonly exitCode: number; readonly stderr: string }> =>
  invokeBashHook({
    hookFileName: HOOK,
    command: STAGE_COMPLETION_COMMAND,
    runtime: "bun",
    environmentAdditions: Object.fromEntries([
      ["RIN_CONSTITUTION_GATE_TOOL_ROOT", toolRoot],
      ["RIN_CONSTITUTION_GATE_TIMEOUT_MS", coldWindowMs],
      ["RIN_CONSTITUTION_GATE_WARM_TIMEOUT_MS", warmWindowMs],
    ]),
  });

const HANGING_AUDIT = "await new Promise(() => {});\n";

describe("a timeout refusal names the measured runtime", () => {
  test("the refusal reports elapsed milliseconds, not only the budget", {
    timeout: REAL_SPAWN_TEST_TIMEOUT_MS,
  }, async () => {
    const outcome = await runGate({
      toolRoot: buildToolRoot({ auditBody: HANGING_AUDIT }),
      coldWindowMs: TIGHT_WINDOW_MS,
      warmWindowMs: TIGHT_WINDOW_MS,
    });

    expect(outcome.exitCode).not.toBe(0);
    expect(outcome.stderr).toMatch(/\d+ms cold then \d+ms warm/);
  });

  test("the refusal states the runtime is not a verdict about the tree", {
    timeout: REAL_SPAWN_TEST_TIMEOUT_MS,
  }, async () => {
    const outcome = await runGate({
      toolRoot: buildToolRoot({ auditBody: HANGING_AUDIT }),
      coldWindowMs: TIGHT_WINDOW_MS,
      warmWindowMs: TIGHT_WINDOW_MS,
    });

    expect(outcome.stderr).toContain("AUDIT'S RUNTIME, not its result");
  });

  // The refusal must offer a route that is NOT the bypass. A refusal whose only
  // implied remedy is AIDLC_CONSTITUTION_BYPASS=1 is what stranded the lanes.
  test("the refusal names a non-bypass remedy", {
    timeout: REAL_SPAWN_TEST_TIMEOUT_MS,
  }, async () => {
    const outcome = await runGate({
      toolRoot: buildToolRoot({ auditBody: HANGING_AUDIT }),
      coldWindowMs: TIGHT_WINDOW_MS,
      warmWindowMs: TIGHT_WINDOW_MS,
    });

    expect(outcome.stderr).toContain("RIN_CONSTITUTION_GATE_WARM_TIMEOUT_MS");
    expect(outcome.stderr).toContain("audit:harness");
  });

  // The must-PASS face. Without it these tests cannot tell a gate that reports
  // timings from one that refuses everything and happens to mention milliseconds.
  test("a fast passing audit still opens the gate and reports no timing complaint", {
    timeout: REAL_SPAWN_TEST_TIMEOUT_MS,
  }, async () => {
    const outcome = await runGate({
      toolRoot: buildToolRoot({
        auditBody:
          "console.log(JSON.stringify({ pass: true, violations_count: 0, violations: [] }));\n",
      }),
      coldWindowMs: WINDOW_OUTLIVING_ANY_REAL_SPAWN_MS,
      warmWindowMs: WINDOW_OUTLIVING_ANY_REAL_SPAWN_MS,
    });

    expect(outcome.exitCode).toBe(0);
    expect(outcome.stderr).not.toContain("AUDIT'S RUNTIME");
  });
});
