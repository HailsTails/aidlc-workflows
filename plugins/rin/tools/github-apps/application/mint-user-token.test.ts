import { describe, expect, it, vi } from "vitest";
import { fail, succeed } from "../domain/result.ts";
import { secret } from "../domain/secret.ts";
import type { UserAuthorisationSettingsPort } from "./credential-store-port.ts";
import { createUserTokenMinter } from "./mint-user-token.ts";
import type { UserAuthorisationPort } from "./user-authorisation-port.ts";
import type { LockRelease } from "./exclusive-lock-port.ts";
import type { UserGrantStorePort } from "./user-grant-store-port.ts";

const NOW = 1_700_000_000;

const request = { role: "author" } as const;

const storedAccessToken = secret("stored-access-token");

const storedRefreshToken = secret("stored-refresh-token");

const renewedAccessToken = secret("renewed-access-token");

const renewedRefreshToken = secret("renewed-refresh-token");

const usableGrant = {
  accessToken: storedAccessToken,
  accessTokenExpiresAtEpochSeconds: NOW + 3_600,
  refreshToken: storedRefreshToken,
  refreshTokenExpiresAtEpochSeconds: NOW + 86_400,
};

const staleGrant = { ...usableGrant, accessTokenExpiresAtEpochSeconds: NOW + 60 };

const expiredGrant = {
  ...usableGrant,
  accessTokenExpiresAtEpochSeconds: NOW - 86_400,
  refreshTokenExpiresAtEpochSeconds: NOW - 1,
};

const renewedGrant = {
  accessToken: renewedAccessToken,
  accessTokenExpiresAtEpochSeconds: NOW + 28_800,
  refreshToken: renewedRefreshToken,
  refreshTokenExpiresAtEpochSeconds: NOW + 15_897_600,
};

const release = vi.fn<LockRelease>();

const fakeDependencies = () => ({
  authorisationSettings: {
    loadUserAuthorisationSettings: vi
      .fn<UserAuthorisationSettingsPort["loadUserAuthorisationSettings"]>()
      .mockResolvedValue(succeed({ clientId: "Ov23client", scope: "repo" })),
  },
  userAuthorisation: {
    requestDeviceCode: vi.fn<UserAuthorisationPort["requestDeviceCode"]>(),
    redeemDeviceCode: vi.fn<UserAuthorisationPort["redeemDeviceCode"]>(),
    refreshGrant: vi.fn<UserAuthorisationPort["refreshGrant"]>().mockResolvedValue(
      succeed({
        accessToken: renewedAccessToken,
        accessTokenLifetimeSeconds: 28_800,
        refreshToken: renewedRefreshToken,
        refreshTokenLifetimeSeconds: 15_897_600,
      }),
    ),
  },
  userGrantStore: {
    load: vi.fn<UserGrantStorePort["load"]>().mockResolvedValue(succeed(staleGrant)),
    save: vi.fn<UserGrantStorePort["save"]>().mockResolvedValue(succeed(undefined)),
    lock: vi.fn<UserGrantStorePort["lock"]>().mockResolvedValue(succeed(release)),
  },
  clock: { nowEpochSeconds: () => NOW },
});

describe("mintUserToken with a usable grant", () => {
  it("hands out the stored access token without locking or refreshing", async () => {
    const dependencies = fakeDependencies();
    dependencies.userGrantStore.load.mockResolvedValue(succeed(usableGrant));

    const minted = await createUserTokenMinter(dependencies).mintUserToken(request);

    expect(minted).toEqual(succeed(storedAccessToken));
    expect(dependencies.userGrantStore.load).toHaveBeenCalledExactlyOnceWith({
      role: "author",
    });
    expect(dependencies.userGrantStore.lock).not.toHaveBeenCalled();
    expect(dependencies.userAuthorisation.refreshGrant).not.toHaveBeenCalled();
  });
});

describe("mintUserToken with a stale access token", () => {
  it("refreshes under the lock, saves the renewed grant and hands out its token", async () => {
    const dependencies = fakeDependencies();

    const minted = await createUserTokenMinter(dependencies).mintUserToken(request);

    expect(minted).toEqual(succeed(renewedAccessToken));
    expect(dependencies.userGrantStore.lock).toHaveBeenCalledExactlyOnceWith({ role: "author" });
    expect(release.mock.invocationCallOrder.at(-1)).toBeGreaterThan(
      dependencies.userGrantStore.save.mock.invocationCallOrder.at(-1) ?? Number.POSITIVE_INFINITY,
    );
    expect(dependencies.userAuthorisation.refreshGrant).toHaveBeenCalledExactlyOnceWith({
      clientId: "Ov23client",
      refreshToken: storedRefreshToken,
    });
    expect(dependencies.userGrantStore.save).toHaveBeenCalledExactlyOnceWith({
      role: "author",
      grant: renewedGrant,
    });
  });

  it("uses the grant another session renewed while this one waited for the lock", async () => {
    const dependencies = fakeDependencies();
    dependencies.userGrantStore.load
      .mockResolvedValueOnce(succeed(staleGrant))
      .mockResolvedValueOnce(succeed(renewedGrant));

    const minted = await createUserTokenMinter(dependencies).mintUserToken(request);

    expect(minted).toEqual(succeed(renewedAccessToken));
    expect(dependencies.userAuthorisation.refreshGrant).not.toHaveBeenCalled();
    expect(dependencies.userGrantStore.save).not.toHaveBeenCalled();
  });

  it("never reveals a token when the outcome is serialised", async () => {
    const dependencies = fakeDependencies();

    const minted = await createUserTokenMinter(dependencies).mintUserToken(request);

    expect(JSON.stringify(minted)).not.toContain("renewed-access-token");
  });
});

describe("mintUserToken refusals", () => {
  it("reports a missing grant without falling back to another identity", async () => {
    const dependencies = fakeDependencies();
    dependencies.userGrantStore.load.mockResolvedValue(
      fail({ kind: "user-grant-missing", path: "store/author.user-grant.json" }),
    );

    const minted = await createUserTokenMinter(dependencies).mintUserToken(request);

    expect(minted).toEqual(
      fail({ kind: "user-grant-missing", path: "store/author.user-grant.json" }),
    );
  });

  it("reports a grant whose refresh token has expired without calling GitHub", async () => {
    const dependencies = fakeDependencies();
    dependencies.userGrantStore.load.mockResolvedValue(succeed(expiredGrant));

    const minted = await createUserTokenMinter(dependencies).mintUserToken(request);

    expect(minted).toEqual(fail({ kind: "user-grant-expired" }));
    expect(dependencies.userAuthorisation.refreshGrant).not.toHaveBeenCalled();
  });

  it("reports a role with no user authorisation before taking the lock", async () => {
    const dependencies = fakeDependencies();
    dependencies.authorisationSettings.loadUserAuthorisationSettings.mockResolvedValue(
      fail({
        kind: "user-authorisation-unconfigured",
        role: "author",
        path: "store/credentials.json",
      }),
    );

    const minted = await createUserTokenMinter(dependencies).mintUserToken(request);

    expect(minted).toEqual(
      fail({
        kind: "user-authorisation-unconfigured",
        role: "author",
        path: "store/credentials.json",
      }),
    );
    expect(dependencies.userGrantStore.lock).not.toHaveBeenCalled();
  });

  it("reports a lock it could not take", async () => {
    const dependencies = fakeDependencies();
    dependencies.userGrantStore.lock.mockResolvedValue(
      fail({ kind: "user-grant-lock-unavailable", path: "store/author.user-grant.lock" }),
    );

    const minted = await createUserTokenMinter(dependencies).mintUserToken(request);

    expect(minted).toEqual(
      fail({ kind: "user-grant-lock-unavailable", path: "store/author.user-grant.lock" }),
    );
  });

  it("reports a refresh token GitHub rejected and saves nothing", async () => {
    const dependencies = fakeDependencies();
    dependencies.userAuthorisation.refreshGrant.mockResolvedValue(
      fail({ kind: "refresh-token-rejected" }),
    );

    const minted = await createUserTokenMinter(dependencies).mintUserToken(request);

    expect(minted).toEqual(fail({ kind: "refresh-token-rejected" }));
    expect(dependencies.userGrantStore.save).not.toHaveBeenCalled();
  });

  it("uses the grant another session saved when GitHub rejects a refresh token that session already spent", async () => {
    const dependencies = fakeDependencies();
    dependencies.userAuthorisation.refreshGrant.mockResolvedValue(
      fail({ kind: "refresh-token-rejected" }),
    );
    dependencies.userGrantStore.load
      .mockResolvedValueOnce(succeed(staleGrant))
      .mockResolvedValueOnce(succeed(staleGrant))
      .mockResolvedValueOnce(succeed(renewedGrant));

    const minted = await createUserTokenMinter(dependencies).mintUserToken(request);

    expect(minted).toEqual(succeed(renewedAccessToken));
    expect(dependencies.userGrantStore.save).not.toHaveBeenCalled();
    expect(release).toHaveBeenCalled();
  });

  it("still reports the rejection when the grant on disk changed but is not usable", async () => {
    const dependencies = fakeDependencies();
    dependencies.userAuthorisation.refreshGrant.mockResolvedValue(
      fail({ kind: "refresh-token-rejected" }),
    );
    dependencies.userGrantStore.load
      .mockResolvedValueOnce(succeed(staleGrant))
      .mockResolvedValueOnce(succeed(staleGrant))
      .mockResolvedValueOnce(succeed({ ...renewedGrant, accessTokenExpiresAtEpochSeconds: NOW }));

    const minted = await createUserTokenMinter(dependencies).mintUserToken(request);

    expect(minted).toEqual(fail({ kind: "refresh-token-rejected" }));
  });

  it("reports a renewed grant it could not save", async () => {
    const dependencies = fakeDependencies();
    dependencies.userGrantStore.save.mockResolvedValue(
      fail({
        kind: "user-grant-unwritable",
        path: "store/author.user-grant.json",
        detail: "EACCES",
      }),
    );

    const minted = await createUserTokenMinter(dependencies).mintUserToken(request);

    expect(minted).toEqual(
      fail({
        kind: "user-grant-unwritable",
        path: "store/author.user-grant.json",
        detail: "EACCES",
      }),
    );
  });
});
