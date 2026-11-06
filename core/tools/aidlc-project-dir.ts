import { realpathSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

export interface ProjectDirectoryContext {
  explicitDir?: string;
  cwd: string;
  environment?: Readonly<Record<string, string | undefined>>;
  sourceFile?: string;
  leaf?: "tools" | "hooks";
  native?: boolean;
  execPath?: string;
}

export function isHarnessDirName(name: string): boolean {
  return /^\.[a-z0-9][a-z0-9._-]*$/i.test(name);
}

function pathContainedBy(root: string, candidate: string): boolean {
  const rel = relative(root, candidate);
  return rel === "" || (
    rel !== ".." &&
    !rel.startsWith(`..${sep}`) &&
    !isAbsolute(rel)
  );
}

function realPathOrOriginal(path: string): string {
  try {
    return realpathSync(path);
  } catch {
    return path;
  }
}

/** The launcher and read-only observers resolve the same project without changing process state. */
export function resolveProjectDirectory(context: ProjectDirectoryContext): string {
  const explicit = context.explicitDir || context.environment?.AIDLC_PROJECT_DIR ||
    context.environment?.CLAUDE_PROJECT_DIR;
  if (explicit) return isAbsolute(explicit) ? explicit : resolve(context.cwd, explicit);

  if (context.sourceFile) {
    const scriptDir = dirname(context.sourceFile);
    const harness = dirname(scriptDir);
    if (basename(scriptDir) === (context.leaf ?? "tools") && isHarnessDirName(basename(harness))) {
      const root = dirname(harness);
      // A native runtime payload has a project's shape, but belongs to the install.
      const payload = context.native && context.execPath ? join(dirname(context.execPath), "runtime") : null;
      if (payload === null || (
        !pathContainedBy(payload, root) &&
        !pathContainedBy(realPathOrOriginal(payload), realPathOrOriginal(root))
      )) return root;
    }
  }
  return context.cwd;
}
