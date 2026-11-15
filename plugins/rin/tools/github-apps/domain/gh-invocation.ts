import type { AgentRole } from "./agent-role.ts";
import { flagTokenOf, type FlagToken } from "./flag-token.ts";
import {
  isGrantWriteVerb,
  parseGrantWrite,
  type GrantWrite,
  type GrantWriteRefusal,
} from "./grant-write.ts";
import type { InstallationPermissions } from "./installation-permissions.ts";
import type { ReviewEvent } from "./pull-request.ts";
import { fail, succeed, type Result } from "./result.ts";

type BodyStamping = "required" | "stamped" | "when-given" | "verbatim";

type VerbCheck = "none" | "close-guard" | "review-binding";

type AttachmentCarriage = "follow-up-edit" | "same-write" | "unsupported";

type GhRoute = {
  readonly role: AgentRole;
  readonly permissions: InstallationPermissions | undefined;
  readonly body: BodyStamping;
  readonly closingComment: boolean;
  readonly check: VerbCheck;
  readonly attachments: AttachmentCarriage;
};

const ISSUES_ONLY = { issues: "write" } as const;

const CONVERSATION = { issues: "write", pull_requests: "write" } as const;

const authorRoute = (route: Partial<GhRoute>): GhRoute => ({
  role: "author",
  permissions: undefined,
  body: "verbatim",
  closingComment: false,
  check: "none",
  attachments: "unsupported",
  ...route,
});

const GH_ROUTES = {
  "pr create": authorRoute({ body: "required", attachments: "follow-up-edit" }),
  "pr edit": authorRoute({ body: "when-given", attachments: "same-write" }),
  "pr comment": authorRoute({
    permissions: CONVERSATION,
    body: "required",
    attachments: "same-write",
  }),
  "pr ready": authorRoute({}),
  "pr merge": authorRoute({}),
  "pr close": authorRoute({ closingComment: true, check: "close-guard" }),
  "pr review": { ...authorRoute({ body: "stamped", check: "review-binding" }), role: "reviewer" },
  "issue create": authorRoute({
    permissions: ISSUES_ONLY,
    body: "required",
    attachments: "follow-up-edit",
  }),
  "issue edit": authorRoute({
    permissions: ISSUES_ONLY,
    body: "when-given",
    attachments: "same-write",
  }),
  "issue comment": authorRoute({
    permissions: CONVERSATION,
    body: "required",
    attachments: "same-write",
  }),
  "issue close": authorRoute({ permissions: ISSUES_ONLY, closingComment: true }),
  "issue reopen": authorRoute({ permissions: ISSUES_ONLY }),
} as const satisfies Readonly<Record<string, GhRoute>>;

type GhVerb = keyof typeof GH_ROUTES;

type BodySource =
  | { readonly kind: "inline"; readonly text: string }
  | { readonly kind: "file"; readonly location: string }
  | { readonly kind: "standard-input" };

type ReviewRequest = {
  readonly event: ReviewEvent | undefined;
  readonly commitSha: string | undefined;
};

type AttachmentDelivery =
  | { readonly kind: "none" }
  | { readonly kind: "same-write"; readonly write: GrantWrite }
  | { readonly kind: "follow-up-edit"; readonly files: readonly string[] };

type GhInvocation = {
  readonly verb: GhVerb;
  readonly route: GhRoute;
  readonly target: string | undefined;
  readonly passThrough: readonly string[];
  readonly body: BodySource | undefined;
  readonly closingComment: string | undefined;
  readonly attachments: AttachmentDelivery;
  readonly head: string | undefined;
  readonly session: string | undefined;
  readonly review: ReviewRequest;
};

type AttachedFiles = {
  readonly verb: GhVerb;
  readonly route: GhRoute;
  readonly files: readonly string[];
  readonly passThrough: readonly string[];
};

type GhInvocationRefusal =
  | GrantWriteRefusal
  | { readonly kind: "gh-verb-unsupported"; readonly verb: string }
  | { readonly kind: "gh-flag-refused"; readonly flag: string }
  | { readonly kind: "gh-attach-unsupported"; readonly verb: string }
  | { readonly kind: "gh-attach-not-local-file"; readonly attachment: string }
  | { readonly kind: "gh-attach-dry-run-refused" }
  | { readonly kind: "gh-body-given-twice" }
  | { readonly kind: "gh-review-event-ambiguous" }
  | { readonly kind: "gh-review-flag-unsupported"; readonly token: string };

const REFUSED_FLAGS: ReadonlySet<string> = new Set([
  "--repo",
  "-R",
  "--web",
  "-w",
  "--editor",
  "-e",
  "--admin",
  "--fill",
  "--fill-first",
  "--fill-verbose",
  "-f",
  "--template",
  "-T",
  "--recover",
]);

const ATTACH_FLAG = "--attach";

const HEAD_FLAGS: ReadonlySet<string> = new Set(["--head", "-H"]);

const BODY_FLAGS: ReadonlySet<string> = new Set(["--body", "-b"]);

const BODY_FILE_FLAGS: ReadonlySet<string> = new Set(["--body-file", "-F"]);

const CLOSING_COMMENT_FLAGS: ReadonlySet<string> = new Set(["--comment", "-c"]);

const REVIEW_EVENT_FLAGS: Readonly<Record<string, ReviewEvent>> = {
  "--approve": "approve",
  "-a": "approve",
  "--request-changes": "request-changes",
  "-r": "request-changes",
  "--comment": "comment",
  "-c": "comment",
};

const STANDARD_INPUT = "-";

const REPOSITORY_SHORT_FLAG = /^-[A-Za-z]*R/;

const URL_REFERENCE = /:\/\//;

const DRY_RUN_FLAG = "--dry-run";

type ScannedFlags = {
  readonly passThrough: readonly string[];
  readonly inlineBody: string | undefined;
  readonly bodyFile: string | undefined;
  readonly closingComment: string | undefined;
  readonly attachments: readonly string[];
  readonly head: string | undefined;
  readonly session: string | undefined;
  readonly commitSha: string | undefined;
  readonly reviewEvents: readonly ReviewEvent[];
};

type SingleValuedField = "inlineBody" | "bodyFile" | "session" | "commitSha" | "closingComment";

type OwnedField = SingleValuedField | "attachments";

type FlagWithValue = {
  readonly flagValue: string;
  readonly passed: readonly string[];
  readonly rest: readonly string[];
};

type ScanStep = {
  readonly tokens: readonly string[];
  readonly scanned: ScannedFlags;
  readonly route: GhRoute;
  readonly mayBeFlagValue: boolean;
};

const NOTHING_SCANNED: ScannedFlags = {
  passThrough: [],
  inlineBody: undefined,
  bodyFile: undefined,
  closingComment: undefined,
  attachments: [],
  head: undefined,
  session: undefined,
  commitSha: undefined,
  reviewEvents: [],
};

const isGhVerb = (verb: string): verb is GhVerb => Object.hasOwn(GH_ROUTES, verb);

const isReviewRoute = (route: GhRoute): boolean => route.check === "review-binding";

const ownedFieldOf = (route: GhRoute, flag: string): OwnedField | undefined => {
  if (flag === ATTACH_FLAG) return "attachments";
  if (BODY_FLAGS.has(flag)) return "inlineBody";
  if (BODY_FILE_FLAGS.has(flag)) return "bodyFile";
  if (flag === "--session") return "session";
  if (isReviewRoute(route) && flag === "--commit-sha") return "commitSha";
  if (route.closingComment && CLOSING_COMMENT_FLAGS.has(flag)) return "closingComment";
  return undefined;
};

const takeValue = (
  { token, flag, attachedValue }: FlagToken,
  remaining: readonly string[],
): Result<FlagWithValue, GhInvocationRefusal> => {
  if (attachedValue !== undefined) {
    return succeed({ flagValue: attachedValue, passed: [token], rest: remaining });
  }
  const [flagValue, ...rest] = remaining;
  if (flagValue === undefined) return fail({ kind: "gh-flag-value-missing", flag });
  return succeed({ flagValue, passed: [token, flagValue], rest });
};

const givesBody = (field: OwnedField): boolean => field === "inlineBody" || field === "bodyFile";

const recordOwned = (
  scanned: ScannedFlags,
  field: OwnedField,
  flagValue: string,
): Result<ScannedFlags, GhInvocationRefusal> => {
  if (field === "attachments") {
    return succeed({ ...scanned, attachments: [...scanned.attachments, flagValue] });
  }
  const bodyAlreadyGiven = scanned.inlineBody !== undefined || scanned.bodyFile !== undefined;
  if (givesBody(field) && bodyAlreadyGiven) return fail({ kind: "gh-body-given-twice" });
  return succeed({ ...scanned, [field]: flagValue });
};

const recordHead = (scanned: ScannedFlags, { flagValue, passed }: FlagWithValue): ScannedFlags => ({
  ...scanned,
  passThrough: [...scanned.passThrough, ...passed],
  head: flagValue,
});

const isBareFlag = ({ token, attachedValue }: FlagToken): boolean =>
  token.startsWith("-") && attachedValue === undefined;

const scanFlags = ({
  tokens,
  scanned,
  route,
  mayBeFlagValue,
}: ScanStep): Result<ScannedFlags, GhInvocationRefusal> => {
  const [token, ...remaining] = tokens;
  if (token === undefined) return succeed(scanned);
  const flagToken = flagTokenOf(token);
  if (REFUSED_FLAGS.has(flagToken.flag)) return fail({ kind: "gh-flag-refused", flag: flagToken.flag });
  if (!mayBeFlagValue && REPOSITORY_SHORT_FLAG.test(token)) {
    return fail({ kind: "gh-flag-refused", flag: "-R" });
  }
  const reviewEvent = isReviewRoute(route) ? REVIEW_EVENT_FLAGS[flagToken.flag] : undefined;
  if (reviewEvent !== undefined) {
    const reviewEvents = [...scanned.reviewEvents, reviewEvent];
    return scanFlags({
      tokens: remaining,
      scanned: { ...scanned, reviewEvents },
      route,
      mayBeFlagValue: false,
    });
  }
  const owned = ownedFieldOf(route, flagToken.flag);
  if (owned !== undefined) {
    const valued = takeValue(flagToken, remaining);
    if (valued.kind === "failure") return valued;
    const recorded = recordOwned(scanned, owned, valued.outcome.flagValue);
    if (recorded.kind === "failure") return recorded;
    return scanFlags({
      tokens: valued.outcome.rest,
      scanned: recorded.outcome,
      route,
      mayBeFlagValue: false,
    });
  }
  if (HEAD_FLAGS.has(flagToken.flag)) {
    const valued = takeValue(flagToken, remaining);
    if (valued.kind === "failure") return valued;
    const recorded = recordHead(scanned, valued.outcome);
    return scanFlags({
      tokens: valued.outcome.rest,
      scanned: recorded,
      route,
      mayBeFlagValue: false,
    });
  }
  const passThrough = [...scanned.passThrough, token];
  return scanFlags({
    tokens: remaining,
    scanned: { ...scanned, passThrough },
    route,
    mayBeFlagValue: isBareFlag(flagToken),
  });
};

const bodySourceOf = ({ inlineBody, bodyFile }: ScannedFlags): BodySource | undefined => {
  if (inlineBody !== undefined) return { kind: "inline", text: inlineBody };
  if (bodyFile === STANDARD_INPUT) return { kind: "standard-input" };
  if (bodyFile !== undefined) return { kind: "file", location: bodyFile };
  return undefined;
};

const targetOf = (tokens: readonly string[]): string | undefined => {
  const [first] = tokens;
  return first === undefined || first.startsWith("-") ? undefined : first;
};

const reviewRequestOf = (
  route: GhRoute,
  scanned: ScannedFlags,
): Result<ReviewRequest, GhInvocationRefusal> => {
  if (!isReviewRoute(route)) return succeed({ event: undefined, commitSha: undefined });
  if (scanned.reviewEvents.length !== 1) return fail({ kind: "gh-review-event-ambiguous" });
  const [target, ...unsupported] = scanned.passThrough;
  const leftover = target?.startsWith("-") === true ? target : unsupported[0];
  if (leftover !== undefined) return fail({ kind: "gh-review-flag-unsupported", token: leftover });
  return succeed({ event: scanned.reviewEvents[0], commitSha: scanned.commitSha });
};

const writtenUnderGrant = ({
  verb,
  files,
  passThrough,
}: AttachedFiles): Result<AttachmentDelivery, GhInvocationRefusal> => {
  if (!isGrantWriteVerb(verb)) return fail({ kind: "gh-attach-unsupported", verb });
  const write = parseGrantWrite({ verb, tokens: passThrough, files });
  return write.kind === "failure" ? write : succeed({ kind: "same-write", write: write.outcome });
};

const createsForReal = ({
  files,
  passThrough,
}: AttachedFiles): Result<AttachmentDelivery, GhInvocationRefusal> =>
  passThrough.some((token) => flagTokenOf(token).flag === DRY_RUN_FLAG)
    ? fail({ kind: "gh-attach-dry-run-refused" })
    : succeed({ kind: "follow-up-edit", files });

const attachmentDeliveryOf = (
  attached: AttachedFiles,
): Result<AttachmentDelivery, GhInvocationRefusal> => {
  if (attached.files.length === 0) return succeed({ kind: "none" });
  const remote = attached.files.find((file) => URL_REFERENCE.test(file));
  if (remote !== undefined) return fail({ kind: "gh-attach-not-local-file", attachment: remote });
  switch (attached.route.attachments) {
    case "unsupported":
      return fail({ kind: "gh-attach-unsupported", verb: attached.verb });
    case "same-write":
      return writtenUnderGrant(attached);
    case "follow-up-edit":
      return createsForReal(attached);
  }
};

const attachedFilesOf = (delivery: AttachmentDelivery): readonly string[] => {
  switch (delivery.kind) {
    case "none":
      return [];
    case "same-write":
      return delivery.write.files;
    case "follow-up-edit":
      return delivery.files;
  }
};

const parseGhInvocation = (
  commandArguments: readonly string[],
): Result<GhInvocation, GhInvocationRefusal> => {
  const [noun = "", action = "", ...tokens] = commandArguments;
  const verb = `${noun} ${action}`;
  if (!isGhVerb(verb)) return fail({ kind: "gh-verb-unsupported", verb: verb.trim() });
  const route: GhRoute = GH_ROUTES[verb];
  const scanned = scanFlags({
    tokens,
    scanned: NOTHING_SCANNED,
    route,
    mayBeFlagValue: false,
  });
  if (scanned.kind === "failure") return scanned;
  const attachments = attachmentDeliveryOf({
    verb,
    route,
    files: scanned.outcome.attachments,
    passThrough: scanned.outcome.passThrough,
  });
  if (attachments.kind === "failure") return attachments;
  const review = reviewRequestOf(route, scanned.outcome);
  if (review.kind === "failure") return review;
  return succeed({
    verb,
    route,
    target: targetOf(tokens),
    passThrough: [noun, action, ...scanned.outcome.passThrough],
    body: bodySourceOf(scanned.outcome),
    closingComment: scanned.outcome.closingComment,
    attachments: attachments.outcome,
    head: scanned.outcome.head,
    session: scanned.outcome.session,
    review: review.outcome,
  });
};

const supportedGhVerbs = (): readonly GhVerb[] => Object.keys(GH_ROUTES).filter(isGhVerb);

export {
  attachedFilesOf,
  parseGhInvocation,
  supportedGhVerbs,
  type AttachmentCarriage,
  type AttachmentDelivery,
  type BodySource,
  type GhInvocation,
  type GhInvocationRefusal,
  type GhRoute,
  type GhVerb,
};
