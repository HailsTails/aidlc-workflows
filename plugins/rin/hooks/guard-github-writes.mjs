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

const writeRules = [
  {
    pattern: atCommandStart({ tail: "gh\\s+pr\\s+create\\b" }),
    hint: ({ cli }) => `${cli} pr --title "..." --body "..."`,
  },
  {
    pattern: atCommandStart({ tail: "gh\\s+pr\\s+edit\\b" }),
    hint: ({ cli }) =>
      `${cli} pr-edit --pr <n> [--title "..."] [--body "..."]`,
  },
  {
    pattern: atCommandStart({ tail: "gh\\s+pr\\s+review\\b" }),
    hint: ({ cli }) =>
      `${cli} review --pr <n> --event approve|request-changes|comment --body "..."`,
  },
  {
    pattern: atCommandStart({ tail: "gh\\s+(?:pr|issue)\\s+comment\\b" }),
    hint: ({ cli }) => `${cli} comment --target <n> --body "..."`,
  },
  {
    pattern: atCommandStart({ tail: "gh\\s+pr\\s+merge\\b" }),
    hint: ({ cli, authorLogin }) =>
      `${cli} merge --pr <n> (squash-merges as ${authorLogin}; refuses without an APPROVED verdict)`,
  },
  {
    pattern: atCommandStart({ tail: "gh\\s+pr\\s+close\\b" }),
    hint: ({ cli }) => `${cli} close --pr <n> --reason <text>`,
  },
  {
    pattern: atCommandStart({ tail: "gh\\s+pr\\s+ready\\b[^\\n]*--undo\\b" }),
    hint: ({ cli }) =>
      `${cli} draft --pr <n> (converts to draft so a review sweep cannot merge work in progress)`,
  },
  {
    pattern: atCommandStart({ tail: "gh\\s+pr\\s+ready\\b" }),
    hint: ({ cli }) =>
      `${cli} ready --pr <n> (marks ready for review once the board has converged)`,
  },
  {
    pattern: atCommandStart({
      tail: "gh\\s+api\\b[^\\n]*(?:-X|--method)\\s*(?:POST|PUT|PATCH|DELETE)\\b",
      flags: "i",
    }),
    hint: ({ cli }) =>
      `mutating gh api under the human login is blocked — use a role wrapper (${cli} pr / review / comment) or mint a scoped token with ${cli} token --role <author|reviewer>.`,
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
    `Use the role-scoped wrapper instead — it mints the right bot token and adds the provenance marker: ${breach.hint(identity)}`,
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
