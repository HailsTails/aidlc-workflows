import { readFileSync, statSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";

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

const GIT_FLAG = "(?:-c\\s+\\S+\\s+)*";

const gitCommitPattern = new RegExp(
  `${COMMAND_START}git\\s+${GIT_FLAG}commit\\b`,
);

const commandCommitsAtPrimary = ({ command }) => gitCommitPattern.test(command);

const primaryCheckoutRootFrom = ({ checkoutRoot }) => {
  const gitPath = join(checkoutRoot, ".git");
  try {
    if (statSync(gitPath).isDirectory()) return checkoutRoot;
    const gitdirLine = readFileSync(gitPath, "utf8").match(
      /^gitdir:\s*(.+?)\s*$/m,
    );
    if (gitdirLine === null) return checkoutRoot;
    const gitdir = isAbsolute(gitdirLine[1])
      ? gitdirLine[1]
      : resolve(checkoutRoot, gitdirLine[1]);
    const primaryMatch = gitdir
      .replace(/\\/g, "/")
      .match(/^(.*)\/\.git\/worktrees\/[^/]+$/);
    return primaryMatch === null ? checkoutRoot : primaryMatch[1];
  } catch {
    return checkoutRoot;
  }
};

const isPrimaryCheckout = ({ checkoutRoot }) =>
  primaryCheckoutRootFrom({ checkoutRoot }) === resolve(checkoutRoot);

const denyReason =
  "Agent sessions never commit at the primary checkout (stranded-artefact prevention). EnterWorktree (or create an agent worktree), commit there, push, and open the PR the same run via pnpm run gh:pr. The operator's own commits from their terminal are unaffected.";

const denyCall = () => {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: denyReason,
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
  if (!commandCommitsAtPrimary({ command })) process.exit(0);
  const checkoutRoot = invocation.cwd ?? process.cwd();
  if (!isPrimaryCheckout({ checkoutRoot })) process.exit(0);
  denyCall();
};

main().catch(() => process.exit(0));
