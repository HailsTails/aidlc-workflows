import { describe, expect, it, vi } from "vitest";
import { fail, succeed } from "../domain/result.ts";
import { secret } from "../domain/secret.ts";
import type { CredentialStorePort } from "./credential-store-port.ts";
import type { GitHubAppPort } from "./github-app-port.ts";
import { createTokenMinter } from "./mint-installation-token.ts";

const repository = { owner: "HailsTails", name: "minutesarah-shop" };

const installationToken = secret("ghs_token");

const grant = { role: "author", appSlug: "rin-author", repository } as const;

const fakeDependencies = () => ({
  credentialStore: {
    loadRoleCredentials: vi
      .fn<CredentialStorePort["loadRoleCredentials"]>()
      .mockResolvedValue(succeed({ appId: "42", privateKey: secret("pem") })),
  },
  appApi: {
    readAuthenticatedApp: vi
      .fn<GitHubAppPort["readAuthenticatedApp"]>()
      .mockResolvedValue(succeed({ appSlug: "rin-author" })),
    findRepositoryInstallation: vi
      .fn<GitHubAppPort["findRepositoryInstallation"]>()
      .mockResolvedValue(succeed({ installationId: 77 })),
    createInstallationToken: vi
      .fn<GitHubAppPort["createInstallationToken"]>()
      .mockResolvedValue(succeed(installationToken)),
  },
  clock: { nowEpochSeconds: () => 1_700_000_000 },
  signer: { signRs256: () => succeed("signature") },
});

describe("mintInstallationToken", () => {
  it("mints a token scoped to the configured repository's installation", async () => {
    const dependencies = fakeDependencies();

    const minted = await createTokenMinter(dependencies).mintInstallationToken(grant);

    expect(minted).toEqual(succeed(installationToken));
    expect(dependencies.credentialStore.loadRoleCredentials).toHaveBeenCalledExactlyOnceWith({
      role: "author",
    });
    expect(dependencies.appApi.createInstallationToken).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ repository, installationId: 77 }),
    );
  });
});

describe("mintInstallationToken refusals", () => {
  it("refuses credentials that authenticate as a different app", async () => {
    const dependencies = fakeDependencies();
    dependencies.appApi.readAuthenticatedApp.mockResolvedValue(
      succeed({ appSlug: "rin-reviewer" }),
    );

    const minted = await createTokenMinter(dependencies).mintInstallationToken(grant);

    expect(minted).toEqual(
      fail({
        kind: "app-identity-mismatch",
        role: "author",
        expectedAppSlug: "rin-author",
        actualAppSlug: "rin-reviewer",
      }),
    );
    expect(dependencies.appApi.createInstallationToken).not.toHaveBeenCalled();
  });

  it("reports an app that is not installed on the repository", async () => {
    const dependencies = fakeDependencies();
    dependencies.appApi.findRepositoryInstallation.mockResolvedValue(
      fail({ kind: "app-not-installed", repository }),
    );

    const minted = await createTokenMinter(dependencies).mintInstallationToken(grant);

    expect(minted).toEqual(fail({ kind: "app-not-installed", repository }));
  });

  it("passes a credential failure through without calling GitHub", async () => {
    const dependencies = fakeDependencies();
    dependencies.credentialStore.loadRoleCredentials.mockResolvedValue(
      fail({ kind: "credentials-unreadable", path: "store/credentials.json" }),
    );

    const minted = await createTokenMinter(dependencies).mintInstallationToken(grant);

    expect(minted).toEqual(
      fail({ kind: "credentials-unreadable", path: "store/credentials.json" }),
    );
    expect(dependencies.appApi.readAuthenticatedApp).not.toHaveBeenCalled();
  });
});
