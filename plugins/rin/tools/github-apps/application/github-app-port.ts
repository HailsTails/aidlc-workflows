import type { RepositorySlug } from "../domain/repository-slug.ts";
import type { Result } from "../domain/result.ts";
import type { Secret } from "../domain/secret.ts";
import type { GitHubFailure } from "./github-failure.ts";

type AppAuthentication = { readonly appJwt: Secret };

type RepositoryInstallationLookup = AppAuthentication & { readonly repository: RepositorySlug };

type InstallationTokenRequest = RepositoryInstallationLookup & { readonly installationId: number };

type AuthenticatedApp = { readonly appSlug: string };

type RepositoryInstallation = { readonly installationId: number };

type AppNotInstalled = { readonly kind: "app-not-installed"; readonly repository: RepositorySlug };

type GitHubAppPort = {
  readonly readAuthenticatedApp: (
    authentication: AppAuthentication,
  ) => Promise<Result<AuthenticatedApp, GitHubFailure>>;
  readonly findRepositoryInstallation: (
    lookup: RepositoryInstallationLookup,
  ) => Promise<Result<RepositoryInstallation, GitHubFailure | AppNotInstalled>>;
  readonly createInstallationToken: (
    request: InstallationTokenRequest,
  ) => Promise<Result<Secret, GitHubFailure>>;
};

export type {
  AppAuthentication,
  AppNotInstalled,
  AuthenticatedApp,
  GitHubAppPort,
  InstallationTokenRequest,
  RepositoryInstallation,
  RepositoryInstallationLookup,
};
