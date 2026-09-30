import { lstatSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// This file has two homes: plugins/rin/hooks/ (authored) and .claude/hooks/
// (projected, where the harness actually runs it). Those sit at different
// depths, so no single static `../` specifier reaches repo-root scripts/ from
// both. Resolving the repo root from the nearest ancestor that contains
// scripts/ makes one source correct in either location.
const repoRootFrom = (start) => {
  const ascend = (directory) => {
    const parent = dirname(directory);
    if (parent === directory) return null;
    return lstatSync(join(directory, "scripts"), {
      throwIfNoEntry: false,
    })?.isDirectory()
      ? directory
      : ascend(parent);
  };
  return ascend(start);
};

const pathToFileHref = (absolutePath) =>
  new URL(`file:///${absolutePath.replace(/\\/g, "/").replace(/^\/+/, "")}`)
    .href;

const previewScript = (fileName) => {
  const repoRoot = repoRootFrom(
    resolve(dirname(fileURLToPath(import.meta.url))),
  );
  if (repoRoot === null) throw new Error("no repo root above this hook");
  return pathToFileHref(join(repoRoot, "scripts", fileName));
};

const readStdin = () =>
  new Promise((resolve) => {
    let raw = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      raw += chunk;
    });
    process.stdin.on("end", () => resolve(raw));
  });

const isWorktreeRoot = ({ directory }) => {
  try {
    return lstatSync(join(directory, ".git")).isFile();
  } catch {
    return false;
  }
};

const targetDirectoryFrom = ({ invocation }) => {
  const fromToolInput = invocation?.tool_input?.path;
  if (
    typeof fromToolInput === "string" &&
    isWorktreeRoot({ directory: fromToolInput })
  ) {
    return fromToolInput;
  }
  const sessionDirectory = process.cwd();
  return isWorktreeRoot({ directory: sessionDirectory })
    ? sessionDirectory
    : null;
};

const registerWorktree = async ({ worktreeDirectory }) => {
  const { generatePreviewLaunch } = await import(
    previewScript("generate-preview-launch.mjs")
  );
  const { mainRootFrom, prunedWorktrees, readRegistry, writeRegistry } =
    await import(previewScript("preview-worktree-registry.mjs"));
  const mainRoot = mainRootFrom({ anyRepoDirectory: worktreeDirectory });
  const registry = readRegistry({ mainRoot });
  const worktreeName = basename(worktreeDirectory);
  const live = prunedWorktrees({ worktrees: registry.worktrees });
  live[worktreeName] = { path: worktreeDirectory };
  writeRegistry({ mainRoot, registry: { worktrees: live } });
  generatePreviewLaunch({ anyRepoDirectory: worktreeDirectory });
};

const main = async () => {
  const raw = await readStdin();
  let invocation = {};
  try {
    invocation = JSON.parse(raw);
  } catch {
    invocation = {};
  }
  const worktreeDirectory = targetDirectoryFrom({ invocation });
  if (worktreeDirectory === null) {
    process.exit(0);
  }
  try {
    await registerWorktree({ worktreeDirectory });
  } catch {
    process.exit(0);
  }
  process.exit(0);
};

main().catch(() => process.exit(0));
