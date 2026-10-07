import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { env } from "node:process";
import { describe, expect, test } from "vitest";
import {
  bashInvocationPayload,
  gateRunPayload,
  runRanHookProcess,
} from "./run-hook-process.ts";

const HOOK = "rin-constitution-gate.ts";

const STAGE_COMPLETION_COMMAND =
  "bun .claude/tools/aidlc-orchestrate.ts report --stage gate-4-implement --result approved";

const toolRootWithoutVerdictTools = (): string =>
  mkdtempSync(join(tmpdir(), "rin-gate-no-tools-"));

const gitCheckoutWithoutVerdictTools = (): string => {
  const checkout = mkdtempSync(join(tmpdir(), "rin-gate-cwd-checkout-"));
  writeFileSync(join(checkout, ".git"), "gitdir: /nowhere\n");
  mkdirSync(join(checkout, ".claude", "tools"), { recursive: true });
  return checkout;
};

const cwdOnlyEnvironment = (): Readonly<Record<string, string>> =>
  Object.fromEntries(
    INHERITED_ENVIRONMENT_KEYS.map((key) => [key, env[key] ?? ""]),
  );

const INHERITED_ENVIRONMENT_KEYS = ["PATH", "SYSTEMROOT"] as const;
const TOOL_ROOT_ENVIRONMENT_KEY = "RIN_CONSTITUTION_GATE_TOOL_ROOT";

const hookEnvironment = ({
  toolRoot,
}: {
  readonly toolRoot: string;
}): Readonly<Record<string, string>> =>
  Object.fromEntries([
    ...INHERITED_ENVIRONMENT_KEYS.map((key) => [key, env[key] ?? ""]),
    [TOOL_ROOT_ENVIRONMENT_KEY, toolRoot],
  ]);

describe("rin-constitution-gate verdict-tool availability", () => {
  test("denies stage completion when the audit tool is absent", async () => {
    const outcome = await runRanHookProcess({
      hookFileName: HOOK,
      stdinPayload: bashInvocationPayload({
        command: STAGE_COMPLETION_COMMAND,
      }),
      runtime: "bun",
      env: hookEnvironment({ toolRoot: toolRootWithoutVerdictTools() }),
    });

    expect(outcome.exitCode).toBe(2);
    expect(outcome.stderr).toContain("UNVERIFIED");
    expect(outcome.stderr).toContain("rin-harness-constitution-audit.ts");
  });

  test("ignores a command that is not a stage completion", async () => {
    const outcome = await runRanHookProcess({
      hookFileName: HOOK,
      stdinPayload: bashInvocationPayload({ command: "git status" }),
      runtime: "bun",
      env: hookEnvironment({ toolRoot: toolRootWithoutVerdictTools() }),
    });

    expect(outcome.exitCode).toBe(0);
  });

  test("honours the deliberate bypass token even with no verdict tools", async () => {
    const outcome = await runRanHookProcess({
      hookFileName: HOOK,
      stdinPayload: bashInvocationPayload({
        command: `AIDLC_CONSTITUTION_BYPASS=1 ${STAGE_COMPLETION_COMMAND}`,
      }),
      runtime: "bun",
      env: hookEnvironment({ toolRoot: toolRootWithoutVerdictTools() }),
    });

    expect(outcome.exitCode).toBe(0);
  });
});

describe("rin-constitution-gate audit-root binding (019f783d)", () => {
  test("audits the checkout the report command runs in, not the hook-file location", async () => {
    const commandCheckout = gitCheckoutWithoutVerdictTools();
    const outcome = await runRanHookProcess({
      hookFileName: HOOK,
      stdinPayload: gateRunPayload({
        cwd: commandCheckout,
        command: STAGE_COMPLETION_COMMAND,
        output: "",
      }),
      runtime: "bun",
      env: cwdOnlyEnvironment(),
    });

    expect(outcome.exitCode).toBe(2);
    expect(outcome.stderr).toContain(commandCheckout);
  });
});
