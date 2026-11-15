import { assessClose, type CloseRefusal } from "../domain/close-guard.ts";
import { createdNumberOf, type CreatedNumberUnreadable } from "../domain/created-write.ts";
import {
  attachedFilesOf,
  parseGhInvocation,
  type GhInvocation,
  type GhInvocationRefusal,
} from "../domain/gh-invocation.ts";
import { grantWriteArguments, type GrantWrite } from "../domain/grant-write.ts";
import { withProvenance, type WriteCredential } from "../domain/provenance.ts";
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
import type { UserTokenFailure, UserTokenMinter } from "./mint-user-token.ts";
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
  readonly userTokenMinter: UserTokenMinter;
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
  | UserTokenFailure
  | GhUnavailable
  | GhReadFailed
  | CloseRefusal
  | ReviewRefusal;

type AttachmentFollowUpFailure = GhUnavailable | CreatedNumberUnreadable;

type GhAsBotReport =
  | { readonly kind: "single-write"; readonly run: GhRun; readonly via: WriteCredential }
  | {
      readonly kind: "created-then-attached";
      readonly created: GhRun;
      readonly attached: Result<GhRun, AttachmentFollowUpFailure>;
    };

type GhRunOutcome = Promise<Result<GhRun, GhAsBotFailure>>;

type GhAsBotOutcome = Promise<Result<GhAsBotReport, GhAsBotFailure>>;

type PreparedText = {
  readonly authoredBody: string | undefined;
  readonly closingComment: string | undefined;
};

type StampedTexts = {
  readonly body: string | undefined;
  readonly closingComment: string | undefined;
  readonly followUpBody: string | undefined;
};

type WrittenRun = { readonly run: GhRunOutcome; readonly via: WriteCredential };

type StampedWrite = StampedTexts & {
  readonly invocation: GhInvocation;
  readonly gh: GitHubCliPort;
};

type GrantRun = {
  readonly gh: GitHubCliPort;
  readonly write: GrantWrite;
  readonly body: string | undefined;
};

type RoutedWrite = StampedTexts & {
  readonly invocation: GhInvocation;
  readonly configuration: IdentityConfiguration;
  readonly dependencies: GhAsBotDependencies;
};

type GrantRoutedWrite = { readonly routed: RoutedWrite; readonly write: GrantWrite };

type AttachmentFollowUp = {
  readonly invocation: GhInvocation;
  readonly created: GhRun;
  readonly followUpBody: string | undefined;
  readonly userGh: GitHubCliPort;
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
    attachments: attachedFilesOf(invocation.attachments),
    placeInStore: dependencies.placeInStore,
  });
  if (guarded.kind === "failure") return guarded;
  const authoredBody = await readAuthoredBody({ ...dependencies, source: invocation.body });
  if (authoredBody.kind === "failure") return authoredBody;
  const bodyRequired = invocation.route.body === "required" && invocation.attachments.kind === "none";
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
    return succeed({ body: verbatimBody, closingComment: undefined, followUpBody: undefined });
  }
  const session = await resolveSession(stamping);
  if (session.kind === "failure") return session;
  const { route, attachments } = stamping.invocation;
  const stampedAs =
    (via: WriteCredential) =>
    (text: string | undefined): string | undefined =>
      text === undefined
        ? undefined
        : withProvenance({
            provenance: { role: route.role, session: session.outcome, via },
            authoredBody: text,
          });
  const stamp = stampedAs(attachments.kind === "same-write" ? "user-grant" : "installation");
  return succeed({
    body: stamp(body) ?? verbatimBody,
    closingComment: stamp(closingComment),
    followUpBody:
      attachments.kind === "follow-up-edit" ? stampedAs("user-grant")(body) : undefined,
  });
};

const pullNumberOf = (invocation: GhInvocation): Result<number, GhTargetRequired> =>
  invocation.target !== undefined && PULL_NUMBER.test(invocation.target)
    ? succeed(Number(invocation.target))
    : fail({ kind: "gh-target-required", verb: invocation.verb });

const bodyFlags = (body: string | undefined): readonly string[] =>
  body === undefined ? [] : ["--body-file", "-"];

const runUnderGrant = ({ gh, write, body }: GrantRun) =>
  gh.run({ ghArguments: grantWriteArguments({ write, body }), standardInput: body });

const runStamped = ({ invocation, gh, body, closingComment }: StampedWrite) =>
  gh.run({
    ghArguments: [
      ...invocation.passThrough,
      ...bodyFlags(body),
      ...(closingComment === undefined ? [] : ["--comment", closingComment]),
    ],
    standardInput: body,
  });

const closeUnlessApproved = async (write: StampedWrite): GhRunOutcome => {
  const pullNumber = pullNumberOf(write.invocation);
  if (pullNumber.kind === "failure") return pullNumber;
  const pullRequest = await write.gh.readPullRequest(pullNumber.outcome);
  if (pullRequest.kind === "failure") return pullRequest;
  const clearance = assessClose(pullRequest.outcome);
  if (clearance.kind === "failure") return clearance;
  return runStamped(write);
};

const reviewBoundToHead = async ({ invocation, gh, body }: StampedWrite): GhRunOutcome => {
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

const writeChecked = (write: StampedWrite): GhRunOutcome => {
  switch (write.invocation.route.check) {
    case "close-guard":
      return closeUnlessApproved(write);
    case "review-binding":
      return reviewBoundToHead(write);
    case "none":
      return runStamped(write);
  }
};

const singleWrite = async ({ run, via }: WrittenRun): GhAsBotOutcome => {
  const ran = await run;
  return ran.kind === "failure" ? ran : succeed({ kind: "single-write", run: ran.outcome, via });
};

const connectAsBot = async ({
  invocation,
  configuration,
  dependencies,
}: RoutedWrite): Promise<Result<GitHubCliPort, TokenFailure>> => {
  const { role, permissions } = invocation.route;
  const { repository } = configuration;
  const token = await dependencies.tokenMinter.mintInstallationToken({
    role,
    appSlug: configuration.roles[role].appSlug,
    repository,
    permissions,
  });
  if (token.kind === "failure") return token;
  return succeed(dependencies.connectGitHubCli({ token: token.outcome, repository }));
};

const connectAsUser = async ({
  invocation,
  configuration,
  dependencies,
}: RoutedWrite): Promise<Result<GitHubCliPort, UserTokenFailure>> => {
  const { repository } = configuration;
  const token = await dependencies.userTokenMinter.mintUserToken({ role: invocation.route.role });
  if (token.kind === "failure") return token;
  return succeed(dependencies.connectGitHubCli({ token: token.outcome, repository }));
};

const writeAsBot = async (write: RoutedWrite): GhAsBotOutcome => {
  const gh = await connectAsBot(write);
  if (gh.kind === "failure") return gh;
  return singleWrite({
    run: writeChecked({ ...write, gh: gh.outcome }),
    via: "installation",
  });
};

const writeAsUser = async ({ routed, write }: GrantRoutedWrite): GhAsBotOutcome => {
  const gh = await connectAsUser(routed);
  if (gh.kind === "failure") return gh;
  return singleWrite({
    run: runUnderGrant({ gh: gh.outcome, write, body: routed.body }),
    via: "user-grant",
  });
};

const editedNounOf = ({ verb }: GhInvocation): "pr" | "issue" =>
  verb.startsWith("pr ") ? "pr" : "issue";

const attachToCreated = async ({
  invocation,
  created,
  followUpBody,
  userGh,
}: AttachmentFollowUp): Promise<Result<GhRun, AttachmentFollowUpFailure>> => {
  const createdNumber = createdNumberOf(created.standardOutput);
  if (createdNumber.kind === "failure") return createdNumber;
  return runUnderGrant({
    gh: userGh,
    write: {
      verb: `${editedNounOf(invocation)} edit`,
      target: String(createdNumber.outcome),
      flags: [],
      files: attachedFilesOf(invocation.attachments),
    },
    body: followUpBody,
  });
};

const createThenAttach = async (write: RoutedWrite): GhAsBotOutcome => {
  const { invocation, followUpBody } = write;
  const userGh = await connectAsUser(write);
  if (userGh.kind === "failure") return userGh;
  const botGh = await connectAsBot(write);
  if (botGh.kind === "failure") return botGh;
  const created = await writeChecked({ ...write, gh: botGh.outcome });
  if (created.kind === "failure") return created;
  if (created.outcome.exitCode !== 0) {
    return succeed({ kind: "single-write", run: created.outcome, via: "installation" });
  }
  const attached = await attachToCreated({
    invocation,
    created: created.outcome,
    followUpBody,
    userGh: userGh.outcome,
  });
  return succeed({ kind: "created-then-attached", created: created.outcome, attached });
};

const writeRouted = (write: RoutedWrite): GhAsBotOutcome => {
  const { attachments } = write.invocation;
  switch (attachments.kind) {
    case "none":
      return writeAsBot(write);
    case "same-write":
      return writeAsUser({ routed: write, write: attachments.write });
    case "follow-up-edit":
      return createThenAttach(write);
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
  return writeRouted({
    ...stamped.outcome,
    invocation: invocation.outcome,
    configuration,
    dependencies,
  });
};

export {
  runGhAsBot,
  type AttachmentFollowUpFailure,
  type GhAsBotDependencies,
  type GhAsBotFailure,
  type GhAsBotReport,
  type GitHubCliAccess,
};
