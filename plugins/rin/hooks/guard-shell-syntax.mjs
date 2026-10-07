const readStdin = () =>
  new Promise((resolve) => {
    let raw = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      raw += chunk;
    });
    process.stdin.on("end", () => resolve(raw));
  });

const denyCall = ({ reason }) => {
  process.stderr.write(reason);
  process.exit(2);
};

const hereStringRules = [
  {
    pattern: /\bgit\s+commit\b[^\n]*-m\s+@['"]/i,
    reason:
      "Blocked: `git commit -m @'…'` uses PowerShell here-string syntax inside the Bash tool — it mangles the commit message (recurring friction). Use a quoted `git commit -m \"…\"`, or write the message to a temp file and `git commit -F <file>`. PowerShell here-strings (@'…'@) belong only in the PowerShell tool.",
  },
  {
    pattern: /^\s*['"]@\s*$/m,
    reason:
      "Blocked: a PowerShell here-string closer ('@ or \"@ on its own line) inside the Bash tool. Here-strings are PowerShell-only and corrupt multi-line Bash arguments. Use `git commit -m \"…\"` or `git commit -F <file>`; for other multi-line input use a bash heredoc (<<'EOF' … EOF).",
  },
];

const main = async () => {
  const rawInput = await readStdin();
  if (rawInput.trim() === "") process.exit(0);
  const invocation = JSON.parse(rawInput);
  if (invocation.tool_name !== "Bash") process.exit(0);
  const command = invocation.tool_input?.command ?? "";
  const breach = hereStringRules.find((hereStringRule) =>
    hereStringRule.pattern.test(command),
  );
  if (breach) denyCall({ reason: breach.reason });
  process.exit(0);
};

main().catch(() => process.exit(0));
