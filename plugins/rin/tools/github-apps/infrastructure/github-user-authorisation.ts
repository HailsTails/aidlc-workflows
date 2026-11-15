import { z } from "zod";
import type { GitHubFailure } from "../application/github-failure.ts";
import type {
  DeviceAuthorisation,
  DeviceCodePoll,
  DeviceCodeRedemption,
  DeviceCodeRefused,
  DeviceCodeRequest,
  GrantRefresh,
  RefreshTokenRejected,
  UserAuthorisationPort,
  UserAuthorisationRefused,
} from "../application/user-authorisation-port.ts";
import { fail, succeed, type Result } from "../domain/result.ts";
import { secret } from "../domain/secret.ts";
import type { IssuedUserGrant } from "../domain/user-grant.ts";
import type { FetchResource } from "./github-http.ts";
import { parseJsonText } from "./json-text.ts";

const DEVICE_CODE_URL = "https://github.com/login/device/code";

const ACCESS_TOKEN_URL = "https://github.com/login/oauth/access_token";

const DEVICE_CODE_GRANT_TYPE = "urn:ietf:params:oauth:grant-type:device_code";

const REJECTION_DETAIL_LIMIT = 500;

const UNKNOWN_CLIENT_STATUS = 404;

const REQUEST_TIMEOUT_MILLISECONDS = 30_000;

const REQUEST_DEVICE_CODE = "request a device code";

const REDEEM_DEVICE_CODE = "redeem the device code";

const REFRESH_USER_GRANT = "refresh the user grant";

const HEADERS: readonly [string, string][] = [
  ["Accept", "application/json"],
  ["Content-Type", "application/json"],
  ["User-Agent", "rin-github-apps"],
];

const SHARED_REFUSALS: Readonly<Record<string, UserAuthorisationRefused>> = {
  device_flow_disabled: { kind: "device-flow-disabled" },
  incorrect_client_credentials: { kind: "oauth-client-rejected" },
};

const NO_SPECIFIC_REFUSALS: Readonly<Record<string, never>> = {};

const DEVICE_CODE_REFUSALS: Readonly<Record<string, DeviceCodeRefused>> = {
  expired_token: { kind: "device-code-expired" },
  token_expired: { kind: "device-code-expired" },
  bad_verification_code: { kind: "device-code-expired" },
  access_denied: { kind: "device-authorisation-denied" },
};

const REFRESH_REFUSALS: Readonly<Record<string, RefreshTokenRejected>> = {
  bad_refresh_token: { kind: "refresh-token-rejected" },
};

const deviceCodeSchema = z.object({
  device_code: z.string().min(1),
  user_code: z.string().min(1),
  verification_uri: z.string().min(1),
  expires_in: z.number().int().positive(),
  interval: z.number().int().positive(),
});

const grantSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().int().positive(),
  refresh_token: z.string().min(1),
  refresh_token_expires_in: z.number().int().positive(),
});

const errorReplySchema = z.object({
  error: z.string().min(1),
  error_description: z.string().optional(),
  interval: z.number().int().positive().optional(),
});

type GitHubUserAuthorisationDependencies = { readonly fetchResource: FetchResource };

type ErrorReply = z.infer<typeof errorReplySchema>;

type ErrorAnswer = { readonly operation: string; readonly reply: ErrorReply };

type Post = GitHubUserAuthorisationDependencies & {
  readonly operation: string;
  readonly url: string;
  readonly requestBody: Readonly<Record<string, string>>;
};

type ReceivedResponse = {
  readonly ok: boolean;
  readonly status: number;
  readonly responseText: string;
};

type Exchange<Parsed, Outcome, Specific> = Post & {
  readonly successSchema: z.ZodType<Parsed>;
  readonly acceptSuccess: (parsed: Parsed) => Outcome;
  readonly specificRefusals: Readonly<Record<string, Specific>>;
  readonly interpretProgress: (answer: ErrorAnswer) => Result<Outcome, GitHubFailure> | undefined;
};

type Refusals<Specific> = ErrorAnswer & { readonly specificRefusals: Readonly<Record<string, Specific>> };

type RefusalLookup<Refusal> = {
  readonly refusals: Readonly<Record<string, Refusal>>;
  readonly error: string;
};

type ValidatedReply<Parsed> = {
  readonly operation: string;
  readonly reply: unknown;
  readonly schema: z.ZodType<Parsed>;
};

const send = async ({
  fetchResource,
  operation,
  url,
  requestBody,
}: Post): Promise<Result<ReceivedResponse, GitHubFailure>> => {
  try {
    const response = await fetchResource(url, {
      method: "POST",
      headers: [...HEADERS],
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MILLISECONDS),
      body: JSON.stringify(requestBody),
    });
    return succeed({ ok: response.ok, status: response.status, responseText: await response.text() });
  } catch {
    return fail({ kind: "github-unreachable", operation });
  }
};

const postJson = async (
  post: Post,
): Promise<Result<unknown, GitHubFailure | UserAuthorisationRefused>> => {
  const response = await send(post);
  if (response.kind === "failure") return response;
  const { ok, status, responseText } = response.outcome;
  if (status === UNKNOWN_CLIENT_STATUS) return fail({ kind: "oauth-client-rejected" });
  if (!ok) {
    return fail({
      kind: "github-rejected",
      operation: post.operation,
      status,
      detail: responseText.slice(0, REJECTION_DETAIL_LIMIT),
    });
  }
  const parsed = parseJsonText(responseText);
  if (parsed.kind === "failure") {
    return fail({
      kind: "github-response-invalid",
      operation: post.operation,
      issues: "response is not JSON",
    });
  }
  return parsed;
};

const validateReply = <Parsed>({
  operation,
  reply,
  schema,
}: ValidatedReply<Parsed>): Result<Parsed, GitHubFailure> => {
  const parsed = schema.safeParse(reply);
  if (!parsed.success) {
    return fail({ kind: "github-response-invalid", operation, issues: parsed.error.message });
  }
  return succeed(parsed.data);
};

const lookupRefusal = <Refusal>({ refusals, error }: RefusalLookup<Refusal>): Refusal | undefined =>
  Object.hasOwn(refusals, error) ? refusals[error] : undefined;

const unrecognisedRefusal = ({ operation, reply }: ErrorAnswer): UserAuthorisationRefused => ({
  kind: "oauth-request-refused",
  operation,
  error: reply.error,
  description: reply.error_description ?? "",
});

const refusalFor = <Specific>({
  operation,
  reply,
  specificRefusals,
}: Refusals<Specific>): Specific | UserAuthorisationRefused =>
  lookupRefusal({ refusals: specificRefusals, error: reply.error }) ??
  lookupRefusal({ refusals: SHARED_REFUSALS, error: reply.error }) ??
  unrecognisedRefusal({ operation, reply });

const answerError = <Parsed, Outcome, Specific>(
  exchange: Exchange<Parsed, Outcome, Specific>,
  reply: ErrorReply,
): Result<Outcome, GitHubFailure | UserAuthorisationRefused | Specific> =>
  exchange.interpretProgress({ operation: exchange.operation, reply }) ??
  fail(
    refusalFor({
      operation: exchange.operation,
      reply,
      specificRefusals: exchange.specificRefusals,
    }),
  );

const answerSuccess = <Parsed, Outcome, Specific>(
  exchange: Exchange<Parsed, Outcome, Specific>,
  reply: unknown,
): Result<Outcome, GitHubFailure> => {
  const validated = validateReply({
    operation: exchange.operation,
    reply,
    schema: exchange.successSchema,
  });
  if (validated.kind === "failure") return validated;
  return succeed(exchange.acceptSuccess(validated.outcome));
};

const runExchange = async <Parsed, Outcome, Specific>(
  exchange: Exchange<Parsed, Outcome, Specific>,
): Promise<Result<Outcome, GitHubFailure | UserAuthorisationRefused | Specific>> => {
  const reply = await postJson(exchange);
  if (reply.kind === "failure") return reply;
  const errorReply = errorReplySchema.safeParse(reply.outcome);
  return errorReply.success
    ? answerError(exchange, errorReply.data)
    : answerSuccess(exchange, reply.outcome);
};

const noProgress = (): undefined => undefined;

const interpretPollProgress = ({
  operation,
  reply,
}: ErrorAnswer): Result<DeviceCodePoll, GitHubFailure> | undefined => {
  if (reply.error === "authorization_pending") return succeed({ kind: "pending" });
  if (reply.error !== "slow_down") return undefined;
  if (reply.interval === undefined) {
    return fail({
      kind: "github-response-invalid",
      operation,
      issues: "slow_down reply has no interval",
    });
  }
  return succeed({ kind: "slow-down", pollIntervalSeconds: reply.interval });
};

const toDeviceAuthorisation = (reply: z.infer<typeof deviceCodeSchema>): DeviceAuthorisation => ({
  deviceCode: secret(reply.device_code),
  userCode: reply.user_code,
  verificationUri: reply.verification_uri,
  expiresInSeconds: reply.expires_in,
  pollIntervalSeconds: reply.interval,
});

const toIssuedGrant = (reply: z.infer<typeof grantSchema>): IssuedUserGrant => ({
  accessToken: secret(reply.access_token),
  accessTokenLifetimeSeconds: reply.expires_in,
  refreshToken: secret(reply.refresh_token),
  refreshTokenLifetimeSeconds: reply.refresh_token_expires_in,
});

const toGrantedPoll = (reply: z.infer<typeof grantSchema>): DeviceCodePoll => ({
  kind: "granted",
  issued: toIssuedGrant(reply),
});

const requestDeviceCode =
  ({ fetchResource }: GitHubUserAuthorisationDependencies) =>
  ({ clientId, scope }: DeviceCodeRequest) =>
    runExchange({
      fetchResource,
      operation: REQUEST_DEVICE_CODE,
      url: DEVICE_CODE_URL,
      requestBody: { client_id: clientId, scope },
      successSchema: deviceCodeSchema,
      acceptSuccess: toDeviceAuthorisation,
      specificRefusals: NO_SPECIFIC_REFUSALS,
      interpretProgress: noProgress,
    });

const redeemDeviceCode =
  ({ fetchResource }: GitHubUserAuthorisationDependencies) =>
  ({ clientId, deviceCode }: DeviceCodeRedemption) =>
    runExchange({
      fetchResource,
      operation: REDEEM_DEVICE_CODE,
      url: ACCESS_TOKEN_URL,
      requestBody: {
        client_id: clientId,
        device_code: deviceCode.reveal(),
        grant_type: DEVICE_CODE_GRANT_TYPE,
      },
      successSchema: grantSchema,
      acceptSuccess: toGrantedPoll,
      specificRefusals: DEVICE_CODE_REFUSALS,
      interpretProgress: interpretPollProgress,
    });

const refreshGrant =
  ({ fetchResource }: GitHubUserAuthorisationDependencies) =>
  ({ clientId, refreshToken }: GrantRefresh) =>
    runExchange({
      fetchResource,
      operation: REFRESH_USER_GRANT,
      url: ACCESS_TOKEN_URL,
      requestBody: {
        client_id: clientId,
        grant_type: "refresh_token",
        refresh_token: refreshToken.reveal(),
      },
      successSchema: grantSchema,
      acceptSuccess: toIssuedGrant,
      specificRefusals: REFRESH_REFUSALS,
      interpretProgress: noProgress,
    });

const createGitHubUserAuthorisation = (
  dependencies: GitHubUserAuthorisationDependencies,
): UserAuthorisationPort => ({
  requestDeviceCode: requestDeviceCode(dependencies),
  redeemDeviceCode: redeemDeviceCode(dependencies),
  refreshGrant: refreshGrant(dependencies),
});

const createDefaultGitHubUserAuthorisation = (): UserAuthorisationPort =>
  createGitHubUserAuthorisation({ fetchResource: fetch });

export {
  createDefaultGitHubUserAuthorisation,
  createGitHubUserAuthorisation,
  type GitHubUserAuthorisationDependencies,
};
