import type { Result } from "../domain/result.ts";

type GitFailure =
  | { readonly kind: "git-command-failed"; readonly command: string; readonly detail: string }
  | { readonly kind: "branch-detached" };

type CheckoutKind = "primary-checkout" | "linked-worktree";

type WorktreeGitSettings = {
  readonly credentialHelperCommand: string;
  readonly committerName: string;
  readonly committerEmail: string;
};

type GitWorktreePort = {
  readonly readCurrentBranch: () => Promise<Result<string, GitFailure>>;
  readonly readCheckoutKind: () => Promise<Result<CheckoutKind, GitFailure>>;
  readonly readPushRemote: () => Promise<Result<string, GitFailure>>;
  readonly configureWorktree: (settings: WorktreeGitSettings) => Promise<Result<void, GitFailure>>;
};

export type { CheckoutKind, GitFailure, GitWorktreePort, WorktreeGitSettings };
