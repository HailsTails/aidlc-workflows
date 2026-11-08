import type { BaseRevision, ChangeKind, ChangedFile } from "../domain/change.ts";
import type { Repository } from "../application/ports.ts";

type GitResult = { readonly ok: boolean; readonly text: string };

const STATUS_KINDS: Readonly<Record<string, ChangeKind>> = {
  A: "added",
  D: "deleted",
};

const git = (root: string, args: readonly string[]): GitResult => {
  const result = Bun.spawnSync(["git", "-c", "core.quotepath=false", ...args], {
    cwd: root,
    stdout: "pipe",
    stderr: "pipe",
  });
  return { ok: result.exitCode === 0, text: result.stdout.toString() };
};

const nulFields = (text: string): readonly string[] => text.split("\0").filter((f) => f !== "");

const statusPairs = (fields: readonly string[]): readonly ChangedFile[] => {
  const changes: ChangedFile[] = [];
  for (let index = 0; index + 1 < fields.length; index += 2) {
    const status = fields[index] ?? "";
    const path = fields[index + 1] ?? "";
    changes.push({ path, kind: STATUS_KINDS[status.charAt(0)] ?? "modified" });
  }
  return changes;
};

const untracked = (root: string): readonly ChangedFile[] =>
  nulFields(git(root, ["ls-files", "--others", "--exclude-standard", "-z"]).text).map(
    (path) => ({ path, kind: "added" }),
  );

export const gitRepository = (root: string): Repository => ({
  resolve: (ref) => {
    const mergeBase = git(root, ["merge-base", "HEAD", ref]);
    return mergeBase.ok ? { ref, commit: mergeBase.text.trim() } : undefined;
  },
  changesSince: (base: BaseRevision) => {
    const diff = git(root, ["diff", "--name-status", "--no-renames", "-z", base.commit]);
    const tracked = statusPairs(nulFields(diff.text));
    const seen = new Set(tracked.map((change) => change.path));
    const fresh = untracked(root).filter((change) => !seen.has(change.path));
    return [...tracked, ...fresh].sort((left, right) => left.path.localeCompare(right.path));
  },
  readAt: ({ commit, path }) => {
    const shown = git(root, ["show", `${commit}:${path}`]);
    return shown.ok ? shown.text : undefined;
  },
});
