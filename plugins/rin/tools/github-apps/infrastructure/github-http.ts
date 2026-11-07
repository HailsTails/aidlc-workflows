import type { GitHubFailure } from "../application/github-failure.ts";
import { fail, succeed, type Result } from "../domain/result.ts";
import type { Secret } from "../domain/secret.ts";
import { parseJsonText } from "./json-text.ts";

const GITHUB_API_ORIGIN = "https://api.github.com";

const GITHUB_API_VERSION = "2022-11-28";

const REJECTION_DETAIL_LIMIT = 500;

const REQUEST_TIMEOUT_MILLISECONDS = 30_000;

type FetchResource = (url: string, init: RequestInit) => Promise<Response>;

type GitHubHttpRequest = {
  readonly operation: string;
  readonly method: "GET" | "POST";
  readonly path: string;
  readonly credential: Secret;
  readonly requestBody: unknown;
};

type GitHubHttp = {
  readonly requestJson: (request: GitHubHttpRequest) => Promise<Result<unknown, GitHubFailure>>;
};

type GitHubHttpDependencies = { readonly fetchResource: FetchResource };

const headersFor = (credential: Secret): readonly [string, string][] => [
  ["Accept", "application/vnd.github+json"],
  ["Authorization", `Bearer ${credential.reveal()}`],
  ["Content-Type", "application/json"],
  ["User-Agent", "rin-github-apps"],
  ["X-GitHub-Api-Version", GITHUB_API_VERSION],
];

type Dispatch = GitHubHttpDependencies & { readonly request: GitHubHttpRequest };

type ReceivedResponse = {
  readonly ok: boolean;
  readonly status: number;
  readonly responseText: string;
};

const send = async ({
  fetchResource,
  request,
}: Dispatch): Promise<Result<ReceivedResponse, GitHubFailure>> => {
  try {
    const response = await fetchResource(`${GITHUB_API_ORIGIN}${request.path}`, {
      method: request.method,
      headers: [...headersFor(request.credential)],
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MILLISECONDS),
      ...(request.requestBody === undefined ? {} : { body: JSON.stringify(request.requestBody) }),
    });
    return succeed({ ok: response.ok, status: response.status, responseText: await response.text() });
  } catch {
    return fail({ kind: "github-unreachable", operation: request.operation });
  }
};

const createGitHubHttp = ({ fetchResource }: GitHubHttpDependencies): GitHubHttp => ({
  requestJson: async (request) => {
    const response = await send({ fetchResource, request });
    if (response.kind === "failure") return response;
    const { responseText } = response.outcome;
    if (!response.outcome.ok) {
      return fail({
        kind: "github-rejected",
        operation: request.operation,
        status: response.outcome.status,
        detail: responseText.slice(0, REJECTION_DETAIL_LIMIT),
      });
    }
    const parsed = parseJsonText(responseText);
    if (parsed.kind === "failure") {
      return fail({
        kind: "github-response-invalid",
        operation: request.operation,
        issues: "response is not JSON",
      });
    }
    return parsed;
  },
});

const createDefaultGitHubHttp = (): GitHubHttp => createGitHubHttp({ fetchResource: fetch });

export {
  createDefaultGitHubHttp,
  createGitHubHttp,
  type FetchResource,
  type GitHubHttp,
  type GitHubHttpRequest,
};
