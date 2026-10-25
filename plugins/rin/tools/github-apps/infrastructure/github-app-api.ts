import { z } from "zod";
import type {
  AppAuthentication,
  AppNotInstalled,
  AuthenticatedApp,
  GitHubAppPort,
  InstallationTokenRequest,
  RepositoryInstallation,
  RepositoryInstallationLookup,
} from "../application/github-app-port.ts";
import type { GitHubFailure } from "../application/github-failure.ts";
import { formatRepositorySlug, type RepositorySlug } from "../domain/repository-slug.ts";
import { fail, succeed, type Result } from "../domain/result.ts";
import { secret, type Secret } from "../domain/secret.ts";
import type { GitHubHttp, GitHubHttpRequest } from "./github-http.ts";

const GITHUB_NOT_FOUND_STATUS = 404;

const authenticatedAppSchema = z.object({ slug: z.string() });

const installationSchema = z.object({ id: z.number().int() });

const installationTokenSchema = z.object({ token: z.string().min(1) });

type AppApiDependencies = { readonly http: GitHubHttp };

type ValidatedRequest<Parsed> = GitHubHttpRequest &
  AppApiDependencies & { readonly responseSchema: z.ZodType<Parsed> };

type MissingInstallation = { readonly failure: GitHubFailure; readonly repository: RepositorySlug };

const requestValidated = async <Parsed>({
  http,
  responseSchema,
  ...request
}: ValidatedRequest<Parsed>): Promise<Result<Parsed, GitHubFailure>> => {
  const reply = await http.requestJson(request);
  if (reply.kind === "failure") return reply;
  const parsed = responseSchema.safeParse(reply.outcome);
  if (!parsed.success) {
    return fail({
      kind: "github-response-invalid",
      operation: request.operation,
      issues: parsed.error.message,
    });
  }
  return succeed(parsed.data);
};

const readAuthenticatedApp = async ({
  http,
  appJwt,
}: AppApiDependencies & AppAuthentication): Promise<Result<AuthenticatedApp, GitHubFailure>> => {
  const app = await requestValidated({
    http,
    operation: "read authenticated app",
    method: "GET",
    path: "/app",
    credential: appJwt,
    requestBody: undefined,
    responseSchema: authenticatedAppSchema,
  });
  if (app.kind === "failure") return app;
  return succeed({ appSlug: app.outcome.slug });
};

const classifyMissingInstallation = ({
  failure,
  repository,
}: MissingInstallation): GitHubFailure | AppNotInstalled =>
  failure.kind === "github-rejected" && failure.status === GITHUB_NOT_FOUND_STATUS
    ? { kind: "app-not-installed", repository }
    : failure;

const findRepositoryInstallation = async ({
  http,
  appJwt,
  repository,
}: AppApiDependencies & RepositoryInstallationLookup): Promise<
  Result<RepositoryInstallation, GitHubFailure | AppNotInstalled>
> => {
  const installation = await requestValidated({
    http,
    operation: "find repository installation",
    method: "GET",
    path: `/repos/${formatRepositorySlug(repository)}/installation`,
    credential: appJwt,
    requestBody: undefined,
    responseSchema: installationSchema,
  });
  if (installation.kind === "failure") {
    return fail(classifyMissingInstallation({ failure: installation.reason, repository }));
  }
  return succeed({ installationId: installation.outcome.id });
};

const createInstallationToken = async ({
  http,
  appJwt,
  repository,
  installationId,
}: AppApiDependencies & InstallationTokenRequest): Promise<Result<Secret, GitHubFailure>> => {
  const installationToken = await requestValidated({
    http,
    operation: "create installation token",
    method: "POST",
    path: `/app/installations/${String(installationId)}/access_tokens`,
    credential: appJwt,
    requestBody: { repositories: [repository.name] },
    responseSchema: installationTokenSchema,
  });
  if (installationToken.kind === "failure") return installationToken;
  return succeed(secret(installationToken.outcome.token));
};

const createGitHubAppApi = ({ http }: AppApiDependencies): GitHubAppPort => ({
  readAuthenticatedApp: (authentication) => readAuthenticatedApp({ http, ...authentication }),
  findRepositoryInstallation: (lookup) => findRepositoryInstallation({ http, ...lookup }),
  createInstallationToken: (request) => createInstallationToken({ http, ...request }),
});

export { createGitHubAppApi };
