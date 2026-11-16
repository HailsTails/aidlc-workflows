import { describe, expect, test } from "vitest";
import { configRunnerAllowlist, defaultConfig } from "../tools/rin-harness-config.ts";
import { defaultPathOperations } from "../tools/rin-harness-path-operations.ts";
import { INLINE_EXEC_HOOK } from "./inline-exec-hook-layout.ts";
import { invokeBashHook, permissionDecisionFrom } from "./run-hook-process.ts";

const paths = defaultPathOperations();

const repositoryRoot = paths.resolve({
  segments: [paths.dirname({ path: paths.fromFileUrl({ url: import.meta.url }) }), "..", "..", ".."],
});

const FETCH_AND_RUN_LAUNCHERS = ["npx", "bun x", "bunx"] as const;

const RETAINED_RUNNERS = [
  "uv run",
  "pnpm",
  "pnpm exec",
  "npm",
  "npm exec",
  "python -m json.tool",
] as const;

const THROWAWAY_TAIL = "ts-node scripts/throwaway.ts";
const HARNESS_TOOL_TAIL = ".claude/tools/launcher.ts node throwaway.js";

const decisionFor = async ({ command }: { readonly command: string }) => {
  const outcome = await invokeBashHook({
    hookFileName: INLINE_EXEC_HOOK,
    command,
    runtime: "bun",
  });
  return permissionDecisionFrom({ stdout: outcome.stdout }).hookSpecificOutput
    ?.permissionDecision;
};

describe("block-inline-exec no longer approves fetch-and-run launchers", () => {
  test.each(FETCH_AND_RUN_LAUNCHERS)("denies %s running a throwaway script", async (launcher) => {
    expect(await decisionFor({ command: `${launcher} ${THROWAWAY_TAIL}` })).toBe("deny");
  });

  test.each(FETCH_AND_RUN_LAUNCHERS)(
    "denies %s fronting a harness tool path to run a throwaway script",
    async (launcher) => {
      expect(await decisionFor({ command: `${launcher} ${HARNESS_TOOL_TAIL}` })).toBe("deny");
    },
  );

  test("denies bun x reaching a harness tool through the project directory binding", async () => {
    expect(
      await decisionFor({
        command: "bun x $AIDLC_PROJECT_DIR/.aidlc/tools/launcher.ts node throwaway.js",
      }),
    ).toBe("deny");
  });

  test("denies a launcher behind a leading environment assignment", async () => {
    expect(await decisionFor({ command: `FOO=bar npx ${THROWAWAY_TAIL}` })).toBe("deny");
  });
});

describe("block-inline-exec keeps approving the retained runners", () => {
  test.each(RETAINED_RUNNERS)("passes %s running a script", async (runner) => {
    expect(await decisionFor({ command: `${runner} ${THROWAWAY_TAIL}` })).toBeUndefined();
  });

  test.each([
    "bun .claude/tools/launcher.ts node throwaway.js",
    "bun run .claude/tools/launcher.ts node throwaway.js",
    "bun $CLAUDE_PROJECT_DIR/.claude/tools/launcher.ts node throwaway.js",
    "bun .aidlc/rin-gates/launcher.ts node throwaway.js",
  ])("passes the bun harness-tool runner form %s", async (command) => {
    expect(await decisionFor({ command })).toBeUndefined();
  });
});

describe("the runner allowlist agrees with the gate on launchers", () => {
  test.each([
    { source: "the default configuration", allowlist: defaultConfig.packageManager.runnerAllowlist },
    { source: "the repository configuration", allowlist: configRunnerAllowlist({ projectDir: repositoryRoot }) },
  ])("$source lists no fetch-and-run launcher", ({ allowlist }) => {
    expect(allowlist.filter((runner) => FETCH_AND_RUN_LAUNCHERS.some((launcher) => runner === launcher))).toStrictEqual([]);
  });

  test("the repository configuration lists the same runners as the default", () => {
    expect(configRunnerAllowlist({ projectDir: repositoryRoot })).toStrictEqual(
      defaultConfig.packageManager.runnerAllowlist,
    );
  });

  test.each(
    RETAINED_RUNNERS.filter((runner) => defaultConfig.packageManager.runnerAllowlist.includes(runner)),
  )("the gate approves the configured runner %s", async (runner) => {
    expect(await decisionFor({ command: `${runner} ${HARNESS_TOOL_TAIL}` })).toBeUndefined();
  });
});
