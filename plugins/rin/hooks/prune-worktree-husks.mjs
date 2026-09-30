import { execSync } from "node:child_process";
import { existsSync, readdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
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

const repositoryToplevelFrom = ({ startDirectory }) => {
  try {
    return execSync("git rev-parse --show-toplevel", {
      cwd: startDirectory,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return undefined;
  }
};

const trackedWorktreePaths = ({ toplevel }) => {
  try {
    const porcelain = execSync("git worktree list --porcelain", {
      cwd: toplevel,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return new Set(
      porcelain
        .split("\n")
        .filter((line) => line.startsWith("worktree "))
        .map((line) => resolve(line.slice("worktree ".length))),
    );
  } catch {
    return undefined;
  }
};

const worktreeDirectoriesOnDisk = ({ worktreesRoot }) => {
  if (!existsSync(worktreesRoot)) return [];
  return readdirSync(worktreesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => resolve(worktreesRoot, entry.name));
};

const holdsUnsalvagedWork = ({ directory }) => {
  const stack = [directory];
  while (stack.length > 0) {
    const current = stack.pop();
    let entries;
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      return true;
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (entry.name === "node_modules") continue;
        stack.push(join(current, entry.name));
        continue;
      }
      return true;
    }
  }
  return false;
};

const isEmptyLeaf = ({ directory }) => {
  try {
    return readdirSync(directory).length === 0;
  } catch {
    return false;
  }
};

const huskDirectories = ({ worktreesRoot, tracked }) =>
  worktreeDirectoriesOnDisk({ worktreesRoot }).filter(
    (directory) => !tracked.has(directory),
  );

const isRemovableHusk = ({ directory, protectedDirectory }) => {
  if (directory === protectedDirectory) return false;
  if (isEmptyLeaf({ directory })) return true;
  return !holdsUnsalvagedWork({ directory });
};

const removeHusk = ({ directory }) => {
  try {
    rmSync(directory, { recursive: true, force: true });
    return "removed";
  } catch {
    return "locked";
  }
};

const pruneStaleAdministrativeEntries = ({ toplevel }) => {
  try {
    execSync("git worktree prune", {
      cwd: toplevel,
      stdio: "ignore",
    });
    return "pruned";
  } catch {
    return "unavailable";
  }
};

const sweepHusks = ({ toplevel, protectedDirectory }) => {
  const worktreesRoot = join(toplevel, ".claude", "worktrees");
  const tracked = trackedWorktreePaths({ toplevel });
  if (tracked === undefined) return { removed: 0, skipped: 0 };
  const husks = huskDirectories({ worktreesRoot, tracked });
  let removed = 0;
  let skipped = 0;
  for (const directory of husks) {
    if (!isRemovableHusk({ directory, protectedDirectory })) {
      skipped += 1;
      continue;
    }
    if (removeHusk({ directory }) === "removed") {
      removed += 1;
    } else {
      skipped += 1;
    }
  }
  if (removed > 0) pruneStaleAdministrativeEntries({ toplevel });
  return { removed, skipped };
};

const main = async () => {
  const payload = await readStdin();
  const sessionDirectory = sessionDirectoryFrom({
    payload,
    fallbackDirectory: process.cwd(),
  });
  const toplevel = repositoryToplevelFrom({ startDirectory: sessionDirectory });
  if (toplevel === undefined) process.exit(0);
  const { removed } = sweepHusks({
    toplevel,
    protectedDirectory: resolve(sessionDirectory),
  });
  if (removed > 0) {
    process.stderr.write(`Pruned ${removed} orphaned worktree husk(s).\n`);
  }
  process.exit(0);
};

const sessionDirectoryFrom = ({ payload, fallbackDirectory }) => {
  try {
    const invocation = JSON.parse(payload);
    const candidate = invocation?.cwd;
    if (typeof candidate === "string" && candidate.length > 0) return candidate;
  } catch {
    return fallbackDirectory;
  }
  return fallbackDirectory;
};

const invokedScriptPath = process.argv[1];
const isDirectInvocation =
  invokedScriptPath !== undefined &&
  import.meta.url === pathToFileURL(invokedScriptPath).href;

if (isDirectInvocation) {
  main().catch(() => process.exit(0));
}

export {
  holdsUnsalvagedWork,
  huskDirectories,
  isRemovableHusk,
  sweepHusks,
  trackedWorktreePaths,
};
