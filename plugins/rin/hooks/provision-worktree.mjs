import { execSync } from "node:child_process";
import {
  existsSync,
  globSync,
  lstatSync,
  readdirSync,
  symlinkSync,
} from "node:fs";
import { basename, join } from "node:path";
import { pathToFileURL } from "node:url";

const readStdin = () =>
  new Promise((resolve) => {
    let raw = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      raw += chunk;
    });
    process.stdin.on("end", () => resolve(raw));
  });

const firstNonEmptyString = ({ candidates }) =>
  candidates.find(
    (candidate) => typeof candidate === "string" && candidate.length > 0,
  );

const sessionDirectoryFrom = ({ payload, fallbackDirectory }) => {
  try {
    const invocation = JSON.parse(payload);
    const fromPayload = firstNonEmptyString({
      candidates: [invocation?.tool_input?.path, invocation?.cwd],
    });
    if (fromPayload !== undefined) {
      return fromPayload;
    }
  } catch {
    return fallbackDirectory;
  }
  return fallbackDirectory;
};

const isWorktreeRoot = ({ directory }) => {
  try {
    return lstatSync(join(directory, ".git")).isFile();
  } catch {
    return false;
  }
};

const SQLITE_BINDING_GLOB = join(
  "node_modules",
  ".pnpm",
  "better-sqlite3@*",
  "node_modules",
  "better-sqlite3",
  "build",
  "Release",
  "better_sqlite3.node",
);

const hasSqliteBinding = ({ sessionDirectory }) =>
  globSync(SQLITE_BINDING_GLOB, { cwd: sessionDirectory }).length > 0;

const needsProvisioning = ({ sessionDirectory }) =>
  !existsSync(join(sessionDirectory, "node_modules")) ||
  !hasSqliteBinding({ sessionDirectory });

const PROVISION_COMMAND = "pnpm install --frozen-lockfile --prefer-offline";

const IDENTITY_COMMAND =
  "node infra/github-apps/configure-worktree-identity.mjs";

const IDENTITY_GUIDANCE = "pnpm gh:adopt-git";

const PROVISION_TIMEOUT_MS = 600000;

const STDERR_VISIBLE_EXIT_CODE = 2;

const adoptBotGitIdentity = ({ sessionDirectory }) => {
  try {
    execSync(IDENTITY_COMMAND, {
      cwd: sessionDirectory,
      stdio: "inherit",
      timeout: PROVISION_TIMEOUT_MS,
    });
    return { adopted: "ok" };
  } catch (cause) {
    process.stderr.write(
      `Could not adopt the rin-author git identity; run \`${IDENTITY_GUIDANCE}\` manually. ${cause instanceof Error ? cause.message : String(cause)}\n`,
    );
    return { adopted: "failed" };
  }
};

const provisionDependencies = ({ sessionDirectory }) => {
  process.stderr.write(
    `Provisioning worktree dependencies: ${PROVISION_COMMAND}\n`,
  );
  try {
    execSync(PROVISION_COMMAND, {
      cwd: sessionDirectory,
      stdio: "inherit",
      timeout: PROVISION_TIMEOUT_MS,
    });
    process.stderr.write(
      "Worktree provisioned: lefthook and toolchain are now available.\n",
    );
    return { provisioned: "ok" };
  } catch (cause) {
    process.stderr.write(
      `Worktree provisioning failed; run \`${PROVISION_COMMAND}\` manually. ${cause instanceof Error ? cause.message : String(cause)}\n`,
    );
    return { provisioned: "failed" };
  }
};

// The constitution gate spawns `bun rin-harness-constitution-audit.ts` on every gate
// `report`, with a bounded timeout. A fresh worktree's FIRST such spawn pays bun's
// cold transpile cost (the CD-enforcement import chain) on top of the audit runtime,
// which can exceed the gate's window and false-deny the first live gate `report`.
// Pay that cost HERE instead — at provision time, under the 600s budget — with one
// dry `--help`-shaped run that warms bun's cache. Best-effort: the gate hook retries
// on a cold-start timeout regardless, so a warm-up failure never blocks provisioning.
const WARM_AUDIT_COMMAND =
  "bun .claude/tools/rin-harness-constitution-audit.ts --project-dir . --json";
const WARM_AUDIT_TIMEOUT_MS = 180000;

const warmConstitutionGateSpawn = ({ sessionDirectory }) => {
  const auditPath = join(
    sessionDirectory,
    ".claude",
    "tools",
    "rin-harness-constitution-audit.ts",
  );
  if (!existsSync(auditPath)) return { warmed: "absent" };
  try {
    execSync(WARM_AUDIT_COMMAND, {
      cwd: sessionDirectory,
      stdio: "ignore",
      timeout: WARM_AUDIT_TIMEOUT_MS,
    });
    return { warmed: "ok" };
  } catch {
    // The gate hook's cold-start retry is the safety net; never block provisioning.
    return { warmed: "skipped" };
  }
};

const CANONICAL_CODEKB_REPO = "rin";

const AIDLC_SPACES_DIRECTORY = join("aidlc", "spaces");

// AIDLC's codekb keys by basename(projectDir) (aidlc-lib.ts codekbRepoName), so a
// worktree resolves codekb/<worktree-name>/ while the committed canonical content
// lives at codekb/rin/. Until upstream AIDLC ships worktree support, alias the
// worktree's expected name onto the canonical dir; the alias is gitignored.
const aliasCodekbForWorktree = ({ sessionDirectory }) => {
  const worktreeName = basename(sessionDirectory);
  if (worktreeName === CANONICAL_CODEKB_REPO)
    return { codekbAlias: "canonical" };
  const spacesRoot = join(sessionDirectory, AIDLC_SPACES_DIRECTORY);
  if (!existsSync(spacesRoot)) return { codekbAlias: "no-workspace" };
  for (const space of readdirSync(spacesRoot)) {
    const canonicalDirectory = join(
      spacesRoot,
      space,
      "codekb",
      CANONICAL_CODEKB_REPO,
    );
    const aliasDirectory = join(spacesRoot, space, "codekb", worktreeName);
    if (!existsSync(canonicalDirectory) || existsSync(aliasDirectory)) continue;
    try {
      symlinkSync(canonicalDirectory, aliasDirectory, "junction");
    } catch (cause) {
      process.stderr.write(
        `Could not alias codekb/${worktreeName} onto codekb/${CANONICAL_CODEKB_REPO}: ${cause instanceof Error ? cause.message : String(cause)}\n`,
      );
      return { codekbAlias: "failed" };
    }
  }
  return { codekbAlias: "ok" };
};

// `<record>/runtime-graph.json` is gitignored derived state, so it never rides
// into a new worktree — every consumer that reads it (the §13 learnings ritual,
// aidlc-runtime summary, replay, outcomes-pack) fails closed until something
// compiles it. For a NEW intent that something is rin-gates-runtime-compile.ts,
// which fires on the promote wrapper. For a worktree cut to RESUME an existing
// intent no birth happens at all, so nothing compiles it until the next engine
// transition — and the first gate run's §13 ritual wants it before that. §13 is
// advisory, so the loss is silent. Close that window here.
//
// Only when the active-intent cursor ALREADY resolves an intent. The cursor is
// itself gitignored, so a genuinely fresh worktree usually has none — and the
// engine is explicit that with more than one record and no cursor the intent is
// unguessable ("a path helper cannot guess which intent the caller meant",
// aidlc-lib activeIntent). Provisioning does not guess: no cursor means no
// compile, and the graph arrives when the session selects an intent or the next
// transition fires. Compiling is a pure regeneration from committed state
// (aidlc-state.md + audit shards), never a hand-mint.
//
// Best-effort by design: the graph is derived and all its consumers are
// advisory, so a failure here must never block provisioning a worktree.
const COMPILE_RUNTIME_GRAPH_COMMAND =
  "bun .claude/tools/aidlc-runtime.ts compile";

const COMPILE_RUNTIME_GRAPH_TIMEOUT_MS = 120000;

const AIDLC_RUNTIME_TOOL = join(".claude", "tools", "aidlc-runtime.ts");

const ACTIVE_INTENT_CURSOR = join(
  AIDLC_SPACES_DIRECTORY,
  "default",
  "intents",
  "active-intent",
);

const compileRuntimeGraph = ({ sessionDirectory }) => {
  if (!existsSync(join(sessionDirectory, AIDLC_RUNTIME_TOOL)))
    return { runtimeGraph: "absent" };
  if (!existsSync(join(sessionDirectory, ACTIVE_INTENT_CURSOR)))
    return { runtimeGraph: "no-active-intent" };
  try {
    execSync(COMPILE_RUNTIME_GRAPH_COMMAND, {
      cwd: sessionDirectory,
      stdio: "ignore",
      timeout: COMPILE_RUNTIME_GRAPH_TIMEOUT_MS,
    });
    return { runtimeGraph: "ok" };
  } catch {
    return { runtimeGraph: "skipped" };
  }
};

const main = async () => {
  const payload = await readStdin();
  const sessionDirectory = sessionDirectoryFrom({
    payload,
    fallbackDirectory: process.cwd(),
  });
  if (!isWorktreeRoot({ directory: sessionDirectory })) process.exit(0);
  const identityOutcome = adoptBotGitIdentity({ sessionDirectory });
  const provisionOutcome = needsProvisioning({ sessionDirectory })
    ? provisionDependencies({ sessionDirectory })
    : { provisioned: "skipped" };
  aliasCodekbForWorktree({ sessionDirectory });
  compileRuntimeGraph({ sessionDirectory });
  warmConstitutionGateSpawn({ sessionDirectory });
  const surfaced =
    identityOutcome.adopted === "failed" ||
    provisionOutcome.provisioned === "failed";
  process.exit(surfaced ? STDERR_VISIBLE_EXIT_CODE : 0);
};

const invokedScriptPath = process.argv[1];
const isDirectInvocation =
  invokedScriptPath !== undefined &&
  import.meta.url === pathToFileURL(invokedScriptPath).href;

if (isDirectInvocation) {
  main().catch(() => process.exit(0));
}

export {
  compileRuntimeGraph,
  isWorktreeRoot,
  needsProvisioning,
  sessionDirectoryFrom,
};
