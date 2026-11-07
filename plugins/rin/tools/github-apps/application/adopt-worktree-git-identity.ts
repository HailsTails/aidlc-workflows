import { botIdentityFor } from "../domain/bot-identity.ts";
import { matchRemoteUrl, type RepositorySlug } from "../domain/repository-slug.ts";
import { fail, succeed, type Result } from "../domain/result.ts";
import type { Secret } from "../domain/secret.ts";
import type { GitFailure, GitWorktreePort } from "./git-worktree-port.ts";
import type { TokenFailure } from "./mint-installation-token.ts";

type GitIdentityAdoption = {
  readonly worktree: GitWorktreePort;
  readonly repository: RepositorySlug;
  readonly appSlug: string;
  readonly credentialHelperCommand: string;
  readonly mintAuthorToken: () => Promise<Result<Secret, TokenFailure>>;
};

type PushRemoteElsewhere = {
  readonly kind: "push-remote-elsewhere";
  readonly remoteUrl: string;
  readonly repository: RepositorySlug;
};

type PushRemoteNotHttps = {
  readonly kind: "push-remote-not-https";
  readonly remoteUrl: string;
  readonly repository: RepositorySlug;
};

type PushTargetRefusal = PushRemoteElsewhere | PushRemoteNotHttps;

type AdoptionFailure = GitFailure | TokenFailure | PushTargetRefusal;

type AdoptionOutcome =
  | { readonly kind: "primary-checkout-left-unchanged" }
  | { readonly kind: "worktree-adopted"; readonly login: string };

type PushTarget = Pick<GitIdentityAdoption, "worktree" | "repository">;

const confirmPushTarget = async ({
  worktree,
  repository,
}: PushTarget): Promise<Result<void, GitFailure | PushTargetRefusal>> => {
  const remoteUrl = await worktree.readPushRemote();
  if (remoteUrl.kind === "failure") return remoteUrl;
  switch (matchRemoteUrl({ repository, remoteUrl: remoteUrl.outcome })) {
    case "same-repository":
      return succeed(undefined);
    case "other-repository":
      return fail({ kind: "push-remote-elsewhere", remoteUrl: remoteUrl.outcome, repository });
    case "not-github-https":
      return fail({ kind: "push-remote-not-https", remoteUrl: remoteUrl.outcome, repository });
  }
};

const adoptWorktreeGitIdentity = async ({
  worktree,
  repository,
  appSlug,
  credentialHelperCommand,
  mintAuthorToken,
}: GitIdentityAdoption): Promise<Result<AdoptionOutcome, AdoptionFailure>> => {
  const checkout = await worktree.readCheckoutKind();
  if (checkout.kind === "failure") return checkout;
  if (checkout.outcome === "primary-checkout") {
    return succeed({ kind: "primary-checkout-left-unchanged" });
  }
  const pushTarget = await confirmPushTarget({ worktree, repository });
  if (pushTarget.kind === "failure") return pushTarget;
  const pushAccess = await mintAuthorToken();
  if (pushAccess.kind === "failure") return pushAccess;
  const identity = botIdentityFor({ appSlug });
  const configured = await worktree.configureWorktree({
    credentialHelperCommand,
    committerName: identity.login,
    committerEmail: identity.commitEmail,
  });
  if (configured.kind === "failure") return configured;
  return succeed({ kind: "worktree-adopted", login: identity.login });
};

export {
  adoptWorktreeGitIdentity,
  type AdoptionFailure,
  type AdoptionOutcome,
  type GitIdentityAdoption,
  type PushRemoteElsewhere,
  type PushRemoteNotHttps,
};
