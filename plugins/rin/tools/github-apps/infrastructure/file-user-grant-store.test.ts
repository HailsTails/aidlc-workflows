import { assert, describe, expect, it, vi } from "vitest";
import type { StoreLocator } from "../application/credential-store-port.ts";
import type { ExclusiveLockPort } from "../application/exclusive-lock-port.ts";
import type { PrivateFileReplacer } from "../application/private-file-port.ts";
import type { TextFileReader } from "../application/text-file-port.ts";
import { fail, succeed } from "../domain/result.ts";
import { secret } from "../domain/secret.ts";
import { createFileUserGrantStore } from "./file-user-grant-store.ts";

const storeDirectory = "C:/Users/helen/.config/rin-github-apps";

const grantPath = `${storeDirectory}/rin-author.user-grant.json`;

const lockPath = `${storeDirectory}/rin-author.user-grant.lock`;

const grantJson = `{
  "accessToken": "ghu_access",
  "accessTokenExpiresAtEpochSeconds": 1700028800,
  "refreshToken": "ghr_refresh",
  "refreshTokenExpiresAtEpochSeconds": 1715000000
}
`;

const storeDependencies = () => ({
  locateStoreDirectory: vi.fn<StoreLocator>().mockReturnValue(succeed(storeDirectory)),
  readTextFile: vi.fn<TextFileReader>().mockResolvedValue(succeed(grantJson)),
  replacePrivateFile: vi.fn<PrivateFileReplacer>().mockResolvedValue(succeed(undefined)),
  lock: { holdExclusively: vi.fn<ExclusiveLockPort["holdExclusively"]>() },
});

const unlocatable = () =>
  vi.fn<StoreLocator>().mockReturnValue(fail({ detail: "no home directory" }));

describe("createFileUserGrantStore load", () => {
  it("loads the app's grant from the store, keeping both tokens secret", async () => {
    const dependencies = storeDependencies();

    const loaded = await createFileUserGrantStore(dependencies).load({ appSlug: "rin-author" });

    assert(loaded.kind === "success");
    expect(loaded.outcome.accessToken.reveal()).toBe("ghu_access");
    expect(loaded.outcome.refreshToken.reveal()).toBe("ghr_refresh");
    expect(loaded.outcome.accessTokenExpiresAtEpochSeconds).toBe(1_700_028_800);
    expect(loaded.outcome.refreshTokenExpiresAtEpochSeconds).toBe(1_715_000_000);
    expect(dependencies.readTextFile).toHaveBeenCalledWith(grantPath);
  });

  it("never reveals either token when the grant is serialised", async () => {
    const loaded = await createFileUserGrantStore(storeDependencies()).load({
      appSlug: "rin-author",
    });

    const serialised = JSON.stringify(loaded);

    expect(serialised).not.toContain("ghu_access");
    expect(serialised).not.toContain("ghr_refresh");
  });

  it("reports a store it cannot locate", async () => {
    const loaded = await createFileUserGrantStore({
      ...storeDependencies(),
      locateStoreDirectory: unlocatable(),
    }).load({ appSlug: "rin-author" });

    expect(loaded).toEqual(
      fail({ kind: "credential-store-unlocatable", detail: "no home directory" }),
    );
  });

  it("reports a grant that was never saved", async () => {
    const dependencies = storeDependencies();
    dependencies.readTextFile.mockResolvedValue(
      fail({ kind: "file-unreadable", location: grantPath }),
    );

    const loaded = await createFileUserGrantStore(dependencies).load({ appSlug: "rin-author" });

    expect(loaded).toEqual(fail({ kind: "user-grant-missing", path: grantPath }));
  });

  it("reports a grant file that is not JSON", async () => {
    const dependencies = storeDependencies();
    dependencies.readTextFile.mockResolvedValue(succeed("ghu_access"));

    const loaded = await createFileUserGrantStore(dependencies).load({ appSlug: "rin-author" });

    expect(loaded).toEqual(
      fail({ kind: "user-grant-invalid", path: grantPath, issues: "not JSON" }),
    );
  });

  it("reports a grant file of the wrong shape", async () => {
    const dependencies = storeDependencies();
    dependencies.readTextFile.mockResolvedValue(
      succeed('{"accessToken":"ghu_access","accessTokenExpiresAtEpochSeconds":-1}'),
    );

    const loaded = await createFileUserGrantStore(dependencies).load({ appSlug: "rin-author" });

    assert(loaded.kind === "failure" && loaded.reason.kind === "user-grant-invalid");
    expect(loaded.reason.path).toBe(grantPath);
    expect(loaded.reason.issues).toContain("accessTokenExpiresAtEpochSeconds");
    expect(loaded.reason.issues).toContain("refreshToken");
  });

  it("reports a grant file carrying fields it does not know", async () => {
    const dependencies = storeDependencies();
    dependencies.readTextFile.mockResolvedValue(
      succeed(
        '{"accessToken":"a","accessTokenExpiresAtEpochSeconds":1,"refreshToken":"r","refreshTokenExpiresAtEpochSeconds":2,"scope":"repo"}',
      ),
    );

    const loaded = await createFileUserGrantStore(dependencies).load({ appSlug: "rin-author" });

    assert(loaded.kind === "failure" && loaded.reason.kind === "user-grant-invalid");
    expect(loaded.reason.issues).toContain("scope");
  });
});

describe("createFileUserGrantStore save", () => {
  it("replaces the app's grant file with the revealed grant, pretty-printed", async () => {
    const dependencies = storeDependencies();

    const saved = await createFileUserGrantStore(dependencies).save({
      appSlug: "rin-author",
      grant: {
        accessToken: secret("ghu_access"),
        accessTokenExpiresAtEpochSeconds: 1_700_028_800,
        refreshToken: secret("ghr_refresh"),
        refreshTokenExpiresAtEpochSeconds: 1_715_000_000,
      },
    });

    expect(saved).toEqual(succeed(undefined));
    expect(dependencies.replacePrivateFile).toHaveBeenCalledWith({
      location: grantPath,
      text: grantJson,
    });
  });

  it("reports a grant file it cannot write", async () => {
    const dependencies = storeDependencies();
    dependencies.replacePrivateFile.mockResolvedValue(
      fail({ kind: "file-unwritable", location: grantPath, detail: "EACCES: permission denied" }),
    );

    const saved = await createFileUserGrantStore(dependencies).save({
      appSlug: "rin-author",
      grant: {
        accessToken: secret("ghu_access"),
        accessTokenExpiresAtEpochSeconds: 1,
        refreshToken: secret("ghr_refresh"),
        refreshTokenExpiresAtEpochSeconds: 2,
      },
    });

    expect(saved).toEqual(
      fail({ kind: "user-grant-unwritable", path: grantPath, detail: "EACCES: permission denied" }),
    );
  });

  it("reports a store it cannot locate", async () => {
    const saved = await createFileUserGrantStore({
      ...storeDependencies(),
      locateStoreDirectory: unlocatable(),
    }).save({
      appSlug: "rin-author",
      grant: {
        accessToken: secret("ghu_access"),
        accessTokenExpiresAtEpochSeconds: 1,
        refreshToken: secret("ghr_refresh"),
        refreshTokenExpiresAtEpochSeconds: 2,
      },
    });

    expect(saved).toEqual(
      fail({ kind: "credential-store-unlocatable", detail: "no home directory" }),
    );
  });
});

describe("createFileUserGrantStore holdExclusively", () => {
  it("runs the work under the app's grant lock", async () => {
    const dependencies = storeDependencies();
    dependencies.lock.holdExclusively.mockResolvedValue(succeed("refreshed"));
    const work = async () => "refreshed";

    const held = await createFileUserGrantStore(dependencies).holdExclusively({
      appSlug: "rin-author",
      work,
    });

    expect(held).toEqual(succeed("refreshed"));
    expect(dependencies.lock.holdExclusively).toHaveBeenCalledWith({ lockLocation: lockPath, work });
  });

  it("reports a lock it could not take", async () => {
    const dependencies = storeDependencies();
    dependencies.lock.holdExclusively.mockResolvedValue(
      fail({ kind: "lock-unavailable", lockLocation: lockPath }),
    );

    const held = await createFileUserGrantStore(dependencies).holdExclusively({
      appSlug: "rin-author",
      work: async () => "refreshed",
    });

    expect(held).toEqual(fail({ kind: "user-grant-lock-unavailable", path: lockPath }));
  });

  it("reports a store it cannot locate, without taking the lock", async () => {
    const dependencies = { ...storeDependencies(), locateStoreDirectory: unlocatable() };

    const held = await createFileUserGrantStore(dependencies).holdExclusively({
      appSlug: "rin-author",
      work: async () => "refreshed",
    });

    expect(held).toEqual(
      fail({ kind: "credential-store-unlocatable", detail: "no home directory" }),
    );
    expect(dependencies.lock.holdExclusively).not.toHaveBeenCalled();
  });
});
