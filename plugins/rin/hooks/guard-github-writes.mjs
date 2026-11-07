import { existsSync, readFileSync } from "node:fs";
import { basename, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const readStdin = () =>
  new Promise((resolve) => {
    let raw = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      raw += chunk;
    });
    process.stdin.on("end", () => resolve(raw));
  });

const BOT_CLI = new URL("../tools/github-apps/cli-main.ts", import.meta.url);

const IDENTITY_CONFIGURATION = new URL(
  "../../aidlc/github-identity.json",
  import.meta.url,
);

const harnessDirectoryName = () =>
  basename(dirname(dirname(fileURLToPath(import.meta.url))));

const configuredAuthorSlug = () => {
  try {
    const configuration = JSON.parse(
      readFileSync(IDENTITY_CONFIGURATION, "utf8"),
    );
    const authorSlug = configuration?.roles?.author?.appSlug;
    return typeof authorSlug === "string" && authorSlug.length > 0
      ? authorSlug
      : undefined;
  } catch {
    return undefined;
  }
};

const botIdentity = () => {
  const authorSlug = configuredAuthorSlug();
  if (authorSlug === undefined || !existsSync(BOT_CLI)) {
    return { kind: "unconfigured" };
  }
  return {
    kind: "configured",
    cli: `bun ${harnessDirectoryName()}/tools/github-apps/cli-main.ts`,
    authorLogin: `${authorSlug}[bot]`,
  };
};

const COMMAND_START = "(?:^|&&|\\|\\||[\\n;&|(`])\\s*";

const atCommandStart = ({ tail, flags }) =>
  new RegExp(`${COMMAND_START}${tail}`, flags);

const SAME_ARGUMENTS = "<the same arguments>";

const GH_WRITE_VERBS = [
  { verb: "pr create", usage: SAME_ARGUMENTS },
  { verb: "pr edit", usage: SAME_ARGUMENTS },
  { verb: "pr comment", usage: SAME_ARGUMENTS },
  { verb: "pr ready", usage: SAME_ARGUMENTS },
  { verb: "pr merge", usage: SAME_ARGUMENTS },
  { verb: "pr close", usage: '<n> [--comment "..."] (the number right after the verb)' },
  {
    verb: "pr review",
    usage:
      '<n> --approve|--request-changes|--comment [--body "..."] [--commit-sha <sha>] (the number right after the verb)',
  },
  { verb: "issue create", usage: SAME_ARGUMENTS },
  { verb: "issue edit", usage: SAME_ARGUMENTS },
  { verb: "issue comment", usage: SAME_ARGUMENTS },
  { verb: "issue close", usage: SAME_ARGUMENTS },
  { verb: "issue reopen", usage: SAME_ARGUMENTS },
];

const verbPattern = (verb) => `gh\\s+${verb.split(" ").join("\\s+")}\\b`;

const writeRules = [
  ...GH_WRITE_VERBS.map(({ verb, usage }) => ({
    pattern: atCommandStart({ tail: verbPattern(verb) }),
    hint: ({ cli }) => `${cli} gh ${verb} ${usage}`,
  })),
  {
    pattern: atCommandStart({
      tail: "gh\\s+api\\b[^\\n]*(?:-X|--method)\\s*(?:POST|PUT|PATCH|DELETE)\\b",
      flags: "i",
    }),
    hint: ({ cli }) =>
      `${cli} gh pr|issue <verb> for pull request and issue writes; for anything else, ${cli} token --role <author|reviewer> prints a scoped bot token for GH_TOKEN.`,
  },
];

const UNCONFIGURED_GUIDANCE =
  "Bot tooling is not configured: add aidlc/github-identity.json (repository, baseBranch, roles.author.appSlug, roles.reviewer.appSlug) and the per-user credential store (~/.config/rin-github-apps/credentials.json, or the directory RIN_GITHUB_APPS_CREDENTIALS_DIR names).";

const denyReasonFor = ({ breach, identity }) => {
  const opening =
    "BLOCKED: raw `gh` write would act as the operator's stored gh login (a human-only account) and bypass the bot identity.";
  if (identity.kind === "unconfigured") {
    return [
      opening,
      "",
      UNCONFIGURED_GUIDANCE,
      "",
      "Read-only gh (gh pr view / list / checks / diff, gh api GET) is fine. git push is fine.",
    ].join("\n");
  }
  return [
    opening,
    "",
    `Run the same gh command through the bot wrapper — it mints the role's bot token, pins the repository and stamps the provenance marker: ${breach.hint(identity)}`,
    "",
    `Read-only gh (gh pr view / list / checks / diff, gh api GET) is fine. git push is fine — agent worktrees push as ${identity.authorLogin} via the credential helper.`,
  ].join("\n");
};

const denyCall = ({ reason }) => {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: reason,
      },
    }),
  );
  process.exit(0);
};

const main = async () => {
  const rawInput = await readStdin();
  if (rawInput.trim() === "") process.exit(0);
  const invocation = JSON.parse(rawInput);
  if (invocation.tool_name !== "Bash") process.exit(0);
  const command = invocation.tool_input?.command ?? "";
  const breach = writeRules.find((writeRule) =>
    writeRule.pattern.test(command),
  );
  if (breach) {
    denyCall({ reason: denyReasonFor({ breach, identity: botIdentity() }) });
  }
  process.exit(0);
};

main().catch(() => process.exit(0));
