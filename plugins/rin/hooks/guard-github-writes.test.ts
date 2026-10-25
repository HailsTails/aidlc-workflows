import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { defaultPathOperations } from "../tools/rin-harness-path-operations.ts";
import { defaultFileTextPort } from "../tools/rin-harness-sidecar-file-reader.ts";
import {
  commandInvocationPayload,
  invokeBashHook,
  permissionDecisionFrom,
  runRanHookProcess,
} from "./run-hook-process.ts";

const HOOK = "guard-github-writes.mjs";
const RUNTIME = "node";

const BOT_CLI = "bun .claude/tools/github-apps/cli-main.ts";

const paths = defaultPathOperations();
const files = defaultFileTextPort();

const sourceHookPath = paths.join({
  segments: [paths.dirname({ path: paths.fromFileUrl({ url: import.meta.url }) }), HOOK],
});

type ConsumerInstall = {
  readonly withIdentityConfiguration: boolean;
  readonly withBotCli: boolean;
};

const installedConsumerRoots: string[] = [];

const installConsumer = ({ withIdentityConfiguration, withBotCli }: ConsumerInstall): string => {
  const projectRoot = files.makeTemporaryDirectory(
    paths.join({ segments: [files.temporaryRoot(), "guard-github-writes-consumer-"] }),
  );
  installedConsumerRoots.push(projectRoot);
  const hooksDirectory = paths.join({ segments: [projectRoot, ".claude", "hooks"] });
  files.mkdir(hooksDirectory, { recursive: true });
  files.write(paths.join({ segments: [hooksDirectory, HOOK] }), files.read(sourceHookPath));
  if (withBotCli) {
    const toolDirectory = paths.join({ segments: [projectRoot, ".claude", "tools", "github-apps"] });
    files.mkdir(toolDirectory, { recursive: true });
    files.write(paths.join({ segments: [toolDirectory, "cli-main.ts"] }), "");
  }
  if (withIdentityConfiguration) {
    const workspace = paths.join({ segments: [projectRoot, "aidlc"] });
    files.mkdir(workspace, { recursive: true });
    files.write(
      paths.join({ segments: [workspace, "github-identity.json"] }),
      JSON.stringify({
        repository: "example/shop",
        baseBranch: "main",
        roles: { author: { appSlug: "shop-author" }, reviewer: { appSlug: "shop-reviewer" } },
      }),
    );
  }
  return paths.join({ segments: [hooksDirectory, HOOK] });
};

let configuredHook = "";

beforeAll(() => {
  configuredHook = installConsumer({ withIdentityConfiguration: true, withBotCli: true });
});

afterAll(() => {
  installedConsumerRoots.splice(0).forEach((projectRoot) => {
    files.remove(projectRoot, { recursive: true, force: true });
  });
});

const denialOf = async ({
  command,
  hookPath,
}: {
  readonly command: string;
  readonly hookPath: string;
}) => {
  const outcome = await invokeBashHook({ hookFileName: HOOK, hookPath, command, runtime: RUNTIME });
  return permissionDecisionFrom({ stdout: outcome.stdout }).hookSpecificOutput;
};

describe("guard-github-writes deny path", () => {
  test("denies raw gh pr create via permissionDecision", async () => {
    const outcome = await invokeBashHook({
      hookFileName: HOOK,
      hookPath: configuredHook,
      command: 'gh pr create --title "x" --body "y"',
      runtime: RUNTIME,
    });
    const decision = permissionDecisionFrom({ stdout: outcome.stdout });
    expect(decision.hookSpecificOutput?.permissionDecision).toBe("deny");
    expect(decision.hookSpecificOutput?.permissionDecisionReason).toContain(
      `${BOT_CLI} pr `,
    );
  });

  test("denies raw gh pr edit and names the gh:pr-edit wrapper", async () => {
    const outcome = await invokeBashHook({
      hookFileName: HOOK,
      hookPath: configuredHook,
      command: 'gh pr edit 42 --body "y"',
      runtime: RUNTIME,
    });
    const decision = permissionDecisionFrom({ stdout: outcome.stdout });
    expect(decision.hookSpecificOutput?.permissionDecision).toBe("deny");
    expect(decision.hookSpecificOutput?.permissionDecisionReason).toContain(
      `${BOT_CLI} pr-edit`,
    );
  });

  test("denies raw gh pr review", async () => {
    const outcome = await invokeBashHook({
      hookFileName: HOOK,
      hookPath: configuredHook,
      command: "gh pr review 42 --approve",
      runtime: RUNTIME,
    });
    const decision = permissionDecisionFrom({ stdout: outcome.stdout });
    expect(decision.hookSpecificOutput?.permissionDecision).toBe("deny");
  });

  test("denies raw gh issue comment", async () => {
    const outcome = await invokeBashHook({
      hookFileName: HOOK,
      hookPath: configuredHook,
      command: 'gh issue comment 42 --body "x"',
      runtime: RUNTIME,
    });
    const decision = permissionDecisionFrom({ stdout: outcome.stdout });
    expect(decision.hookSpecificOutput?.permissionDecision).toBe("deny");
    expect(decision.hookSpecificOutput?.permissionDecisionReason).toContain(
      `${BOT_CLI} comment`,
    );
  });

  test("denies raw gh pr merge", async () => {
    const outcome = await invokeBashHook({
      hookFileName: HOOK,
      hookPath: configuredHook,
      command: "gh pr merge 42 --squash",
      runtime: RUNTIME,
    });
    const decision = permissionDecisionFrom({ stdout: outcome.stdout });
    expect(decision.hookSpecificOutput?.permissionDecision).toBe("deny");
    expect(decision.hookSpecificOutput?.permissionDecisionReason).toContain(
      `${BOT_CLI} merge`,
    );
  });

  test("denies a mutating gh api call", async () => {
    const outcome = await invokeBashHook({
      hookFileName: HOOK,
      hookPath: configuredHook,
      command: "gh api -X POST repos/example/project/issues",
      runtime: RUNTIME,
    });
    const decision = permissionDecisionFrom({ stdout: outcome.stdout });
    expect(decision.hookSpecificOutput?.permissionDecision).toBe("deny");
  });

  test("denies raw gh pr close and names the gh:close wrapper", async () => {
    const outcome = await invokeBashHook({
      hookFileName: HOOK,
      hookPath: configuredHook,
      command: "gh pr close 42",
      runtime: RUNTIME,
    });
    const decision = permissionDecisionFrom({ stdout: outcome.stdout });
    expect(decision.hookSpecificOutput?.permissionDecision).toBe("deny");
    expect(decision.hookSpecificOutput?.permissionDecisionReason).toContain(
      `${BOT_CLI} close`,
    );
  });

  test("denies gh pr ready --undo and names the gh:draft wrapper", async () => {
    const outcome = await invokeBashHook({
      hookFileName: HOOK,
      hookPath: configuredHook,
      command: "gh pr ready 42 --undo",
      runtime: RUNTIME,
    });
    const decision = permissionDecisionFrom({ stdout: outcome.stdout });
    expect(decision.hookSpecificOutput?.permissionDecision).toBe("deny");
    expect(decision.hookSpecificOutput?.permissionDecisionReason).toContain(
      `${BOT_CLI} draft`,
    );
  });

  test("denies plain gh pr ready and names the gh:ready wrapper", async () => {
    const outcome = await invokeBashHook({
      hookFileName: HOOK,
      hookPath: configuredHook,
      command: "gh pr ready 42",
      runtime: RUNTIME,
    });
    const decision = permissionDecisionFrom({ stdout: outcome.stdout });
    expect(decision.hookSpecificOutput?.permissionDecision).toBe("deny");
    expect(decision.hookSpecificOutput?.permissionDecisionReason).toContain(
      `${BOT_CLI} ready`,
    );
  });

  test("denies gh pr create chained after another command", async () => {
    const outcome = await invokeBashHook({
      hookFileName: HOOK,
      hookPath: configuredHook,
      command: "git push && gh pr create --fill",
      runtime: RUNTIME,
    });
    const decision = permissionDecisionFrom({ stdout: outcome.stdout });
    expect(decision.hookSpecificOutput?.permissionDecision).toBe("deny");
  });
});

describe("guard-github-writes configured identity wording", () => {
  test("names the configured author bot as the merging identity", async () => {
    const denial = await denialOf({ command: "gh pr merge 42", hookPath: configuredHook });
    expect(denial?.permissionDecisionReason).toContain("squash-merges as shop-author[bot]");
  });

  test("names the configured author bot as the pushing identity", async () => {
    const denial = await denialOf({ command: "gh pr create --fill", hookPath: configuredHook });
    expect(denial?.permissionDecisionReason).toContain(
      "agent worktrees push as shop-author[bot] via the credential helper",
    );
  });

  test("names the bot CLI the install actually ships for a mutating gh api call", async () => {
    const denial = await denialOf({
      command: "gh api -X PATCH repos/example/shop/pulls/1",
      hookPath: configuredHook,
    });
    expect(denial?.permissionDecisionReason).toContain(
      `${BOT_CLI} token --role <author|reviewer>`,
    );
  });
});

describe("guard-github-writes without a configured bot identity", () => {
  test("still denies a raw write but points at the missing configuration, not a wrapper", async () => {
    const hookPath = installConsumer({ withIdentityConfiguration: false, withBotCli: true });
    const denial = await denialOf({ command: "gh pr create --fill", hookPath });
    expect(denial?.permissionDecision).toBe("deny");
    expect(denial?.permissionDecisionReason).toContain(
      "Bot tooling is not configured: add aidlc/github-identity.json",
    );
    expect(denial?.permissionDecisionReason).not.toContain("cli-main.ts");
    expect(denial?.permissionDecisionReason).not.toContain("[bot]");
  });

  test("treats an install without the bot CLI as unconfigured", async () => {
    const hookPath = installConsumer({ withIdentityConfiguration: true, withBotCli: false });
    const denial = await denialOf({ command: "gh pr merge 42", hookPath });
    expect(denial?.permissionDecision).toBe("deny");
    expect(denial?.permissionDecisionReason).toContain("Bot tooling is not configured");
    expect(denial?.permissionDecisionReason).not.toContain("pnpm");
  });
});

describe("guard-github-writes pass-through path", () => {
  test("allows read-only gh pr view with no deny decision", async () => {
    const outcome = await invokeBashHook({
      hookFileName: HOOK,
      hookPath: configuredHook,
      command: "gh pr view 42",
      runtime: RUNTIME,
    });
    const decision = permissionDecisionFrom({ stdout: outcome.stdout });
    expect(decision.hookSpecificOutput?.permissionDecision).toBeUndefined();
  });

  test("allows a read-only gh api GET", async () => {
    const outcome = await invokeBashHook({
      hookFileName: HOOK,
      hookPath: configuredHook,
      command: "gh api installation/repositories",
      runtime: RUNTIME,
    });
    const decision = permissionDecisionFrom({ stdout: outcome.stdout });
    expect(decision.hookSpecificOutput?.permissionDecision).toBeUndefined();
  });

  test("allows a gh api call whose method is a read verb", async () => {
    const outcome = await invokeBashHook({
      hookFileName: HOOK,
      hookPath: configuredHook,
      command: "gh api -X GET repos/example/project/pulls",
      runtime: RUNTIME,
    });
    const decision = permissionDecisionFrom({ stdout: outcome.stdout });
    expect(decision.hookSpecificOutput?.permissionDecision).toBeUndefined();
  });

  test("allows gh pr list, a near-miss on the pr write verbs", async () => {
    const outcome = await invokeBashHook({
      hookFileName: HOOK,
      hookPath: configuredHook,
      command: "gh pr list --state open",
      runtime: RUNTIME,
    });
    const decision = permissionDecisionFrom({ stdout: outcome.stdout });
    expect(decision.hookSpecificOutput?.permissionDecision).toBeUndefined();
  });

  test("allows the bot CLI that the deny reason recommends", async () => {
    const outcome = await invokeBashHook({
      hookFileName: HOOK,
      hookPath: configuredHook,
      command: `${BOT_CLI} pr --title "x" --body "y"`,
      runtime: RUNTIME,
    });
    const decision = permissionDecisionFrom({ stdout: outcome.stdout });
    expect(decision.hookSpecificOutput?.permissionDecision).toBeUndefined();
  });

  test("allows plain git push", async () => {
    const outcome = await invokeBashHook({
      hookFileName: HOOK,
      hookPath: configuredHook,
      command: "git push",
      runtime: RUNTIME,
    });
    const decision = permissionDecisionFrom({ stdout: outcome.stdout });
    expect(decision.hookSpecificOutput?.permissionDecision).toBeUndefined();
  });

  test("ignores non-Bash tools", async () => {
    const outcome = await runRanHookProcess({
      hookFileName: HOOK,
      runtime: RUNTIME,
      stdinPayload: commandInvocationPayload({
        toolName: "Read",
        command: "gh pr create",
      }),
    });
    const decision = permissionDecisionFrom({ stdout: outcome.stdout });
    expect(decision.hookSpecificOutput?.permissionDecision).toBeUndefined();
  });

  test("exits without a decision on empty stdin", async () => {
    const outcome = await runRanHookProcess({
      hookFileName: HOOK,
      runtime: RUNTIME,
      stdinPayload: "",
    });
    const decision = permissionDecisionFrom({ stdout: outcome.stdout });
    expect(decision.hookSpecificOutput?.permissionDecision).toBeUndefined();
  });

  test("treats a Bash payload with no command as an empty command", async () => {
    const outcome = await runRanHookProcess({
      hookFileName: HOOK,
      runtime: RUNTIME,
      stdinPayload: JSON.stringify({ tool_name: "Bash", tool_input: {} }),
    });
    const decision = permissionDecisionFrom({ stdout: outcome.stdout });
    expect(decision.hookSpecificOutput?.permissionDecision).toBeUndefined();
  });
});
