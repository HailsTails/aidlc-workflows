import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
} from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// The wire field names (tool_name / tool_input) are the harness's, and they stop
// at the parse seam below: this internal shape is our own vocabulary, so the
// narrowed values travel as toolName / command and no snake_case leaks inward.
type HookInvocation = {
  readonly toolName: string | null;
  readonly command: string;
};

const readStdin = (): Promise<string> =>
  new Promise((resolve) => {
    let raw = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk: string) => {
      raw += chunk;
    });
    process.stdin.on("end", () => resolve(raw));
  });

const denyReason = [
  "BLOCKED: arbitrary inline code execution is intentionally not runnable autonomously here.",
  "",
  "This was stopped at the PreToolUse gate — BEFORE any permission prompt — on purpose.",
  "Arbitrary code (python/node/ruby with -c or -e, ad-hoc bash/sh scripts, heredoc- or",
  "pipe-fed interpreters) is not auto-approved, so left alone it would raise a manual",
  "permission prompt that only the operator can clear. They are often heads-down and away from this",
  "machine, so that prompt can strand this session for HOURS. Denying it here costs nothing.",
  "",
  "1. IS THIS REALLY JUST A SEARCH? Most scan / search / count / find-in-files work is a",
  "   SINGLE built-in call — Grep (text in files), Glob (filenames) or Read (one file) — all",
  "   auto-approved and instant. The recurring failure mode is reaching for `python -c` /",
  "   `node -e` / a bash script to do what one Grep does. If your honest answer when",
  "   challenged would be that it is basically a one-line grep, then it IS a Grep call.",
  "   Reading a file is Read; finding files is Glob; finding text is Grep; changing a file",
  "   is Edit or Write. Use the tool, not inline code.",
  "",
  "2. IF IT IS GENUINE COMPUTE (aggregation, transform, numeric work with no file-tool",
  "   equivalent), do not smuggle it in as novel inline code — COMMIT IT TO AN AUTHORISED",
  "   LOCATION and invoke the file there. Declared authorised prefixes are listed in",
  "   .constitution-authorised-locations/inline-exec.json (today: scripts/, .claude/tools/,",
  "   .claude/rin-gates/, .aidlc/{tools,hooks,rin-gates}/). So the pre-formed next action is:",
  "",
  "     write the script to scripts/<area>/<name>.<ext>, then invoke it by that path",
  "     (e.g. `bun scripts/<area>/<name>.ts` or `python3 scripts/<area>/<name>.py`)",
  "",
  "   Committing it there is what makes it reviewable, re-runnable and diffable — the",
  "   opposite of a throwaway one-liner. Note an allowlist entry in settings.json can NEVER",
  "   help: this is a DENY hook and it runs before permission resolution.",
  "",
  "   This authorises a LOCATION, not a FORM. `-c` / `-e` / `--eval` inline code stays denied",
  "   at EVERY path including the authorised ones, as do heredoc- and pipe-fed interpreters.",
  "   Moving inline code behind an authorised path without putting it IN A FILE is not a route",
  "   through this gate.",
  "",
  "3. There is NO self-granted bypass here, by design. If neither a built-in nor a committed",
  "   script at an authorised location fits, STOP and surface the need to the operator — say",
  "   what you need to run and why — rather than routing around this gate. Asking is cheap;",
  "   an unattended prompt is not.",
].join("\n");

const leadingEnvAssignments = /^\s*(?:[A-Za-z_][A-Za-z0-9_]*=\S*\s+)*/;

const anyHarnessProjectDirectoryPrefix = /^\$(?:CLAUDE|AIDLC)_PROJECT_DIR\//;

const allowlistedRunnerPattern = new RegExp(
  `${leadingEnvAssignments.source}(uv\\s+run|pnpm\\b|npm\\b|pnpm\\s+exec|npx\\b|python\\s+-m\\s+json\\.tool|bun\\s+(?:run\\s+|test\\b|install\\b|x\\s+)?(?:\\$(?:CLAUDE|AIDLC)_PROJECT_DIR/)?\\.(?:claude|aidlc)/(?:tools|hooks|rin-gates)/)`,
  "i",
);

const inlineEvalRule =
  /\b(python3?|node|ruby|perl|php|deno|bun|pwsh|osascript|Rscript)\b[^\n|;&]*\s-(?:c|e|p|r|E|-eval)\b/i;

const arbitraryExecutionRules = [
  /\b(python3?|node|ruby|perl|php|deno|bun|Rscript)\s+(?![-])[^\s|;&]*\.(?:py|js|mjs|cjs|ts|rb|pl|php|sh)\b/i,
  /\b(bash|sh|zsh)\s+-c\b/i,
  /\b(bash|sh|zsh)\s+(?![-])[^\s|;&]*\.sh\b/i,
  /\b(python3?|node|ruby|perl|php)\b[^\n]*<</i,
];

const pipeIntoInterpreterRule =
  /\|\s*(python3?|node|ruby|perl|php|bash|sh)\b(?!\s+-m\b)/i;

const splitTopLevelSegments = ({
  command,
}: {
  readonly command: string;
}): readonly string[] => command.split(/&&|\|\||[;&|]/);

const denyCall = ({ reason }: { readonly reason: string }): never => {
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

const hooksDirectory = dirname(fileURLToPath(import.meta.url));

const manifestRelativePath = join(
  ".constitution-authorised-locations",
  "inline-exec.json",
);

const MAX_MANIFEST_SEARCH_DEPTH = 8;

// The hook ships in two locations at different depths (plugins/rin/hooks/ and
// .claude/hooks/), and runs from worktrees as well as the primary checkout, so
// the manifest is found by walking up rather than by a fixed relative path.
const readManifestWalkingUp = ({
  directory,
  remainingDepth = MAX_MANIFEST_SEARCH_DEPTH,
}: {
  readonly directory: string;
  readonly remainingDepth?: number;
}): string | null => {
  if (remainingDepth === 0) return null;
  try {
    return readFileSync(join(directory, manifestRelativePath), "utf8");
  } catch {
    const parent = dirname(directory);
    if (parent === directory) return null;
    return readManifestWalkingUp({
      directory: parent,
      remainingDepth: remainingDepth - 1,
    });
  }
};

// The manifest is a trust boundary — a file off disk deciding what may execute —
// so every level is narrowed at runtime rather than asserted by annotation. An
// entry of any unexpected shape contributes no prefixes, which is the
// fail-closed direction.
const declaredPrefixesOf = ({
  entry,
}: {
  readonly entry: unknown;
}): readonly string[] => {
  if (typeof entry !== "object" || entry === null) return [];
  if (!("pathPrefixes" in entry)) return [];
  const { pathPrefixes } = entry;
  if (!Array.isArray(pathPrefixes)) return [];
  return pathPrefixes.filter(
    (prefix): prefix is string =>
      typeof prefix === "string" && prefix.length > 0,
  );
};

const readAuthorisedPathPrefixes = (): readonly string[] => {
  const raw = readManifestWalkingUp({ directory: hooksDirectory });
  if (raw === null) return [];
  try {
    const declared: unknown = JSON.parse(raw);
    if (!Array.isArray(declared)) return [];
    return declared.flatMap((entry: unknown) => declaredPrefixesOf({ entry }));
  } catch {
    return [];
  }
};

const scriptPathRule =
  /\b(?:python3?|node|ruby|perl|php|deno|bun|Rscript)\s+(?![-])([^\s|;&]*\.(?:py|js|mjs|cjs|ts|rb|pl|php|sh))\b/i;

const normalisedScriptPath = ({
  scriptPath,
}: {
  readonly scriptPath: string;
}): string =>
  scriptPath
    .replace(anyHarnessProjectDirectoryPrefix, "")
    .replace(/^\.\//, "")
    .replaceAll("\\", "/");

// A prefix match alone is defeated by `scripts/../../outside/evil.py`, so the
// path must still sit inside the authorised root.
//
// Decided on the NORMALISED SEGMENTS rather than via node:path resolve: this
// hook runs on a Windows-primary machine and on the Pi, and resolve is
// separator- and drive-dependent, which would make the containment predicate
// platform-contingent. Walking segments keeps one behaviour everywhere, and is
// the same predicate the codex/opencode projections express.
// `..` is NORMALISED AWAY FIRST, then the resolved path is compared against the
// prefix. A net depth count is not sufficient and was a real bypass: for prefix
// `scripts/`, the path `scripts/../outside/evil.py` ends at depth 2 with its
// first segment still reading `scripts`, so a net count judged it contained
// while it in fact resolves outside the root. Resolving first means the
// comparison is over where the path actually lands, not how far it travelled.
const resolveSegments = ({
  scriptPath,
}: {
  readonly scriptPath: string;
}): readonly string[] =>
  scriptPath
    .split("/")
    .filter((segment) => segment !== "" && segment !== ".")
    .reduce<readonly string[]>(
      (resolved, segment) =>
        segment === ".." ? resolved.slice(0, -1) : resolved.concat(segment),
      [],
    );

const escapesAuthorisedRoot = ({
  scriptPath,
  prefix,
}: {
  readonly scriptPath: string;
  readonly prefix: string;
}): boolean => {
  const prefixSegments = prefix.split("/").filter(Boolean);
  const resolved = resolveSegments({ scriptPath });
  if (resolved.length <= prefixSegments.length) return true;
  return (
    resolved.slice(0, prefixSegments.length).join("/") !==
    prefixSegments.join("/")
  );
};

const segmentTargetsAuthorisedLocation = ({
  segment,
}: {
  readonly segment: string;
}): boolean => {
  const match = scriptPathRule.exec(segment);
  if (match === null) return false;
  const captured = match[1];
  if (captured === undefined) return false;
  const scriptPath = normalisedScriptPath({ scriptPath: captured });
  // BOTH tests are load-bearing and neither is redundant. startsWith runs on the
  // normalised LITERAL; escapesAuthorisedRoot runs on the RESOLVED segments.
  // Dropping startsWith would admit a leading traversal: ../scripts/evil.py
  // resolves to scripts/evil.py and would read as contained, while it names a
  // sibling of the repository root. Dropping the resolve check would admit
  // scripts/../outside/evil.py, which was a real shipped bypass.
  return readAuthorisedPathPrefixes().some(
    (prefix) =>
      scriptPath.startsWith(prefix) &&
      !escapesAuthorisedRoot({ scriptPath, prefix }),
  );
};

const segmentIsArbitraryExecution = ({
  segment,
}: {
  readonly segment: string;
}): boolean => {
  if (inlineEvalRule.test(segment)) return true;
  if (allowlistedRunnerPattern.test(segment)) return false;
  if (segmentTargetsAuthorisedLocation({ segment })) return false;
  return arbitraryExecutionRules.some((executionRule) =>
    executionRule.test(segment),
  );
};

// Guard-relaxation trial (record 260904-guard-relaxation-trial-2). Deliberately
// INLINED rather than imported from guard-trial.ts: this hook must run when
// spawned as a standalone copy at an arbitrary path (mutant-detection.test.ts
// asserts exactly that), and a relative import cannot resolve from a temp dir.
// guard-navigation.mjs carries the same logic for the same reason. The shared
// module remains the tested specification of these semantics, and
// guard-trial-scope.test.ts holds every copy to the same safety property.
//
// The token names guards individually and this hook answers only to its own
// name, so no value of it reaches a safety-critical guard. Fails closed: the
// relax set starts empty and admits only a recognised name.
const RELAX_TOKEN_VARIABLE = "RIN_GUARD_TRIAL";
const THIS_GUARD_RELAX_NAME = "relax-inline-exec";

const thisGuardIsRelaxed = (): boolean =>
  (process.env[RELAX_TOKEN_VARIABLE] ?? "")
    .split(",")
    .map((candidate) => candidate.trim())
    .includes(THIS_GUARD_RELAX_NAME);

// Resolves the log OUTSIDE the composed tree. The previous fallback rooted at
// process.cwd(), and a hook spawned from `.claude/hooks/` has THAT as its cwd,
// so the log landed at `.claude/hooks/.claude/guard-trial-shadow.jsonl` inside
// the projected plugin -- harness:refresh-check then saw a composed copy
// diverging from its source and refused pushes repo-wide. The git common dir is
// untracked by construction and is shared by every worktree, so the trial's
// corpus stays in ONE file. Mirrors guard-trial.ts; see the note there.
const primaryGitDirectoryFrom = (
  startDirectory: string,
): string | undefined => {
  const gitPath = join(startDirectory, ".git");
  if (!existsSync(gitPath)) {
    const parent = dirname(startDirectory);
    return parent === startDirectory
      ? undefined
      : primaryGitDirectoryFrom(parent);
  }
  if (statSync(gitPath).isDirectory()) return gitPath;
  const pointer = readFileSync(gitPath, "utf8").match(/^gitdir:\s*(.+?)\s*$/m);
  const pointerTarget = pointer?.[1];
  if (pointerTarget === undefined) return undefined;
  const worktreeGitDir = isAbsolute(pointerTarget)
    ? pointerTarget
    : resolve(startDirectory, pointerTarget);
  const commonDirPointer = join(worktreeGitDir, "commondir");
  if (!existsSync(commonDirPointer)) return worktreeGitDir;
  const commonDir = readFileSync(commonDirPointer, "utf8").trim();
  if (commonDir === "") return worktreeGitDir;
  return isAbsolute(commonDir) ? commonDir : resolve(worktreeGitDir, commonDir);
};

const shadowLogPath = (): string => {
  const configured = process.env["RIN_GUARD_TRIAL_LOG"];
  if (configured !== undefined && configured.trim() !== "") return configured;
  const startDirectory = process.env["CLAUDE_PROJECT_DIR"] ?? process.cwd();
  const gitDirectory = primaryGitDirectoryFrom(startDirectory);
  if (gitDirectory !== undefined)
    return join(gitDirectory, "rin-guard-trial-shadow.jsonl");
  return join(startDirectory, ".claude", "guard-trial-shadow.jsonl");
};

// Written on the SAME branch the deny would have taken, so the shadow set is
// exactly what the patterns matched. A log failure never fails the command.
const recordDenyShadow = ({
  rule,
  command,
}: {
  readonly rule: string;
  readonly command: string;
}): void => {
  const entry = {
    at: new Date().toISOString(),
    guard: THIS_GUARD_RELAX_NAME,
    rule,
    command,
    cwd: process.env["CLAUDE_PROJECT_DIR"] ?? process.cwd(),
    session: process.env["CLAUDE_SESSION_ID"] ?? "unknown",
  };
  const path = shadowLogPath();
  try {
    mkdirSync(dirname(path), { recursive: true });
    appendFileSync(path, `${JSON.stringify(entry)}\n`, "utf8");
  } catch {
    // An unwritable log must not turn an allowed command into a failure.
  }
};

// Names the rule that fired, preserving the original evaluation order exactly:
// the pipe rule first, then per-segment arbitrary execution. Returning a name
// rather than a boolean is what lets the trial's deny-shadow line say WHICH
// pattern matched, so the analysis can distinguish an inline-eval breach from a
// pipe-fed one instead of counting them as one undifferentiated total.
const breachedRuleOf = ({
  command,
}: {
  readonly command: string;
}): string | null => {
  if (pipeIntoInterpreterRule.test(command)) return "pipe-into-interpreter";
  const arbitraryInAnySegment = splitTopLevelSegments({ command }).some(
    (segment) => segmentIsArbitraryExecution({ segment }),
  );
  return arbitraryInAnySegment ? "arbitrary-execution" : null;
};

// Stdin is a trust boundary for the same reason the manifest is — an untyped
// payload deciding what may execute — so it is narrowed at runtime rather than
// asserted by annotation. An unexpected shape yields an empty invocation, which
// exits without blocking: the pre-manifest behaviour, and the fail-closed
// direction for a hook whose deny is the exceptional path.
const commandOf = ({ parsed }: { readonly parsed: object }): string | null => {
  if (!("tool_input" in parsed)) return null;
  const { tool_input: toolInput } = parsed;
  if (typeof toolInput !== "object" || toolInput === null) return null;
  if (!("command" in toolInput)) return null;
  const { command } = toolInput;
  return typeof command === "string" ? command : null;
};

const emptyInvocation: HookInvocation = { toolName: null, command: "" };

const invocationOf = ({
  parsed,
}: {
  readonly parsed: unknown;
}): HookInvocation => {
  if (typeof parsed !== "object" || parsed === null) return emptyInvocation;
  const toolName =
    "tool_name" in parsed && typeof parsed.tool_name === "string"
      ? parsed.tool_name
      : null;
  return { toolName, command: commandOf({ parsed }) ?? "" };
};

const main = async (): Promise<void> => {
  const rawInput = await readStdin();
  if (rawInput.trim() === "") process.exit(0);

  let invocation: HookInvocation;
  try {
    invocation = invocationOf({ parsed: JSON.parse(rawInput) });
  } catch {
    process.exit(0);
  }

  if (invocation.toolName !== "Bash") process.exit(0);
  const { command } = invocation;
  const breachRule = breachedRuleOf({ command });
  if (breachRule === null) process.exit(0);
  // The relax branch IS the deny branch: a line is written exactly where the
  // deny would have fired, so the measured set cannot drift from the patterns.
  if (thisGuardIsRelaxed()) {
    recordDenyShadow({ rule: breachRule, command });
    process.exit(0);
  }
  denyCall({ reason: denyReason });
};

main().catch(() => process.exit(0));
