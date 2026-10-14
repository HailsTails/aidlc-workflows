import type { GitPort } from "../platform-ports/git-port.ts";
import type { AbsolutePath } from "../values/absolute-path.ts";
import type { RepoPath } from "../values/repo-path.ts";

export type TouchedSet =
  | { readonly measured: "yes"; readonly paths: ReadonlySet<RepoPath> }
  | {
      readonly measured: "no";
      readonly reason: "no-base-revision" | "git-failed";
      readonly detail: string;
    };

export const computeTouchedSet = (request: {
  readonly repoRoot: AbsolutePath;
  readonly baseRevision: string | undefined;
  readonly git: GitPort;
}): TouchedSet => {
  if (request.baseRevision === undefined) {
    return {
      measured: "no",
      reason: "no-base-revision",
      detail: "no base revision was given, so no change set can be measured",
    };
  }
  const changed = request.git.changedSince({
    repoRoot: request.repoRoot,
    baseRevision: request.baseRevision,
  });
  if (changed.outcome === "failed") {
    return {
      measured: "no",
      reason: "git-failed",
      detail: `${changed.error.command}: ${changed.error.detail}`,
    };
  }
  return { measured: "yes", paths: new Set(changed.value) };
};
