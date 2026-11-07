import { assessClose, type CloseRefusal } from "../domain/close-guard.ts";
import {
  parseGhInvocation,
  type GhInvocation,
  type GhInvocationRefusal,
} from "../domain/gh-invocation.ts";
import { withProvenance } from "../domain/provenance.ts";
import type { RepositorySlug } from "../domain/repository-slug.ts";
import { fail, succeed, type Result } from "../domain/result.ts";
import { assessReviewTarget, type ReviewRefusal } from "../domain/review-guard.ts";
import type { Secret } from "../domain/secret.ts";
import type { StorePlacementCheck } from "./credential-store-boundary.ts";
import type { GhReadFailed, GhRun, GhUnavailable, GitHubCliPort } from "./github-cli-port.ts";
import type { GitFailure, GitWorktreePort } from "./git-worktree-port.ts";
import { guardAttachments, type AttachmentRefused } from "./guard-attachments.ts";
import type { IdentityConfiguration } from "./identity-configuration-port.ts";
import type { TokenFailure, TokenMinter } from "./mint-installation-token.ts";
import {
  readAuthoredBody,
  refuseUnpublishable,
  type AuthoredBodyFailure,
} from "./read-authored-body.ts";
import type { BodyFileReader } from "./read-body-file.ts";

const NEW_ISSUE_SESSION = "new-issue";

const PULL_NUMBER = /^[1-9]\d*$/;

type GitHubCliAccess = { readonly token: Secret; readonly repository: RepositorySlug };

type GhAsBotDependencies = {
  readonly tokenMinter: TokenMinter;
  readonly connectGitHubCli: (access: GitHubCliAccess) => GitHubCliPort;
  readonly worktree: GitWorktreePort;
  readonly readBodyFile: BodyFileReader;
  readonly readStandardInput: () => Promise<string>;
  readonly placeInStore: StorePlacementCheck;
};

type GhAsBotRequest = {
  readonly commandArguments: readonly string[];
  readonly configuration: IdentityConfiguration;
  readonly dependencies: GhAsBotDependencies;
};

type GhTargetRequired = { readonly kind: "gh-target-required"; readonly verb: string };

type GhBodyMissing = { readonly kind: "gh-body-missing"; readonly verb: string };

type GhAsBotFailure =
  | GhInvocationRefusal
  | GhTargetRequired
  | GhBodyMissing
  | AttachmentRefused
  | AuthoredBodyFailure
  | GitFailure
  | TokenFailure
  | GhUnavailable
  | GhReadFailed
  | CloseRefusal
  | ReviewRefusal;

type GhAsBotOutcome = Promise<Result<GhRun, GhAsBotFailure>>;

type PreparedText = {
  readonly authoredBody: string | undefined;
  readonly closingComment: string | undefined;
};

type StampedTexts = {
  readonly body: string | undefined;
  readonly closingComment: string | undefined;
};

type StampedWrite = StampedTexts & {
  readonly invocation: GhInvocation;
  readonly gh: GitHubCliPort;
};

type Stamping = {
  readonly invocation: GhInvocation;
  readonly worktree: GitWorktreePort;
};

const prepareText = async (
  invocation: GhInvocation,
  dependencies: GhAsBotDependencies,
): Promise<Result<PreparedText, GhAsBotFailure>> => {
  const guarded = await guardAttachments({
    attachments: invocation.attachments,
    placeInStore: dependencies.placeInStore,
  });
  if (guarded.kind === "failure") return guarded;
  const authoredBody = await readAuthoredBody({ ...dependencies, source: invocation.body });
  if (authoredBody.kind === "failure") return authoredBody;
  const bodyRequired = invocation.route.body === "required" && invocation.attachments.length === 0;
  if (bodyRequired && authoredBody.outcome === undefined) {
    return fail({ kind: "gh-body-missing", verb: invocation.verb });
  }
  if (invocation.closingComment === undefined) {
    return succeed({ authoredBody: authoredBody.outcome, closingComment: undefined });
  }
  const closingComment = refuseUnpublishable(invocation.closingComment);
  if (closingComment.kind === "failure") return closingComment;
  return succeed({ authoredBody: authoredBody.outcome, closingComment: closingComment.outcome });
};

const bodyToStamp = (invocation: GhInvocation, authoredBody: string | undefined): string | undefined => {
  switch (invocation.route.body) {
    case "verbatim":
      return undefined;
    case "when-given":
      return authoredBody;
    case "required":
    case "stamped":
      return authoredBody ?? "";
  }
};

const passedVerbatim = (invocation: GhInvocation, authoredBody: string | undefined) =>
  invocation.route.body === "verbatim" ? authoredBody : undefined;

const resolveSession = async ({
  invocation,
  worktree,
}: Stamping): Promise<Result<string, GitFailure>> => {
  const named = invocation.session ?? invocation.target ?? invocation.head;
  if (named !== undefined) return succeed(named);
  if (invocation.verb === "issue create") return succeed(NEW_ISSUE_SESSION);
  return worktree.readCurrentBranch();
};

const stampTexts = async (
  stamping: Stamping,
  { authoredBody, closingComment }: PreparedText,
): Promise<Result<StampedTexts, GitFailure>> => {
  const body = bodyToStamp(stamping.invocation, authoredBody);
  const verbatimBody = passedVerbatim(stamping.invocation, authoredBody);
  if (body === undefined && closingComment === undefined) {
    return succeed({ body: verbatimBody, closingComment: undefined });
  }
  const session = await resolveSession(stamping);
  if (session.kind === "failure") return session;
  const provenance = { role: stamping.invocation.route.role, session: session.outcome };
  const stamp = (text: string | undefined): string | undefined =>
    text === undefined ? undefined : withProvenance({ provenance, authoredBody: text });
  return succeed({ body: stamp(body) ?? verbatimBody, closingComment: stamp(closingComment) });
};

const pullNumberOf = (invocation: GhInvocation): Result<number, GhTargetRequired> =>
  invocation.target !== undefined && PULL_NUMBER.test(invocation.target)
    ? succeed(Number(invocation.target))
    : fail({ kind: "gh-target-required", verb: invocation.verb });

const runStamped = ({ invocation, gh, body, closingComment }: StampedWrite) =>
  gh.run({
    ghArguments: [
      ...invocation.passThrough,
      ...(body === undefined ? [] : ["--body-file", "-"]),
      ...(closingComment === undefined ? [] : ["--comment", closingComment]),
    ],
    standardInput: body,
  });

const closeUnlessApproved = async (write: StampedWrite): GhAsBotOutcome => {
  const pullNumber = pullNumberOf(write.invocation);
  if (pullNumber.kind === "failure") return pullNumber;
  const pullRequest = await write.gh.readPullRequest(pullNumber.outcome);
  if (pullRequest.kind === "failure") return pullRequest;
  const clearance = assessClose(pullRequest.outcome);
  if (clearance.kind === "failure") return clearance;
  return runStamped(write);
};

const reviewBoundToHead = async ({ invocation, gh, body }: StampedWrite): GhAsBotOutcome => {
  const { event, commitSha } = invocation.review;
  if (event === undefined) return fail({ kind: "gh-review-event-ambiguous" });
  const pullNumber = pullNumberOf(invocation);
  if (pullNumber.kind === "failure") return pullNumber;
  const read = await gh.readPullRequest(pullNumber.outcome);
  if (read.kind === "failure") return read;
  const binding = assessReviewTarget({ pullRequest: read.outcome.pullRequest, reviewedSha: commitSha });
  if (binding.kind === "failure") return binding;
  return gh.submitReview({
    pullRequestId: read.outcome.pullRequest.nodeId,
    commitSha: binding.outcome.commitSha,
    event,
    body: body ?? "",
  });
};

const writeChecked = (write: StampedWrite): GhAsBotOutcome => {
  switch (write.invocation.route.check) {
    case "close-guard":
      return closeUnlessApproved(write);
    case "review-binding":
      return reviewBoundToHead(write);
    case "none":
      return runStamped(write);
  }
};

const runGhAsBot = async ({
  commandArguments,
  configuration,
  dependencies,
}: GhAsBotRequest): GhAsBotOutcome => {
  const invocation = parseGhInvocation(commandArguments);
  if (invocation.kind === "failure") return invocation;
  const texts = await prepareText(invocation.outcome, dependencies);
  if (texts.kind === "failure") return texts;
  const stamped = await stampTexts(
    { invocation: invocation.outcome, worktree: dependencies.worktree },
    texts.outcome,
  );
  if (stamped.kind === "failure") return stamped;
  const { role, permissions } = invocation.outcome.route;
  const token = await dependencies.tokenMinter.mintInstallationToken({
    role,
    appSlug: configuration.roles[role].appSlug,
    repository: configuration.repository,
    permissions,
  });
  if (token.kind === "failure") return token;
  return writeChecked({
    ...stamped.outcome,
    invocation: invocation.outcome,
    gh: dependencies.connectGitHubCli({ token: token.outcome, repository: configuration.repository }),
  });
};

export { runGhAsBot, type GhAsBotDependencies, type GhAsBotFailure, type GitHubCliAccess };
