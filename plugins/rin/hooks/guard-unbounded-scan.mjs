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

const BUILT_IN_TOOL_DISCIPLINE = [
  "Built-in tools need scoping too — always pass a path/glob/type, never a bare call at the repo root.",
  "Glob does NOT honour .gitignore (it runs --no-ignore --hidden), so it walks every worktree; and when",
  "that traversal times out it returns ZERO results SILENTLY. Treat a suspiciously-empty Glob as a",
  "possible timeout, not proof of absence. Upstream: anthropics/claude-code#20609 and #16043.",
].join("\n");

const SANCTIONED_ALTERNATIVES = [
  "Use one of these instead:",
  "  - Grep tool (text in files) / Glob tool (filenames) / Read tool (one file), each with a scoped path.",
  "  - `git ls-files <subpath>` or `git grep <pattern>` — index-scoped, so untracked junk and sibling worktrees are invisible.",
  "  - `rg` / `fd` — honour .gitignore by default.",
  "  - A bounded `find`: add `-maxdepth <n>`, `-prune` the noise tree, or root it at a specific package/record subpath.",
  "",
  BUILT_IN_TOOL_DISCIPLINE,
].join("\n");

const SEPARATOR_OUTSIDE_QUOTES = /(?:"[^"]*"|'[^']*'|[^"'&|;\n`]+)+|[&|;\n`]+/g;

const shellSegmentsOf = ({ command }) => {
  const separatorRun = /^[&|;\n`]+$/;
  return (command.match(SEPARATOR_OUTSIDE_QUOTES) ?? []).filter(
    (piece) => !separatorRun.test(piece),
  );
};

const NOISE_SEGMENTS = new Set(["node_modules", "worktrees", "projects"]);

const NOISE_PREFIXES = [
  [".claude", "worktrees"],
  [".claude", "projects"],
  [".aidlc", "worktrees"],
];

const startsWithNoisePrefix = ({ segments }) => {
  const lowered = segments.map((segment) => segment.toLowerCase());
  return NOISE_PREFIXES.some((prefix) =>
    prefix.every((part, depth) => lowered[depth] === part),
  );
};

const REPO_ROOT_SPELLINGS = [/^\.$/, /^\.\/$/];

const flagLike = /^-/;

const quoteWrapper = /^["']|["']$/g;

const stripQuotes = ({ token }) => token.replace(quoteWrapper, "");

const resolveTraversal = ({ segments }) =>
  segments.reduce((resolved, segment) => {
    if (segment === ".") return resolved;
    if (segment !== "..") {
      resolved.push(segment);
      return resolved;
    }
    resolved.pop();
    return resolved;
  }, []);

const pathSegmentsOf = ({ token }) =>
  resolveTraversal({
    segments: stripQuotes({ token })
      .split(/[\\/]+/)
      .filter((segment) => segment.length > 0),
  });

const homePrefixed =
  /^(?:~|\$HOME|\$env:USERPROFILE|%USERPROFILE%)(?:[\\/]|$)/i;

const isHomeRoot = ({ token }) => homePrefixed.test(stripQuotes({ token }));

const driveLetterSegment = /^[A-Za-z]:?$/;

const isUserProfileTree = ({ token, segments }) => {
  const lowered = segments.map((segment) => segment.toLowerCase());
  const absolute = /^[\\/]|^[A-Za-z]:/.test(stripQuotes({ token }));
  if (!absolute) return false;
  if (lowered[0] === "home") return true;
  if (lowered[0] === "users") return true;
  return lowered[1] === "users" && driveLetterSegment.test(segments[0] ?? "");
};

const isRepoRoot = ({ token }) => {
  const bare = stripQuotes({ token });
  return REPO_ROOT_SPELLINGS.some((spelling) => spelling.test(bare));
};

const isFilesystemRoot = ({ token, segments }) => {
  const bare = stripQuotes({ token });
  if (/^[\\/]$/.test(bare)) return true;
  return (
    segments.length <= 1 &&
    /^[\\/]/.test(bare) &&
    driveLetterSegment.test(segments[0] ?? "")
  );
};

const isNoiseRootedPath = ({ token }) => {
  if (isHomeRoot({ token })) return true;
  if (isRepoRoot({ token })) return true;
  const segments = pathSegmentsOf({ token });
  if (segments.length === 0) return false;
  if (isFilesystemRoot({ token, segments })) return true;
  if (isUserProfileTree({ token, segments })) return true;
  if (startsWithNoisePrefix({ segments })) return true;
  const firstMeaningful = segments.find((segment) => segment !== ".");
  return (
    firstMeaningful !== undefined &&
    NOISE_SEGMENTS.has(firstMeaningful.toLowerCase())
  );
};

const positionalArgumentsOf = ({ segment, scannerToken }) => {
  const tokens = segment.trim().split(/\s+/);
  const scannerAt = scannerAtIn({ segment, scannerToken });
  if (scannerAt === -1) return [];
  return tokens
    .slice(scannerAt + 1)
    .filter((token) => !flagLike.test(token))
    .filter((token) => stripQuotes({ token }).length > 0);
};

const TRANSPARENT_PREFIXES = new Set([
  "sudo",
  "time",
  "env",
  "nice",
  "nohup",
  "command",
  "builtin",
  "exec",
  "xargs",
]);

const environmentAssignment = /^[A-Za-z_][A-Za-z0-9_]*=/;

const commandHeadTokens = ({ segment }) => {
  const tokens = segment.trim().split(/\s+/);
  const firstMeaningfulAt = tokens.findIndex(
    (token) =>
      !TRANSPARENT_PREFIXES.has(token.toLowerCase()) &&
      !environmentAssignment.test(token),
  );
  return firstMeaningfulAt === -1 ? [] : tokens.slice(firstMeaningfulAt);
};

const commandNameOf = ({ token }) => {
  const unescaped = stripQuotes({ token }).replace(/^\\/, "");
  const basename = unescaped.split(/[\\/]/).at(-1) ?? "";
  return basename.replace(/\.(?:exe|cmd|bat)$/i, "").toLowerCase();
};

const precedesScannerLegitimately = ({ token, previous }) =>
  TRANSPARENT_PREFIXES.has(commandNameOf({ token })) ||
  environmentAssignment.test(token) ||
  flagLike.test(token) ||
  (previous !== undefined && flagLike.test(previous));

const scannerAtIn = ({ segment, scannerToken }) => {
  const tokens = segment.trim().split(/\s+/);
  return tokens.findIndex(
    (token, index) =>
      commandNameOf({ token }) === scannerToken &&
      tokens.slice(0, index).every((earlier, earlierIndex) =>
        precedesScannerLegitimately({
          token: earlier,
          previous: tokens[earlierIndex - 1],
        }),
      ),
  );
};

const scannerHeadOf = ({ segment, scannerToken }) =>
  scannerAtIn({ segment, scannerToken }) !== -1;

const scansANoiseRoot = ({ segment, scannerToken }) =>
  positionalArgumentsOf({ segment, scannerToken }).some((token) =>
    isNoiseRootedPath({ token }),
  );

const boundedFindFlag = /\s-(?:maxdepth|prune|quit)\b/i;

const boundedDiskUsageFlag = /\s(?:-d\s*\d+|--max-depth[=\s]\s*\d+)/i;

const recursiveGrepFlag =
  /\s(?:-\w*[rR]\w*|--recursive|--dereference-recursive)(?:\s|$)/;

const recursiveListFlag = /\s(?:-\w*R\w*|--recursive)(?:\s|$)/;

const powershellRecurseFlag = /-Recurse\b/i;

const powershellDepthFlag = /-Depth\s+\d+/i;

const powershellScannerTokens = new Set(["get-childitem", "gci", "dir", "ls"]);

const powershellHeadOf = ({ segment }) =>
  powershellScannerTokens.has(
    commandNameOf({ token: commandHeadTokens({ segment })[0] ?? "" }),
  );

const valueConsumingFlag = /^-(?:Filter|Include|Exclude|Depth)$/i;

const powershellPathArguments = ({ segment }) => {
  const tokens = commandHeadTokens({ segment }).slice(1);
  return tokens.filter((token, index) => {
    if (flagLike.test(token)) return false;
    const previous = tokens[index - 1];
    return previous === undefined || !valueConsumingFlag.test(previous);
  });
};

const findReason = [
  "Blocked: unbounded recursive `find` over an accumulating tree.",
  "",
  "This machine carries ~180 worktrees under .claude/worktrees plus the transcript tree under",
  "~/.claude/projects. A `find` rooted there, at the repo root, at node_modules or at your home",
  "directory walks all of it, honours no ignore file, and takes minutes to return mostly-noise.",
  "",
  "Scans INTO a bounded subdirectory (.claude/hooks, .claude/knowledge/..., a package, a record dir)",
  "are fine and are not blocked — only the accumulating trees are.",
  "",
  SANCTIONED_ALTERNATIVES,
].join("\n");

const listReason = [
  "Blocked: unbounded recursive `ls -R` over an oversized noise tree.",
  "",
  "Recursive listing of .claude, .aidlc, the repo root, node_modules or your home directory walks every",
  "worktree and dependency tree. It honours no ignore file and returns far more than the session reads.",
  "",
  SANCTIONED_ALTERNATIVES,
].join("\n");

const grepReason = [
  "Blocked: recursive `grep` rooted at an oversized noise tree.",
  "",
  "grep honours NO ignore file — not .gitignore, not .ignore — so it walks every worktree and every",
  "node_modules. Measured on this repo: 11.4s for `grep -r` versus 0.30s for `git grep` on the same",
  "query, and the gap widens with every worktree that accumulates.",
  "",
  "A recursive grep rooted at a bounded subdirectory — a package, a record dir, .claude/hooks,",
  ".claude/knowledge/... — is fine and is NOT blocked. This fired only because the scan root itself",
  "resolves to an accumulating tree.",
  "",
  SANCTIONED_ALTERNATIVES,
].join("\n");

const diskUsageReason = [
  "Blocked: unbounded recursive `du` over an oversized noise tree.",
  "",
  "A recursive `du` at .claude, .aidlc, the repo root or your home directory stats every file in every",
  "worktree. Scope it to the subpath you actually want to size, or bound it with `-d <n>`.",
  "",
  SANCTIONED_ALTERNATIVES,
].join("\n");

const powershellReason = [
  "Blocked: `Get-ChildItem -Recurse` over an oversized noise tree.",
  "",
  "Recursing .claude, .aidlc, the repo root, node_modules or your user profile walks every worktree and",
  "dependency tree, honours no ignore file, and takes minutes to return mostly-noise.",
  "",
  "Use the Grep or Glob tool with a scoped path, `git ls-files`, or bound the recursion with",
  "`-Depth <n>` and root it at a specific package or record subpath.",
  "",
  BUILT_IN_TOOL_DISCIPLINE,
].join("\n");

const namePatternOf = ({ segment }) => {
  const named = segment.match(/-(?:i?name|path)\s+(\S+)/);
  return named?.[1] ?? "'*'";
};

const grepPatternOf = ({ segment, scannerToken }) =>
  positionalArgumentsOf({ segment, scannerToken })[0] ?? "<pattern>";

const globPatternOf = ({ segment }) => {
  const bare = namePatternOf({ segment }).replace(/['"]/g, "");
  return bare.startsWith("**/") ? bare : `**/${bare}`;
};

const correctedFindFor = ({ segment }) =>
  [
    "Copy-ready replacements for what you just ran:",
    `  git ls-files '${namePatternOf({ segment }).replace(/['"]/g, "")}'`,
    `  Glob tool: pattern '${globPatternOf({ segment })}', path '<the subdirectory you actually need>'`,
    `  find <scoped-subpath> -maxdepth 3 ${segment.match(/-i?name\s+\S+/)?.[0] ?? "-type f"}`,
  ].join("\n");

const correctedGrepFor = ({ segment }) => {
  const pattern = grepPatternOf({ segment, scannerToken: "grep" });
  return [
    "Copy-ready replacements for what you just ran:",
    `  git grep -n ${pattern}`,
    `  Grep tool: pattern '${pattern.replace(/['"]/g, "")}', path '<the subdirectory you actually need>'`,
  ].join("\n");
};

const scanRules = [
  {
    matches: ({ segment }) =>
      scannerHeadOf({ segment, scannerToken: "find" }) &&
      !boundedFindFlag.test(segment) &&
      scansANoiseRoot({ segment, scannerToken: "find" }),
    reasonFor: ({ segment }) =>
      [findReason, "", correctedFindFor({ segment })].join("\n"),
  },
  {
    matches: ({ segment }) =>
      scannerHeadOf({ segment, scannerToken: "ls" }) &&
      recursiveListFlag.test(segment) &&
      scansANoiseRoot({ segment, scannerToken: "ls" }),
    reasonFor: () => listReason,
  },
  {
    matches: ({ segment }) =>
      scannerHeadOf({ segment, scannerToken: "grep" }) &&
      recursiveGrepFlag.test(segment) &&
      scansANoiseRoot({ segment, scannerToken: "grep" }),
    reasonFor: ({ segment }) =>
      [grepReason, "", correctedGrepFor({ segment })].join("\n"),
  },
  {
    matches: ({ segment }) =>
      scannerHeadOf({ segment, scannerToken: "du" }) &&
      !boundedDiskUsageFlag.test(segment) &&
      scansANoiseRoot({ segment, scannerToken: "du" }),
    reasonFor: () => diskUsageReason,
  },
  {
    matches: ({ segment }) =>
      powershellHeadOf({ segment }) &&
      powershellRecurseFlag.test(segment) &&
      !powershellDepthFlag.test(segment) &&
      powershellPathArguments({ segment }).some((token) =>
        isNoiseRootedPath({ token }),
      ),
    reasonFor: () => powershellReason,
  },
];

const breachIn = ({ command }) =>
  shellSegmentsOf({ command })
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0)
    .flatMap((segment) =>
      scanRules
        .filter((scanRule) => scanRule.matches({ segment }))
        .map((scanRule) => scanRule.reasonFor({ segment })),
    )
    .at(0);

const main = async () => {
  const rawInput = await readStdin();
  if (rawInput.trim() === "") process.exit(0);
  const invocation = JSON.parse(rawInput);
  const toolName = invocation.tool_name;
  if (toolName !== "Bash" && toolName !== "PowerShell") process.exit(0);
  const command = invocation.tool_input?.command ?? "";
  const breach = breachIn({ command });
  if (breach !== undefined) denyCall({ reason: breach });
  process.exit(0);
};

main().catch(() => process.exit(0));
