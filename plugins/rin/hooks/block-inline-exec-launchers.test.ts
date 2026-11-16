import { describe, expect, test } from "vitest";
import { configRunnerAllowlist, defaultConfig } from "../tools/rin-harness-config.ts";
import { defaultPathOperations } from "../tools/rin-harness-path-operations.ts";
import { defaultFileTextPort } from "../tools/rin-harness-sidecar-file-reader.ts";
import { INLINE_EXEC_HOOK, installInlineExecHook } from "./inline-exec-hook-layout.ts";
import { invokeBashHook, permissionDecisionFrom } from "./run-hook-process.ts";

const paths = defaultPathOperations();
const files = defaultFileTextPort();

const repositoryRoot = paths.resolve({
  segments: [paths.dirname({ path: paths.fromFileUrl({ url: import.meta.url }) }), "..", "..", ".."],
});

const LAUNCHER_REASON_MARKER = "fetch-and-run package launchers";

const FETCH_AND_RUN_LAUNCHES = [
  "npx tsx x.ts",
  "npx prettier .",
  "npx -y pkg",
  "npx --yes pkg@latest",
  "npx -p pkg cmd",
  "npx tsx -e 1",
  "npx ts-node scripts/throwaway.ts",
  "npx .claude/tools/launcher.ts node throwaway.js",
  "pnpx pkg",
  "bunx pkg",
  "bunx tsx x.ts",
  "bunx --bun pkg",
  "bun x pkg",
  "bun x tsx x.ts",
  "bun x foo.ts",
  "bun x .claude/tools/launcher.ts node throwaway.js",
  "bun x $AIDLC_PROJECT_DIR/.aidlc/tools/launcher.ts node throwaway.js",
  "bun create vite app",
  "pnpm dlx pkg",
  "pnpm --silent dlx pkg",
  "pnpm create vite",
  "yarn dlx pkg",
  "yarn create vite",
  "corepack pnpm dlx pkg",
  "corepack yarn dlx pkg",
  "npm exec pkg",
  "npm exec ts-node scripts/throwaway.ts",
  "npm exec --yes pkg",
  "npm exec --no --yes pkg",
  "npm exec -- pkg --no",
  "npm x pkg",
  "npm create vite",
  "npm init vite",
  "npm exec --no pkg --yes",
  "npm exec --no vitest -y",
  "uvx ruff check",
  "uv tool run ruff check",
  "pipx run black .",
  'echo "$(npx pkg)"',
  'git commit -m "$(npx pkg)"',
  "cat <<EOF\n$(npx pkg)\nEOF",
  "cat <<'EOF'\nplain text\nEOF\nnpx pkg",
  "FOO='a b' npx pkg",
  'FOO="a b" bunx pkg',
  "sudo -u ci npx pkg",
  "env -u FOO npx pkg",
  "timeout 60 npx pkg",
  "timeout -s KILL 60 bunx pkg",
  "nice npx pkg",
  "nice -n 5 npx pkg",
  "nice -5 npx pkg",
  "xargs -n 1 npx pkg",
  "eval npx pkg",
  'eval "npx pkg"',
  "command npx pkg",
] as const;

const LAUNCHER_WORDS_AS_DATA = [
  'git commit -m "a; npx b"',
  'git commit -m "first line\nnpx is no longer approved\n(npx b) neither"',
  "git commit -m \"$(cat <<'EOF'\nfix(rin): deny launchers\n\nnpx foo is denied\n(npx bar) too\nEOF\n)\"",
  'git commit -m "fix: deny launchers (npx and bunx)"',
  'gh pr create --title "stop approving npx" --body "The gate (npx included) now denies."',
  'gh issue create --title "launchers" --body "Steps:\nnpx foo\nthen bunx bar"',
  'echo "use; npx here"',
  "rg 'foo|npx x' src",
  "jq '.scripts | to_entries[] | select(.value | test(\"npx\"))' package.json",
  "printf 'a\\n' && printf \"%s\" \"(npx foo)\"",
  "cat <<'EOF' > docs/x.md\nRun npx foo to see the old way.\nnpx bar\nEOF",
  "echo '$(npx pkg)'",
  `echo \${HOME}/npx`,
  "git log --grep npx # npx in a comment; bunx too",
] as const;

const SUBCOMMAND_LOOKALIKES = [
  "pnpm test dlx",
  "pnpm run build -- dlx",
  "pnpm --filter dlx build",
  "pnpm add -D dlx",
  "yarn add dlx",
  "command -v npx",
  "command -V bunx",
] as const;

const WRAPPED_FORMS = [
  { form: "behind an env assignment", wrap: (launch: string) => `FOO=bar ${launch}` },
  { form: "after cd and &&", wrap: (launch: string) => `cd dir && ${launch}` },
  { form: "after a semicolon", wrap: (launch: string) => `git status; ${launch}` },
  { form: "after ||", wrap: (launch: string) => `false || ${launch}` },
  { form: "in a pipeline", wrap: (launch: string) => `echo y | ${launch}` },
  { form: "inside a command substitution", wrap: (launch: string) => `echo $(${launch})` },
  { form: "inside backticks", wrap: (launch: string) => `echo \`${launch}\`` },
  { form: "inside a subshell", wrap: (launch: string) => `(${launch})` },
  { form: "on a new line", wrap: (launch: string) => `git status\n${launch}` },
  { form: "behind env", wrap: (launch: string) => `env FOO=bar ${launch}` },
  { form: "behind sudo", wrap: (launch: string) => `sudo ${launch}` },
  { form: "behind xargs", wrap: (launch: string) => `ls | xargs ${launch}` },
  { form: "behind cmd /c", wrap: (launch: string) => `cmd /c ${launch}` },
  { form: "in upper case", wrap: (launch: string) => launch.toUpperCase() },
] as const;

const LAUNCHER_HEADS = [
  { head: "npx", tail: "pkg" },
  { head: "bunx", tail: "pkg" },
  { head: "bun x", tail: "pkg" },
  { head: "pnpm dlx", tail: "pkg" },
  { head: "yarn dlx", tail: "pkg" },
  { head: "pnpx", tail: "pkg" },
] as const;

const SPELLED_EXECUTABLES = [
  "/usr/bin/npx pkg",
  "/usr/local/bin/bunx pkg",
  "C:\\Program\\nodejs\\npx.cmd pkg",
  "npx.exe pkg",
  "bunx.cmd pkg",
  "pnpm.cmd dlx pkg",
  "bun.exe x pkg",
  '"npx" pkg',
  "'bunx' pkg",
  '"C:\\Program Files\\nodejs\\npx.cmd" pkg',
  "NPX pkg",
  "Bun X pkg",
] as const;

const IN_REPOSITORY_TOOLING = [
  "pnpm exec vitest run",
  "pnpm exec tsx scripts/audit-constitution.ts",
  "pnpm install",
  "pnpm run build",
  "pnpm test",
  "npm run build",
  "npm test",
  "npm install",
  "npm init",
  "npm init -y",
  "npm exec --no -- vitest run",
  "npm exec --no vitest run",
  "npm exec --yes=false -- vitest run",
  "npm x --no -- vitest run",
  "bun run typecheck",
  "bun run test:rin",
  "bun test",
  "bun install --frozen-lockfile",
  "yarn build",
  "yarn install",
  "uv run pytest",
  "python -m json.tool data.json",
  "git commit -m \"stop approving npx\"",
  "rg bunx core",
] as const;

const RETAINED_SCRIPT_RUNNERS = ["uv run", "pnpm", "pnpm exec", "npm", "python -m json.tool"] as const;

const THROWAWAY_TAIL = "ts-node scripts/throwaway.ts";
const HARNESS_TOOL_TAIL = ".claude/tools/launcher.ts node throwaway.js";

const hookOutcomeFor = async ({ command }: { readonly command: string }) => {
  const outcome = await invokeBashHook({
    hookFileName: INLINE_EXEC_HOOK,
    command,
    runtime: "bun",
  });
  return permissionDecisionFrom({ stdout: outcome.stdout }).hookSpecificOutput;
};

const decisionFor = async ({ command }: { readonly command: string }) =>
  (await hookOutcomeFor({ command }))?.permissionDecision;

const launcherDenialFor = async ({ command }: { readonly command: string }) => {
  const outcome = await hookOutcomeFor({ command });
  return {
    decision: outcome?.permissionDecision,
    namesLaunchers: outcome?.permissionDecisionReason?.includes(LAUNCHER_REASON_MARKER) ?? false,
  };
};

describe("block-inline-exec denies fetch-and-run launchers", () => {
  test.each(FETCH_AND_RUN_LAUNCHES)("denies %s with the launcher reason", async (command) => {
    expect(await launcherDenialFor({ command })).toStrictEqual({ decision: "deny", namesLaunchers: true });
  });

  test.each(SPELLED_EXECUTABLES)("denies the launcher spelled %s", async (command) => {
    expect(await launcherDenialFor({ command })).toStrictEqual({ decision: "deny", namesLaunchers: true });
  });

  test.each(
    WRAPPED_FORMS.flatMap(({ form, wrap }) =>
      LAUNCHER_HEADS.map(({ head, tail }) => ({ form, command: wrap(`${head} ${tail}`) })),
    ),
  )("denies $command ($form)", async ({ command }) => {
    expect(await launcherDenialFor({ command })).toStrictEqual({ decision: "deny", namesLaunchers: true });
  });
});

describe("block-inline-exec keeps in-repository tooling runnable", () => {
  test.each(IN_REPOSITORY_TOOLING)("passes %s", async (command) => {
    expect(await decisionFor({ command })).toBeUndefined();
  });

  test.each(RETAINED_SCRIPT_RUNNERS)("passes %s running a script", async (runner) => {
    expect(await decisionFor({ command: `${runner} ${THROWAWAY_TAIL}` })).toBeUndefined();
  });

  test.each([
    "bun .claude/tools/launcher.ts node throwaway.js",
    "bun run .claude/tools/launcher.ts node throwaway.js",
    "bun $CLAUDE_PROJECT_DIR/.claude/tools/launcher.ts node throwaway.js",
    "bun .aidlc/rin-gates/launcher.ts node throwaway.js",
  ])("passes the bun harness-tool runner form %s", async (command) => {
    expect(await decisionFor({ command })).toBeUndefined();
  });
});

describe("block-inline-exec judges only what the shell would run as a command", () => {
  test.each(LAUNCHER_WORDS_AS_DATA)("passes %s", async (command) => {
    expect(await decisionFor({ command })).toBeUndefined();
  });

  test.each(SUBCOMMAND_LOOKALIKES)("passes %s", async (command) => {
    expect(await decisionFor({ command })).toBeUndefined();
  });
});

describe("the launcher rule cannot be lifted by an authorised location", () => {
  const decisionInAuthorisedProject = async ({ command }: { readonly command: string }) => {
    const projectDirectory = files.makeTemporaryDirectory(
      paths.join({ segments: [files.temporaryRoot(), "inline-exec-launcher-authorised-"] }),
    );
    try {
      const manifestDirectory = paths.join({ segments: [projectDirectory, ".constitution-authorised-locations"] });
      files.mkdir(manifestDirectory, { recursive: true });
      files.write(
        paths.join({ segments: [manifestDirectory, "inline-exec.json"] }),
        JSON.stringify([{ pathPrefixes: ["scripts/"] }]),
      );
      const hookPath = installInlineExecHook({
        harnessDirectory: paths.join({ segments: [projectDirectory, ".claude"] }),
      });
      const outcome = await invokeBashHook({
        hookFileName: INLINE_EXEC_HOOK,
        hookPath,
        command,
        runtime: "bun",
      });
      return permissionDecisionFrom({ stdout: outcome.stdout }).hookSpecificOutput?.permissionDecision;
    } finally {
      files.remove(projectDirectory, { recursive: true, force: true });
    }
  };

  test.each([
    { command: "node scripts/tasks/migrate.mjs", expected: undefined },
    { command: "python3 scripts/tasks/migrate.py", expected: undefined },
    { command: "npx node scripts/tasks/migrate.mjs", expected: "deny" },
    { command: "bunx bun scripts/tasks/migrate.ts", expected: "deny" },
    { command: "pnpm dlx python3 scripts/tasks/migrate.py", expected: "deny" },
  ])("in a project authorising scripts/, $command is decided $expected", async ({ command, expected }) => {
    expect(await decisionInAuthorisedProject({ command })).toBe(expected);
  });
});

describe("the runner allowlist agrees with the gate on launchers", () => {
  test.each([
    { source: "the default configuration", allowlist: defaultConfig.packageManager.runnerAllowlist },
    { source: "the repository configuration", allowlist: configRunnerAllowlist({ projectDir: repositoryRoot }) },
  ])("$source lists no runner the gate denies as a launcher", async ({ allowlist }) => {
    const verdicts = await Promise.all(
      allowlist.map(async (runner) => ({
        runner,
        namesLaunchers: (await launcherDenialFor({ command: `${runner} pkg` })).namesLaunchers,
      })),
    );
    expect(verdicts.filter(({ namesLaunchers }) => namesLaunchers).map(({ runner }) => runner)).toStrictEqual([]);
  });

  test("the repository configuration lists the same runners as the default", () => {
    expect(configRunnerAllowlist({ projectDir: repositoryRoot })).toStrictEqual(
      defaultConfig.packageManager.runnerAllowlist,
    );
  });

  test.each(
    RETAINED_SCRIPT_RUNNERS.filter((runner) => defaultConfig.packageManager.runnerAllowlist.includes(runner)),
  )("the gate approves the configured runner %s", async (runner) => {
    expect(await decisionFor({ command: `${runner} ${HARNESS_TOOL_TAIL}` })).toBeUndefined();
  });
});
