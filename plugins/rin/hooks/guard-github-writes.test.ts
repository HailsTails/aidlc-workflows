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

const configuredDenial = (hint: string) =>
  [
    "BLOCKED: raw `gh` write would act as the operator's stored gh login (a human-only account) and bypass the bot identity.",
    "",
    `Run the same gh command through the bot wrapper — it mints the role's bot token, pins the repository and stamps the provenance marker: ${hint}`,
    "",
    "Read-only gh (gh pr view / list / checks / diff, gh api GET) is fine. git push is fine — agent worktrees push as shop-author[bot] via the credential helper.",
  ].join("\n");

describe("guard-github-writes deny path", () => {
  test.each([
    ['gh pr create --title "x" --body "y"', `${BOT_CLI} gh pr create <the same arguments>`],
    ['gh pr edit 42 --body "y"', `${BOT_CLI} gh pr edit <the same arguments>`],
    ['gh pr comment 42 --body "x"', `${BOT_CLI} gh pr comment <the same arguments>`],
    ["gh pr ready 42 --undo", `${BOT_CLI} gh pr ready <the same arguments>`],
    ["gh pr merge 42 --squash", `${BOT_CLI} gh pr merge <the same arguments>`],
    [
      "gh pr close 42",
      `${BOT_CLI} gh pr close <n> [--comment "..."] (the number right after the verb)`,
    ],
    [
      "gh pr review 42 --approve",
      `${BOT_CLI} gh pr review <n> --approve|--request-changes|--comment [--body "..."] [--commit-sha <sha>] (the number right after the verb)`,
    ],
    ['gh issue create --title "x" --body "y" --label bug', `${BOT_CLI} gh issue create <the same arguments>`],
    ["gh issue edit 42 --add-label stage:build", `${BOT_CLI} gh issue edit <the same arguments>`],
    ['gh issue comment 42 --body "x"', `${BOT_CLI} gh issue comment <the same arguments>`],
    ['gh issue close 42 --comment "done"', `${BOT_CLI} gh issue close <the same arguments>`],
    ["gh issue reopen 42", `${BOT_CLI} gh issue reopen <the same arguments>`],
    ["git push && gh pr create --fill", `${BOT_CLI} gh pr create <the same arguments>`],
    [
      "gh api -X PATCH repos/example/shop/pulls/1",
      `${BOT_CLI} gh pr|issue <verb> for pull request and issue writes; for anything else, ${BOT_CLI} token --role <author|reviewer> prints a scoped bot token for GH_TOKEN.`,
    ],
  ])("denies raw %s and names the same command through the bot CLI", async (command, hint) => {
    expect(await denialOf({ command, hookPath: configuredHook })).toEqual({
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: configuredDenial(hint),
    });
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

  test("allows read-only gh issue view and list", async () => {
    const viewed = await denialOf({ command: "gh issue view 42", hookPath: configuredHook });
    const listed = await denialOf({
      command: "gh issue list --label stage:triage",
      hookPath: configuredHook,
    });
    expect(viewed?.permissionDecision).toBeUndefined();
    expect(listed?.permissionDecision).toBeUndefined();
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
      command: `${BOT_CLI} gh pr create --title "x" --body "y"`,
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
