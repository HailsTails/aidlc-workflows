import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const OWNER_FILE = "owner.pid";

const POLL_MS = 100;

export type PackageLockOptions = {
  readonly lockPath: string;
  readonly pid: number;
  readonly isProcessAlive: (pid: number) => boolean;
  readonly now: () => number;
  readonly sleep: (milliseconds: number) => void;
  readonly timeoutMs: number;
  readonly report: (line: string) => void;
};

export type PackageLockOutcome =
  | { readonly kind: "held"; readonly release: () => void }
  | { readonly kind: "timed-out" };

export const processExists = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return !(error instanceof Error && "code" in error && error.code === "ESRCH");
  }
};

const alreadyExists = (error: unknown): boolean =>
  error instanceof Error && "code" in error && error.code === "EEXIST";

const removeTree = (path: string): void => rmSync(path, { recursive: true, force: true });

const ownerOf = (lockPath: string): number | undefined => {
  try {
    const pid = Number.parseInt(readFileSync(join(lockPath, OWNER_FILE), "utf8"), 10);
    return Number.isInteger(pid) && pid > 0 ? pid : undefined;
  } catch {
    return undefined;
  }
};

const tryCreate = (lockPath: string, pid: number): "created" | "taken" => {
  try {
    mkdirSync(lockPath);
  } catch (error) {
    if (alreadyExists(error)) return "taken";
    throw error;
  }
  try {
    writeFileSync(join(lockPath, OWNER_FILE), String(pid));
  } catch (error) {
    removeTree(lockPath);
    throw error;
  }
  return "created";
};

const reclaimIfOwnerGone = (options: PackageLockOptions): "reclaimed" | "left" => {
  const { lockPath, isProcessAlive, report } = options;
  const owner = ownerOf(lockPath);
  if (owner === undefined || isProcessAlive(owner)) return "left";
  const guardPath = `${lockPath}.reclaim`;
  try {
    mkdirSync(guardPath);
  } catch (error) {
    if (alreadyExists(error)) return "left";
    throw error;
  }
  try {
    if (ownerOf(lockPath) !== owner) return "left";
    removeTree(lockPath);
    report(`reclaimed the projection regeneration lock left by exited process ${owner}\n`);
    return "reclaimed";
  } finally {
    removeTree(guardPath);
  }
};

export const acquirePackageLock = (options: PackageLockOptions): PackageLockOutcome => {
  const deadline = options.now() + options.timeoutMs;
  while (tryCreate(options.lockPath, options.pid) === "taken") {
    if (reclaimIfOwnerGone(options) === "reclaimed") continue;
    if (options.now() >= deadline) return { kind: "timed-out" };
    options.sleep(POLL_MS);
  }
  return { kind: "held", release: () => removeTree(options.lockPath) };
};
