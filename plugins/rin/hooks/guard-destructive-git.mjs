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

const atCommandStart = ({ tail, flags = "i" }) =>
  new RegExp(`${COMMAND_START}${tail}`, flags);

const destructiveRules = [
  {
    pattern: atCommandStart({
      tail: "git\\s+push\\s+[^\\n;&|]*(?:--force(?!-with-lease)(?=\\s|$)|(?<=\\s)-f(?=\\s|$))",
    }),
    hint: "force-push rewrites published history. Use --force-with-lease, or surface the need to the operator if the rewrite is genuinely intended.",
  },
  {
    pattern: atCommandStart({ tail: "git\\s+reset\\s+--hard\\b" }),
    hint: "git reset --hard discards uncommitted work irreversibly. Commit or stash first (git stash push -m '<tag>'), then reset.",
  },
  {
    pattern: atCommandStart({ tail: "git\\s+clean\\s+-[a-z]*f" }),
    hint: "git clean -f deletes untracked files irreversibly. List them first with git clean -n and remove only what you own.",
  },
  {
    pattern: atCommandStart({ tail: "git\\s+branch\\s+-D\\b", flags: "" }),
    hint: "git branch -D force-deletes an unmerged branch. Use -d, or confirm the branch is merged and push it first.",
  },
  {
    pattern: atCommandStart({ tail: "rm\\s+-[rf]{1,2}(?=\\s|$)" }),
    hint: "recursive/forced delete is not runnable autonomously. Remove a specific path with a plain rm, or surface the need to the operator.",
  },
];

const denyReasonFor = ({ hint }) =>
  [
    "BLOCKED: high-blast-radius destructive operation stopped at the PreToolUse gate.",
    "",
    "CLAUDE.md names destructive git ops, force-push and dropping data as actions that",
    "require the operator's say-so. This gate stops them BEFORE any permission prompt, because an",
    "unattended prompt can strand this session for hours and the operation itself is not",
    "reversible once it runs.",
    "",
    hint,
    "",
    "There is no self-granted bypass here. If the operation is genuinely required, STOP and",
    "surface what you need to run and why.",
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
  const violated = destructiveRules.find(({ pattern }) =>
    pattern.test(command),
  );
  if (violated !== undefined) denyCall({ reason: denyReasonFor(violated) });
  process.exit(0);
};

main().catch(() => process.exit(0));
