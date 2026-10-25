import { botIdentityFor } from "../domain/bot-identity.ts";
import { succeed, type Result } from "../domain/result.ts";
import type { Secret } from "../domain/secret.ts";
import type { GitFailure, GitWorktreePort } from "./git-worktree-port.ts";
import type { TokenFailure } from "./mint-installation-token.ts";

type GitIdentityAdoption = {
  readonly worktree: GitWorktreePort;
  readonly appSlug: string;
  readonly credentialHelperCommand: string;
  readonly mintAuthorToken: () => Promise<Result<Secret, TokenFailure>>;
};

type AdoptionOutcome =
  | { readonly kind: "primary-checkout-left-unchanged" }
  | { readonly kind: "worktree-adopted"; readonly login: string };

const adoptWorktreeGitIdentity = async ({
  worktree,
  appSlug,
  credentialHelperCommand,
  mintAuthorToken,
}: GitIdentityAdoption): Promise<Result<AdoptionOutcome, GitFailure | TokenFailure>> => {
  const checkout = await worktree.readCheckoutKind();
  if (checkout.kind === "failure") return checkout;
  if (checkout.outcome === "primary-checkout") {
    return succeed({ kind: "primary-checkout-left-unchanged" });
  }
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

export { adoptWorktreeGitIdentity, type AdoptionOutcome, type GitIdentityAdoption };
