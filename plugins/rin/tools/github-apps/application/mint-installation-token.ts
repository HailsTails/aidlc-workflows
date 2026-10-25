import type { AgentRole } from "../domain/agent-role.ts";
import type { RepositorySlug } from "../domain/repository-slug.ts";
import { fail, type Result } from "../domain/result.ts";
import type { Secret } from "../domain/secret.ts";
import { createAppJwt } from "./app-jwt.ts";
import type { ClockPort } from "./clock-port.ts";
import type { CredentialFailure, CredentialStorePort } from "./credential-store-port.ts";
import type { AppNotInstalled, GitHubAppPort } from "./github-app-port.ts";
import type { GitHubFailure } from "./github-failure.ts";
import type { JwtSigningFailed, Rs256SignerPort } from "./rs256-signer-port.ts";

type TokenMintingDependencies = {
  readonly credentialStore: CredentialStorePort;
  readonly appApi: GitHubAppPort;
  readonly clock: ClockPort;
  readonly signer: Rs256SignerPort;
};

type InstallationTokenGrant = {
  readonly role: AgentRole;
  readonly appSlug: string;
  readonly repository: RepositorySlug;
};

type AppIdentityMismatch = {
  readonly kind: "app-identity-mismatch";
  readonly role: AgentRole;
  readonly expectedAppSlug: string;
  readonly actualAppSlug: string;
};

type TokenFailure =
  CredentialFailure | JwtSigningFailed | GitHubFailure | AppNotInstalled | AppIdentityMismatch;

type TokenMinter = {
  readonly mintInstallationToken: (
    grant: InstallationTokenGrant,
  ) => Promise<Result<Secret, TokenFailure>>;
};

const createTokenMinter = ({
  credentialStore,
  appApi,
  clock,
  signer,
}: TokenMintingDependencies): TokenMinter => ({
  mintInstallationToken: async ({ role, appSlug, repository }) => {
    const credentials = await credentialStore.loadRoleCredentials({ role });
    if (credentials.kind === "failure") return credentials;
    const appJwt = createAppJwt({
      credentials: credentials.outcome,
      nowEpochSeconds: clock.nowEpochSeconds(),
      signer,
    });
    if (appJwt.kind === "failure") return appJwt;
    const app = await appApi.readAuthenticatedApp({ appJwt: appJwt.outcome });
    if (app.kind === "failure") return app;
    if (app.outcome.appSlug !== appSlug) {
      return fail({
        kind: "app-identity-mismatch",
        role,
        expectedAppSlug: appSlug,
        actualAppSlug: app.outcome.appSlug,
      });
    }
    const installation = await appApi.findRepositoryInstallation({
      appJwt: appJwt.outcome,
      repository,
    });
    if (installation.kind === "failure") return installation;
    return appApi.createInstallationToken({
      appJwt: appJwt.outcome,
      repository,
      installationId: installation.outcome.installationId,
    });
  },
});

export {
  createTokenMinter,
  type AppIdentityMismatch,
  type InstallationTokenGrant,
  type TokenFailure,
  type TokenMinter,
};
