import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { resolveCommitterIdentity } from "./rin-harness-identity.ts";

type GitRun = {
  readonly ok: boolean;
  readonly stdout: string;
  readonly stderr: string;
};

const runGit = ({
  projectDir,
  args,
}: {
  readonly projectDir: string;
  readonly args: readonly string[];
}): GitRun => {
  const result = spawnSync("git", args, {
    cwd: projectDir,
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.error)
    return { ok: false, stdout: "", stderr: String(result.error) };
  return {
    ok: result.status === 0,
    stdout: (result.stdout ?? "").trim(),
    stderr:
      (result.stdout ?? "").length === 0 ? (result.stderr ?? "").trim() : "",
  };
};

const isGitAvailable = ({
  projectDir,
}: {
  readonly projectDir: string;
}): boolean => runGit({ projectDir, args: ["--version"] }).ok;

const isRepo = ({ projectDir }: { readonly projectDir: string }): boolean =>
  existsSync(join(projectDir, ".git"));

const initResult = {
  alreadyRepo: "already-repo",
  initialised: "initialised",
  gitUnavailable: "git-unavailable",
  failed: "failed",
} as const;

type InitOutcome = (typeof initResult)[keyof typeof initResult];

const ensureWorkspaceGit = ({
  projectDir,
}: {
  readonly projectDir: string;
}): InitOutcome => {
  if (isRepo({ projectDir })) return initResult.alreadyRepo;
  if (!isGitAvailable({ projectDir })) return initResult.gitUnavailable;

  const init = runGit({ projectDir, args: ["init", "-q"] });
  if (!init.ok) return initResult.failed;

  const committer = resolveCommitterIdentity({ projectDir });
  runGit({ projectDir, args: ["symbolic-ref", "HEAD", "refs/heads/main"] });
  runGit({ projectDir, args: ["config", "user.email", committer.email] });
  runGit({ projectDir, args: ["config", "user.name", committer.name] });
  runGit({ projectDir, args: ["config", "commit.gpgsign", "false"] });

  const add = runGit({ projectDir, args: ["add", "-A"] });
  if (!add.ok) return initResult.failed;

  const commit = runGit({
    projectDir,
    args: [
      "commit",
      "--no-verify",
      "-q",
      "-m",
      "chore(aidlc): initialise workspace baseline for CD-46 decay + gate-run provenance",
    ],
  });
  if (!commit.ok) return initResult.failed;

  return initResult.initialised;
};

const headSha = ({
  projectDir,
}: {
  readonly projectDir: string;
}): string | null => {
  const rev = runGit({ projectDir, args: ["rev-parse", "--short", "HEAD"] });
  return rev.ok && rev.stdout.length > 0 ? rev.stdout : null;
};

const currentBranch = ({
  projectDir,
}: {
  readonly projectDir: string;
}): string | null => {
  const branch = runGit({
    projectDir,
    args: ["rev-parse", "--abbrev-ref", "HEAD"],
  });
  return branch.ok && branch.stdout.length > 0 ? branch.stdout : null;
};

const untrackedContentDigest = ({
  projectDir,
  untrackedNames,
}: {
  readonly projectDir: string;
  readonly untrackedNames: string;
}): string => {
  const paths = untrackedNames
    .split("\n")
    .filter((line) => line.length > 0)
    .sort();
  return paths.reduce((accumulated, relativePath) => {
    const contentHash = (() => {
      const attempt = ((): Buffer => {
        const full = join(projectDir, relativePath);
        return existsSync(full) ? readFileSync(full) : Buffer.alloc(0);
      })();
      return createHash("sha256").update(attempt).digest("hex");
    })();
    return `${accumulated}\n${relativePath}\0${contentHash}`;
  }, "");
};

const DIRTY_DIGEST_LENGTH = 16;

const workingTreeDigest = ({
  projectDir,
  head,
}: {
  readonly projectDir: string;
  readonly head: string;
}): string => {
  const trackedDiff = runGit({ projectDir, args: ["diff", "HEAD"] }).stdout;
  const untrackedNames = runGit({
    projectDir,
    args: ["ls-files", "--others", "--exclude-standard"],
  }).stdout;
  const untrackedContent = untrackedContentDigest({
    projectDir,
    untrackedNames,
  });
  return createHash("sha256")
    .update(`${head}\n${trackedDiff}\n${untrackedContent}`)
    .digest("hex")
    .slice(0, DIRTY_DIGEST_LENGTH);
};

type GitBasis = {
  readonly gitAvailable: boolean;
  readonly headSha: string | null;
  readonly branch: string | null;
  readonly dirtyFiles: readonly string[];
  readonly dirtyDigest: string | null;
};

const gitBasis = ({
  projectDir,
}: {
  readonly projectDir: string;
}): GitBasis => {
  if (!isRepo({ projectDir })) {
    return {
      gitAvailable: false,
      headSha: null,
      branch: null,
      dirtyFiles: [],
      dirtyDigest: null,
    };
  }
  const head = headSha({ projectDir });
  const porcelain = runGit({
    projectDir,
    args: ["status", "--porcelain"],
  }).stdout;
  const dirtyFiles = porcelain
    .split("\n")
    .map((line) => line.slice(3).trim())
    .filter((line) => line.length > 0);
  return {
    gitAvailable: true,
    headSha: head,
    branch: currentBranch({ projectDir }),
    dirtyFiles,
    dirtyDigest: head ? workingTreeDigest({ projectDir, head }) : null,
  };
};

export type { GitBasis, InitOutcome };
export {
  currentBranch,
  ensureWorkspaceGit,
  gitBasis,
  headSha,
  initResult,
  isGitAvailable,
  isRepo,
};

const invokedDirectly =
  process.argv[1]?.endsWith("rin-harness-git.ts") ?? false;

if (invokedDirectly) {
  const projectDir = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
  const command = process.argv[2] ?? "basis";
  if (command === "basis") {
    process.stdout.write(
      `${JSON.stringify(gitBasis({ projectDir }), null, 2)}\n`,
    );
  } else if (command === "ensure") {
    process.stdout.write(`${ensureWorkspaceGit({ projectDir })}\n`);
  } else {
    process.stderr.write(
      `rin-harness-git: unknown command "${command}" (basis|ensure)\n`,
    );
    process.exit(1);
  }
}
