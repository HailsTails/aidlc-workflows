import type { AgentRole } from "./agent-role.ts";
import type { InstallationPermissions } from "./installation-permissions.ts";
import type { ReviewEvent } from "./pull-request.ts";
import { fail, succeed, type Result } from "./result.ts";

type BodyStamping = "required" | "stamped" | "when-given" | "verbatim";

type VerbCheck = "none" | "close-guard" | "review-binding";

type GhRoute = {
  readonly role: AgentRole;
  readonly permissions: InstallationPermissions | undefined;
  readonly body: BodyStamping;
  readonly closingComment: boolean;
  readonly check: VerbCheck;
};

const ISSUES_ONLY = { issues: "write" } as const;

const CONVERSATION = { issues: "write", pull_requests: "write" } as const;

const authorRoute = (route: Partial<GhRoute>): GhRoute => ({
  role: "author",
  permissions: undefined,
  body: "verbatim",
  closingComment: false,
  check: "none",
  ...route,
});

const GH_ROUTES = {
  "pr create": authorRoute({ body: "required" }),
  "pr edit": authorRoute({ body: "when-given" }),
  "pr comment": authorRoute({ permissions: CONVERSATION, body: "required" }),
  "pr ready": authorRoute({}),
  "pr merge": authorRoute({}),
  "pr close": authorRoute({ closingComment: true, check: "close-guard" }),
  "pr review": { ...authorRoute({ body: "stamped", check: "review-binding" }), role: "reviewer" },
  "issue create": authorRoute({ permissions: ISSUES_ONLY, body: "required" }),
  "issue edit": authorRoute({ permissions: ISSUES_ONLY, body: "when-given" }),
  "issue comment": authorRoute({ permissions: CONVERSATION, body: "required" }),
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

type GhInvocation = {
  readonly verb: GhVerb;
  readonly route: GhRoute;
  readonly target: string | undefined;
  readonly passThrough: readonly string[];
  readonly body: BodySource | undefined;
  readonly closingComment: string | undefined;
  readonly attachments: readonly string[];
  readonly head: string | undefined;
  readonly session: string | undefined;
  readonly review: ReviewRequest;
};

type GhInvocationRefusal =
  | { readonly kind: "gh-verb-unsupported"; readonly verb: string }
  | { readonly kind: "gh-flag-refused"; readonly flag: string }
  | { readonly kind: "gh-flag-value-missing"; readonly flag: string }
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

type OwnedField = "inlineBody" | "bodyFile" | "session" | "commitSha" | "closingComment";

type ObservedField = "attachments" | "head";

type FlagToken = {
  readonly token: string;
  readonly flag: string;
  readonly attachedValue: string | undefined;
};

type FlagWithValue = {
  readonly flagValue: string;
  readonly passed: readonly string[];
  readonly rest: readonly string[];
};

type ScanStep = {
  readonly tokens: readonly string[];
  readonly scanned: ScannedFlags;
  readonly route: GhRoute;
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

const flagTokenOf = (token: string): FlagToken => {
  const separator = token.indexOf("=");
  return token.startsWith("--") && separator > 0
    ? { token, flag: token.slice(0, separator), attachedValue: token.slice(separator + 1) }
    : { token, flag: token, attachedValue: undefined };
};

const isReviewRoute = (route: GhRoute): boolean => route.check === "review-binding";

const ownedFieldOf = (route: GhRoute, flag: string): OwnedField | undefined => {
  if (BODY_FLAGS.has(flag)) return "inlineBody";
  if (BODY_FILE_FLAGS.has(flag)) return "bodyFile";
  if (flag === "--session") return "session";
  if (isReviewRoute(route) && flag === "--commit-sha") return "commitSha";
  if (route.closingComment && CLOSING_COMMENT_FLAGS.has(flag)) return "closingComment";
  return undefined;
};

const observedFieldOf = (flag: string): ObservedField | undefined => {
  if (flag === "--attach") return "attachments";
  if (flag === "--head" || flag === "-H") return "head";
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
  const bodyAlreadyGiven = scanned.inlineBody !== undefined || scanned.bodyFile !== undefined;
  if (givesBody(field) && bodyAlreadyGiven) return fail({ kind: "gh-body-given-twice" });
  return succeed({ ...scanned, [field]: flagValue });
};

const recordObserved = (
  scanned: ScannedFlags,
  field: ObservedField,
  { flagValue, passed }: FlagWithValue,
): ScannedFlags => ({
  ...scanned,
  passThrough: [...scanned.passThrough, ...passed],
  ...(field === "attachments"
    ? { attachments: [...scanned.attachments, flagValue] }
    : { head: flagValue }),
});

const scanFlags = ({ tokens, scanned, route }: ScanStep): Result<ScannedFlags, GhInvocationRefusal> => {
  const [token, ...remaining] = tokens;
  if (token === undefined) return succeed(scanned);
  const flagToken = flagTokenOf(token);
  if (REFUSED_FLAGS.has(flagToken.flag)) return fail({ kind: "gh-flag-refused", flag: flagToken.flag });
  const reviewEvent = isReviewRoute(route) ? REVIEW_EVENT_FLAGS[flagToken.flag] : undefined;
  if (reviewEvent !== undefined) {
    const reviewEvents = [...scanned.reviewEvents, reviewEvent];
    return scanFlags({ tokens: remaining, scanned: { ...scanned, reviewEvents }, route });
  }
  const owned = ownedFieldOf(route, flagToken.flag);
  if (owned !== undefined) {
    const valued = takeValue(flagToken, remaining);
    if (valued.kind === "failure") return valued;
    const recorded = recordOwned(scanned, owned, valued.outcome.flagValue);
    if (recorded.kind === "failure") return recorded;
    return scanFlags({ tokens: valued.outcome.rest, scanned: recorded.outcome, route });
  }
  const observed = observedFieldOf(flagToken.flag);
  if (observed !== undefined) {
    const valued = takeValue(flagToken, remaining);
    if (valued.kind === "failure") return valued;
    const recorded = recordObserved(scanned, observed, valued.outcome);
    return scanFlags({ tokens: valued.outcome.rest, scanned: recorded, route });
  }
  const passThrough = [...scanned.passThrough, token];
  return scanFlags({ tokens: remaining, scanned: { ...scanned, passThrough }, route });
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

const parseGhInvocation = (
  commandArguments: readonly string[],
): Result<GhInvocation, GhInvocationRefusal> => {
  const [noun = "", action = "", ...tokens] = commandArguments;
  const verb = `${noun} ${action}`;
  if (!isGhVerb(verb)) return fail({ kind: "gh-verb-unsupported", verb: verb.trim() });
  const route: GhRoute = GH_ROUTES[verb];
  const scanned = scanFlags({ tokens, scanned: NOTHING_SCANNED, route });
  if (scanned.kind === "failure") return scanned;
  const review = reviewRequestOf(route, scanned.outcome);
  if (review.kind === "failure") return review;
  return succeed({
    verb,
    route,
    target: targetOf(tokens),
    passThrough: [noun, action, ...scanned.outcome.passThrough],
    body: bodySourceOf(scanned.outcome),
    closingComment: scanned.outcome.closingComment,
    attachments: scanned.outcome.attachments,
    head: scanned.outcome.head,
    session: scanned.outcome.session,
    review: review.outcome,
  });
};

const supportedGhVerbs = (): readonly GhVerb[] => Object.keys(GH_ROUTES).filter(isGhVerb);

export {
  parseGhInvocation,
  supportedGhVerbs,
  type BodySource,
  type GhInvocation,
  type GhInvocationRefusal,
  type GhRoute,
  type GhVerb,
};
