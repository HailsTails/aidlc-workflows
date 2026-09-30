const readStdin = () =>
  new Promise((resolve) => {
    let raw = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      raw += chunk;
    });
    process.stdin.on("end", () => resolve(raw));
  });

const COMMAND_START = "(?:^|&&|\\|\\||[\\n;&|(`])\\s*";

const atCommandStart = ({ tail, flags }) =>
  new RegExp(`${COMMAND_START}${tail}`, flags);

const writeRules = [
  {
    pattern: atCommandStart({ tail: "gh\\s+pr\\s+create\\b" }),
    hint: 'pnpm gh:pr -- --title "..." --body "..."',
  },
  {
    pattern: atCommandStart({ tail: "gh\\s+pr\\s+edit\\b" }),
    hint: 'pnpm gh:pr-edit -- --pr <n> [--title "..."] [--body "..."]',
  },
  {
    pattern: atCommandStart({ tail: "gh\\s+pr\\s+review\\b" }),
    hint: 'pnpm gh:review -- --pr <n> --event approve|request-changes|comment --body "..."',
  },
  {
    pattern: atCommandStart({ tail: "gh\\s+(?:pr|issue)\\s+comment\\b" }),
    hint: 'pnpm gh:comment -- --target <n> --body "..."',
  },
  {
    pattern: atCommandStart({ tail: "gh\\s+pr\\s+merge\\b" }),
    hint: "pnpm gh:merge -- --pr <n> (squash-merges as rin-author; refuses without an APPROVED verdict)",
  },
  {
    pattern: atCommandStart({ tail: "gh\\s+pr\\s+close\\b" }),
    hint: "pnpm gh:close -- --pr <n> --reason <text>",
  },
  {
    pattern: atCommandStart({ tail: "gh\\s+pr\\s+ready\\b[^\\n]*--undo\\b" }),
    hint: "pnpm gh:draft -- --pr <n> (converts to draft so a review sweep cannot merge work in progress)",
  },
  {
    pattern: atCommandStart({ tail: "gh\\s+pr\\s+ready\\b" }),
    hint: "pnpm gh:ready -- --pr <n> (marks ready for review once the board has converged)",
  },
  {
    pattern: atCommandStart({
      tail: "gh\\s+api\\b[^\\n]*(?:-X|--method)\\s*(?:POST|PUT|PATCH|DELETE)\\b",
      flags: "i",
    }),
    hint: "mutating gh api under the human login is blocked — use a role wrapper (pnpm gh:pr / gh:review / gh:comment) or mint a scoped token with pnpm -s gh:token:<role>.",
  },
];

const denyReasonFor = ({ hint }) =>
  [
    "BLOCKED: raw `gh` write would act as the operator's stored gh login (a human-only account) and bypass the bot identity.",
    "",
    `Use the role-scoped wrapper instead — it mints the right bot token and adds the provenance marker: ${hint}`,
    "",
    "Read-only gh (gh pr view / list / checks / diff, gh api GET) is fine. git push is fine — agent worktrees push as rin-author[bot] via the credential helper.",
  ].join("\n");

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
  if (breach) denyCall({ reason: denyReasonFor({ hint: breach.hint }) });
  process.exit(0);
};

main().catch(() => process.exit(0));
