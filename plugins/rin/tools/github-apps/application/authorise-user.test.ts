import { describe, expect, it, vi } from "vitest";
import { fail, succeed } from "../domain/result.ts";
import { secret } from "../domain/secret.ts";
import { createUserAuthoriser, type DevicePrompt } from "./authorise-user.ts";
import type { ClockPort } from "./clock-port.ts";
import type { UserAuthorisationSettingsPort } from "./credential-store-port.ts";
import type { PausePort } from "./pause-port.ts";
import type { UserAuthorisationPort } from "./user-authorisation-port.ts";
import type { LockRelease } from "./exclusive-lock-port.ts";
import type { UserGrantStorePort } from "./user-grant-store-port.ts";

const NOW = 1_700_000_000;

const deviceCode = secret("device-code-text");

const accessToken = secret("issued-access-token");

const refreshToken = secret("issued-refresh-token");

const issued = {
  accessToken,
  accessTokenLifetimeSeconds: 28_800,
  refreshToken,
  refreshTokenLifetimeSeconds: 15_897_600,
};

const release = vi.fn<LockRelease>();

const fakeDependencies = () => ({
  authorisationSettings: {
    loadUserAuthorisationSettings: vi
      .fn<UserAuthorisationSettingsPort["loadUserAuthorisationSettings"]>()
      .mockResolvedValue(succeed({ clientId: "Ov23client", scope: "repo" })),
  },
  userAuthorisation: {
    requestDeviceCode: vi.fn<UserAuthorisationPort["requestDeviceCode"]>().mockResolvedValue(
      succeed({
        deviceCode,
        userCode: "WDJB-MJHT",
        verificationUri: "https://github.com/login/device",
        expiresInSeconds: 900,
        pollIntervalSeconds: 5,
      }),
    ),
    redeemDeviceCode: vi
      .fn<UserAuthorisationPort["redeemDeviceCode"]>()
      .mockResolvedValue(succeed({ kind: "granted", issued })),
    refreshGrant: vi.fn<UserAuthorisationPort["refreshGrant"]>(),
  },
  userGrantStore: {
    load: vi.fn<UserGrantStorePort["load"]>(),
    save: vi.fn<UserGrantStorePort["save"]>().mockResolvedValue(succeed(undefined)),
    lock: vi.fn<UserGrantStorePort["lock"]>().mockResolvedValue(succeed(release)),
  },
  clock: { nowEpochSeconds: vi.fn<ClockPort["nowEpochSeconds"]>().mockReturnValue(NOW) },
  pause: {
    pauseMilliseconds: vi.fn<PausePort["pauseMilliseconds"]>().mockResolvedValue(undefined),
  },
});

const fakeRequest = () => ({
  role: "author" as const,
  announce: vi.fn<(prompt: DevicePrompt) => void>(),
});

describe("authoriseUser", () => {
  it("announces the code, waits for approval and keeps the dated grant under the lock", async () => {
    const dependencies = fakeDependencies();
    const authorisation = fakeRequest();

    const authorised = await createUserAuthoriser(dependencies).authoriseUser(authorisation);

    expect(authorised).toEqual(
      succeed({
        accessTokenExpiresAtEpochSeconds: NOW + 28_800,
        refreshTokenExpiresAtEpochSeconds: NOW + 15_897_600,
      }),
    );
    expect(dependencies.userAuthorisation.requestDeviceCode).toHaveBeenCalledExactlyOnceWith({
      clientId: "Ov23client",
      scope: "repo",
    });
    expect(authorisation.announce).toHaveBeenCalledExactlyOnceWith({
      userCode: "WDJB-MJHT",
      verificationUri: "https://github.com/login/device",
      expiresInSeconds: 900,
    });
    expect(dependencies.userAuthorisation.redeemDeviceCode).toHaveBeenCalledExactlyOnceWith({
      clientId: "Ov23client",
      deviceCode,
    });
    expect(dependencies.userGrantStore.lock).toHaveBeenCalledExactlyOnceWith({ role: "author" });
    expect(release.mock.invocationCallOrder.at(-1)).toBeGreaterThan(
      dependencies.userGrantStore.save.mock.invocationCallOrder.at(-1) ?? Number.POSITIVE_INFINITY,
    );
    expect(dependencies.userGrantStore.save).toHaveBeenCalledExactlyOnceWith({
      role: "author",
      grant: {
        accessToken,
        accessTokenExpiresAtEpochSeconds: NOW + 28_800,
        refreshToken,
        refreshTokenExpiresAtEpochSeconds: NOW + 15_897_600,
      },
    });
  });

  it("pauses for the poll interval before each redemption while approval is pending", async () => {
    const dependencies = fakeDependencies();
    dependencies.userAuthorisation.redeemDeviceCode
      .mockResolvedValueOnce(succeed({ kind: "pending" }))
      .mockResolvedValueOnce(succeed({ kind: "granted", issued }));

    await createUserAuthoriser(dependencies).authoriseUser(fakeRequest());

    expect(dependencies.pause.pauseMilliseconds.mock.calls).toEqual([[5_000], [5_000]]);
  });

  it("adopts the longer interval GitHub asks for when told to slow down", async () => {
    const dependencies = fakeDependencies();
    dependencies.userAuthorisation.redeemDeviceCode
      .mockResolvedValueOnce(succeed({ kind: "slow-down", pollIntervalSeconds: 10 }))
      .mockResolvedValueOnce(succeed({ kind: "granted", issued }));

    await createUserAuthoriser(dependencies).authoriseUser(fakeRequest());

    expect(dependencies.pause.pauseMilliseconds.mock.calls).toEqual([[5_000], [10_000]]);
  });

  it("never reveals a token or the device code in what it reports or announces", async () => {
    const dependencies = fakeDependencies();
    const authorisation = fakeRequest();

    const authorised = await createUserAuthoriser(dependencies).authoriseUser(authorisation);

    const disclosed = JSON.stringify([authorised, authorisation.announce.mock.calls]);
    expect(disclosed).not.toContain("issued-access-token");
    expect(disclosed).not.toContain("issued-refresh-token");
    expect(disclosed).not.toContain("device-code-text");
  });
});

describe("authoriseUser refusals", () => {
  it("reports a role with no user authorisation without asking GitHub for a code", async () => {
    const dependencies = fakeDependencies();
    dependencies.authorisationSettings.loadUserAuthorisationSettings.mockResolvedValue(
      fail({
        kind: "user-authorisation-unconfigured",
        role: "author",
        path: "store/credentials.json",
      }),
    );

    const authorised = await createUserAuthoriser(dependencies).authoriseUser(fakeRequest());

    expect(authorised).toEqual(
      fail({
        kind: "user-authorisation-unconfigured",
        role: "author",
        path: "store/credentials.json",
      }),
    );
    expect(dependencies.userAuthorisation.requestDeviceCode).not.toHaveBeenCalled();
  });

  it("reports a device code GitHub would not issue and announces nothing", async () => {
    const dependencies = fakeDependencies();
    dependencies.userAuthorisation.requestDeviceCode.mockResolvedValue(
      fail({ kind: "device-flow-disabled" }),
    );
    const authorisation = fakeRequest();

    const authorised = await createUserAuthoriser(dependencies).authoriseUser(authorisation);

    expect(authorised).toEqual(fail({ kind: "device-flow-disabled" }));
    expect(authorisation.announce).not.toHaveBeenCalled();
  });

  it("stops polling once the device code's lifetime has passed", async () => {
    const dependencies = fakeDependencies();
    dependencies.clock.nowEpochSeconds.mockReturnValueOnce(NOW).mockReturnValue(NOW + 900);

    const authorised = await createUserAuthoriser(dependencies).authoriseUser(fakeRequest());

    expect(authorised).toEqual(fail({ kind: "device-code-expired" }));
    expect(dependencies.userAuthorisation.redeemDeviceCode).not.toHaveBeenCalled();
  });

  it("reports an approval the operator denied and keeps no grant", async () => {
    const dependencies = fakeDependencies();
    dependencies.userAuthorisation.redeemDeviceCode.mockResolvedValue(
      fail({ kind: "device-authorisation-denied" }),
    );

    const authorised = await createUserAuthoriser(dependencies).authoriseUser(fakeRequest());

    expect(authorised).toEqual(fail({ kind: "device-authorisation-denied" }));
    expect(dependencies.userGrantStore.save).not.toHaveBeenCalled();
  });

  it("reports a grant it could not keep", async () => {
    const dependencies = fakeDependencies();
    dependencies.userGrantStore.save.mockResolvedValue(
      fail({
        kind: "user-grant-unwritable",
        path: "store/author.user-grant.json",
        detail: "EACCES",
      }),
    );

    const authorised = await createUserAuthoriser(dependencies).authoriseUser(fakeRequest());

    expect(authorised).toEqual(
      fail({
        kind: "user-grant-unwritable",
        path: "store/author.user-grant.json",
        detail: "EACCES",
      }),
    );
  });
});
