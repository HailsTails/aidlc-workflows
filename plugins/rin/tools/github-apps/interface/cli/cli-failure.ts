import type {
  PushRemoteElsewhere,
  PushRemoteNotHttps,
} from "../../application/adopt-worktree-git-identity.ts";
import type { AuthoriseUserFailure } from "../../application/authorise-user.ts";
import type { ConfigurationFailure } from "../../application/identity-configuration-port.ts";
import type { CredentialDestinationRefused } from "../../application/issue-git-credential.ts";
import type { UserTokenFailure } from "../../application/mint-user-token.ts";
import type { GhAsBotFailure } from "../../application/run-gh-as-bot.ts";
import { supportedGhVerbs } from "../../domain/gh-invocation.ts";
import { formatRepositorySlug } from "../../domain/repository-slug.ts";
import type { FlagFailure } from "./command-flags.ts";

const SHORT_SHA_LENGTH = 8;

const CREDENTIAL_STORE_VARIABLE = "RIN_GITHUB_APPS_CREDENTIALS_DIR";

type CommandLineFailure =
  | { readonly kind: "unknown-command"; readonly commandName: string }
  | { readonly kind: "credential-query-invalid"; readonly issues: string };

type CliFailure =
  | GhAsBotFailure
  | AuthoriseUserFailure
  | UserTokenFailure
  | PushRemoteElsewhere
  | PushRemoteNotHttps
  | CredentialDestinationRefused
  | ConfigurationFailure
  | FlagFailure
  | CommandLineFailure;

type FailureKind = CliFailure["kind"];

type FailureOf<Kind extends FailureKind> = Extract<CliFailure, { readonly kind: Kind }>;

type FailureDescribers = { readonly [Kind in FailureKind]: (failure: FailureOf<Kind>) => string };

type DescribedFailure<Kind extends FailureKind> = {
  readonly kind: Kind;
  readonly failure: FailureOf<Kind>;
};

const LOGIN_HINT = 'Run the "login" command of the bot CLI, then retry.';

const UNPUBLISHABLE_CONTENT = {
  "contains-private-key": "a private key",
  "contains-user-token": "a GitHub user token",
} as const;

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
  "gh-verb-unsupported": ({ verb }) =>
    `"gh ${verb}" is not a write the bot wrapper runs. It runs: ${supportedGhVerbs().map((name) => `gh ${name}`).join(", ")}. Run reads as plain gh.`,
  "gh-flag-refused": ({ flag }) =>
    `${flag} is refused: the wrapper pins the repository, never bypasses rulesets, never opens a browser or editor, and never posts a body it did not stamp. Drop ${flag} and give the text with --body or --body-file.`,
  "gh-attach-unsupported": ({ verb }) =>
    `gh ${verb} takes no --attach. Attach files with gh pr create, gh pr edit, gh pr comment, gh issue create, gh issue edit or gh issue comment.`,
  "gh-flag-value-missing": ({ flag }) => `${flag} needs a value.`,
  "gh-body-given-twice": () => "Pass --body or --body-file, not both.",
  "gh-body-missing": ({ verb }) =>
    `gh ${verb} needs its text: pass --body, --body-file, or --body-file - to read standard input.`,
  "gh-review-event-ambiguous": () =>
    "gh pr review needs exactly one of --approve, --request-changes or --comment.",
  "gh-review-flag-unsupported": ({ token }) =>
    `gh pr review through the wrapper takes the pull request number, one event flag, --body or --body-file, and optionally --commit-sha <sha>; "${token}" is not one of them.`,
  "gh-target-required": ({ verb }) =>
    `gh ${verb} needs the pull request number right after the verb, as in "gh ${verb} 12 ...".`,
  "gh-unavailable": ({ detail }) =>
    `gh could not be run: ${detail}. Install GitHub CLI 2.103.2 or later and put it on PATH.`,
  "gh-read-failed": ({ operation, detail }) => `gh could not ${operation}: ${detail}`,
  "attachment-refused": ({ attachment }) =>
    `Refusing to attach ${attachment}: it is inside the bot credential store.`,
  "git-command-failed": ({ command, detail }) => `${command} failed: ${detail}`,
  "push-remote-elsewhere": ({ remoteUrl, repository }) =>
    `This worktree pushes to ${remoteUrl}, not ${formatRepositorySlug(repository)}; the bot only pushes to the configured repository.`,
  "push-remote-not-https": ({ remoteUrl, repository }) =>
    `This worktree pushes to ${remoteUrl}, which the bot's credential helper cannot serve; set the push remote to https://github.com/${formatRepositorySlug(repository)}.git.`,
  "branch-detached": () =>
    "HEAD is detached, so the provenance marker has no session; check out a branch or pass --session <id>.",
  "pull-request-not-open": ({ pullNumber, lifecycle }) =>
    `#${String(pullNumber)} is already ${lifecycle}.`,
  "approved-and-mergeable": ({ pullNumber }) =>
    `#${String(pullNumber)} is approved and mergeable; merge it with gh pr merge instead of closing it.`,
  "reviewed-head-moved": ({ pullNumber, reviewedSha, headSha }) =>
    `#${String(pullNumber)} head is ${shortSha(headSha)} but this review read ${shortSha(reviewedSha)}; review the current head.`,
  "credential-destination-refused": ({ destination }) =>
    `Refusing to hand the author bot's credential to ${destination}; it serves only the configured repository.`,
  "configuration-unreadable": ({ location }) =>
    `No bot identity is configured: cannot read ${location}. Add aidlc/github-identity.json naming the repository, base branch and each role's app slug.`,
  "configuration-invalid": ({ location, issues }) =>
    `The identity configuration at ${location} is malformed: ${issues}`,
  "flag-malformed": ({ token }) => `Unexpected argument "${token}"; every argument is a --flag.`,
  "flag-repeated": ({ flag }) => `--${flag} was given more than once.`,
  "flag-value-missing": ({ flag }) => `--${flag} needs a value.`,
  "flags-invalid": ({ issues }) => `Invalid flags: ${issues}`,
  "inline-body-refused": ({ reason }) =>
    `Refusing to post that text: it contains ${UNPUBLISHABLE_CONTENT[reason]}.`,
  "body-file-unreadable": ({ location }) => `Cannot read the body file ${location}.`,
  "body-file-refused": ({ location, reason }) =>
    reason === "inside-credential-store"
      ? `Refusing to post ${location}: it is inside the bot credential store.`
      : `Refusing to post ${location}: it contains ${UNPUBLISHABLE_CONTENT[reason]}.`,
  "user-authorisation-unconfigured": ({ role, path }) =>
    `The ${role} entry in ${path} has no userAuthorisation.clientId, so the ${role} app cannot act as a person. Add the app's OAuth client ID there; see the Rin GitHub bot identity guide.`,
  "device-flow-disabled": () =>
    "The GitHub App has device flow switched off. Enable device flow in the app's settings, then log in again.",
  "oauth-client-rejected": () =>
    "GitHub does not recognise the userAuthorisation.clientId in the credential store; copy the client ID from the app's settings page.",
  "oauth-request-refused": ({ operation, error, description }) =>
    `GitHub refused to ${operation} (${error}): ${description}`,
  "device-code-expired": () => `The login code expired before it was approved. ${LOGIN_HINT}`,
  "device-authorisation-denied": () => "The login was declined on GitHub; nothing was stored.",
  "refresh-token-rejected": () =>
    `GitHub no longer accepts this machine's user grant; it was revoked or replaced. ${LOGIN_HINT}`,
  "user-grant-missing": ({ path }) =>
    `No user grant at ${path}, and attachments are never uploaded as another identity. ${LOGIN_HINT}`,
  "user-grant-invalid": ({ path, issues }) =>
    `The user grant at ${path} is malformed: ${issues}. ${LOGIN_HINT}`,
  "user-grant-expired": () => `This machine's user grant has expired. ${LOGIN_HINT}`,
  "user-grant-unwritable": ({ path, detail }) => `Cannot write the user grant to ${path}: ${detail}`,
  "user-grant-lock-unavailable": ({ path }) =>
    `Another session has held the user grant lock at ${path} for too long. Retry; if it persists, delete that file.`,
  "unknown-command": ({ commandName }) => `Unknown command "${commandName}".`,
  "credential-query-invalid": ({ issues }) =>
    `git sent an unreadable credential request: ${issues}`,
};

const describeAs = <Kind extends FailureKind>({ kind, failure }: DescribedFailure<Kind>): string =>
  describers[kind](failure);

const describeCliFailure = (failure: CliFailure): string =>
  describeAs({ kind: failure.kind, failure });

export { describeCliFailure, type CliFailure, type CommandLineFailure };
