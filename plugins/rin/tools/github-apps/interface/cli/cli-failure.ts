import type {
  PushRemoteElsewhere,
  PushRemoteNotHttps,
} from "../../application/adopt-worktree-git-identity.ts";
import type { GitFailure } from "../../application/git-worktree-port.ts";
import type { ConfigurationFailure } from "../../application/identity-configuration-port.ts";
import type { CredentialDestinationRefused } from "../../application/issue-git-credential.ts";
import type { TokenFailure } from "../../application/mint-installation-token.ts";
import type { NothingToRevise } from "../../application/revise-pull-request.ts";
import type { CloseRefusal } from "../../domain/close-guard.ts";
import type { MergeRefusal } from "../../domain/merge-guard.ts";
import type { PullRequestMergeState } from "../../domain/pull-request.ts";
import { formatRepositorySlug } from "../../domain/repository-slug.ts";
import type { ReviewRefusal } from "../../domain/review-guard.ts";
import type { BodyFailure } from "./authored-body.ts";
import type { FlagFailure } from "./command-flags.ts";

const SHORT_SHA_LENGTH = 8;

const CREDENTIAL_STORE_VARIABLE = "RIN_GITHUB_APPS_CREDENTIALS_DIR";

type CommandLineFailure =
  | { readonly kind: "unknown-command"; readonly commandName: string }
  | { readonly kind: "credential-query-invalid"; readonly issues: string };

type CliFailure =
  | TokenFailure
  | GitFailure
  | PushRemoteElsewhere
  | PushRemoteNotHttps
  | MergeRefusal
  | CloseRefusal
  | ReviewRefusal
  | NothingToRevise
  | CredentialDestinationRefused
  | ConfigurationFailure
  | FlagFailure
  | BodyFailure
  | CommandLineFailure;

type FailureKind = CliFailure["kind"];

type FailureOf<Kind extends FailureKind> = Extract<CliFailure, { readonly kind: Kind }>;

type FailureDescribers = { readonly [Kind in FailureKind]: (failure: FailureOf<Kind>) => string };

type DescribedFailure<Kind extends FailureKind> = {
  readonly kind: Kind;
  readonly failure: FailureOf<Kind>;
};

const MERGE_STATE_EXPLANATIONS: {
  readonly [State in Exclude<PullRequestMergeState, "clean">]: string;
} = {
  behind: "so its branch is behind the base branch and must be updated",
  blocked: "so the ruleset is still waiting on a required approval or status check",
  dirty: "so it conflicts with the base branch",
  draft: "so it must be marked ready first",
  "has-hooks": "so it is waiting on the repository's merge hooks",
  unknown: "so GitHub has not finished computing it; try again shortly",
  unstable: "so some status checks are failing or still pending",
};

const shortSha = (sha: string | null): string => sha?.slice(0, SHORT_SHA_LENGTH) ?? "no commit";

const describers: FailureDescribers = {
  "credential-store-unlocatable": ({ detail }) =>
    `Cannot locate the bot credential store from this checkout: ${detail}`,
  "credentials-unreadable": ({ path }) =>
    `No bot credentials at ${path}. Create the per-user credential store, or point ${CREDENTIAL_STORE_VARIABLE} at one; see the Rin GitHub bot identity guide.`,
  "credentials-invalid": ({ path, issues }) =>
    `Bot credentials at ${path} are malformed: ${issues}`,
  "role-credentials-missing": ({ role, path }) =>
    `The credential store at ${path} has no entry for the ${role} role.`,
  "private-key-unreadable": ({ role, path }) =>
    `Cannot read the ${role} app's private key at ${path}.`,
  "jwt-signing-failed": () =>
    "Could not sign the GitHub App JWT; the private key is not a usable RSA key.",
  "github-unreachable": ({ operation }) => `GitHub could not be reached to ${operation}.`,
  "github-rejected": ({ operation, status, detail }) =>
    `GitHub refused to ${operation} (${String(status)}): ${detail}`,
  "github-response-invalid": ({ operation, issues }) =>
    `GitHub's reply to ${operation} was not the expected shape: ${issues}`,
  "app-not-installed": ({ repository }) =>
    `The GitHub App is not installed on ${formatRepositorySlug(repository)}; install it there first.`,
  "app-identity-mismatch": ({ role, expectedAppSlug, actualAppSlug }) =>
    `The ${role} credentials authenticate as ${actualAppSlug}, not ${expectedAppSlug}.`,
  "git-command-failed": ({ command, detail }) => `${command} failed: ${detail}`,
  "push-remote-elsewhere": ({ remoteUrl, repository }) =>
    `This worktree pushes to ${remoteUrl}, not ${formatRepositorySlug(repository)}; the bot only pushes to the configured repository.`,
  "push-remote-not-https": ({ remoteUrl, repository }) =>
    `This worktree pushes to ${remoteUrl}, which the bot's credential helper cannot serve; set the push remote to https://github.com/${formatRepositorySlug(repository)}.git.`,
  "branch-detached": () => "HEAD is detached; check out a branch or pass --head <branch>.",
  "pull-request-not-open": ({ pullNumber, lifecycle }) =>
    `#${String(pullNumber)} is already ${lifecycle}.`,
  "pull-request-is-draft": ({ pullNumber }) =>
    `#${String(pullNumber)} is a draft; mark it ready with the ready command before merging.`,
  "pull-request-not-mergeable": ({ pullNumber, mergeState }) =>
    `#${String(pullNumber)} cannot merge: GitHub reports its merge state as ${mergeState}, ${MERGE_STATE_EXPLANATIONS[mergeState]}.`,
  "approved-and-mergeable": ({ pullNumber }) =>
    `#${String(pullNumber)} is approved and mergeable; merge it with the merge command instead of closing it.`,
  "reviewed-head-moved": ({ pullNumber, reviewedSha, headSha }) =>
    `#${String(pullNumber)} head is ${shortSha(headSha)} but this review read ${shortSha(reviewedSha)}; review the current head.`,
  "nothing-to-revise": ({ pullNumber }) =>
    `Nothing to change on #${String(pullNumber)}; pass --title, --body or --body-file.`,
  "credential-destination-refused": ({ destination }) =>
    `Refusing to hand the author bot's credential to ${destination}; it serves only the configured repository.`,
  "configuration-unreadable": ({ location }) =>
    `No bot identity is configured: cannot read ${location}. Add aidlc/github-identity.json naming the repository, base branch and each role's app slug.`,
  "configuration-invalid": ({ location, issues }) =>
    `The identity configuration at ${location} is malformed: ${issues}`,
  "flag-malformed": ({ token }) => `Unexpected argument "${token}"; every argument is a --flag.`,
  "flag-repeated": ({ flag }) => `--${flag} was given more than once.`,
  "flags-invalid": ({ issues }) => `Invalid flags: ${issues}`,
  "body-missing": () => "Provide the text with --body or --body-file.",
  "body-given-twice": () => "Pass --body or --body-file, not both.",
  "inline-body-refused": () => "Refusing to post the --body text: it contains a private key.",
  "body-file-unreadable": ({ location }) => `Cannot read the body file ${location}.`,
  "body-file-refused": ({ location, reason }) =>
    reason === "inside-credential-store"
      ? `Refusing to post ${location}: it is inside the bot credential store.`
      : `Refusing to post ${location}: it contains a private key.`,
  "unknown-command": ({ commandName }) => `Unknown command "${commandName}".`,
  "credential-query-invalid": ({ issues }) =>
    `git sent an unreadable credential request: ${issues}`,
};

const describeAs = <Kind extends FailureKind>({ kind, failure }: DescribedFailure<Kind>): string =>
  describers[kind](failure);

const describeCliFailure = (failure: CliFailure): string =>
  describeAs({ kind: failure.kind, failure });

export { describeCliFailure, type CliFailure, type CommandLineFailure };
