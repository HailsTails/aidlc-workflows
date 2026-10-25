import { assert, describe, expect, it, vi } from "vitest";
import { fail, succeed } from "../domain/result.ts";
import type { StoreLocator } from "../application/credential-store-port.ts";
import type { TextFileReader } from "../application/text-file-port.ts";
import { createFileCredentialStore, locateUserStore } from "./file-credential-store.ts";
import type { UserEnvironment } from "./user-environment.ts";

const storeDirectory = "C:/Users/helen/.config/rin-github-apps";

const locatedStore = () => vi.fn<StoreLocator>().mockReturnValue(succeed(storeDirectory));

const readingFiles = (credentialsJson: string) =>
  vi
    .fn<TextFileReader>()
    .mockResolvedValueOnce(succeed(credentialsJson))
    .mockResolvedValueOnce(succeed("-----BEGIN RSA PRIVATE KEY-----"));

describe("locateUserStore", () => {
  const environmentWith = ({
    variables,
    homeDirectory,
  }: {
    readonly variables: Readonly<Record<string, string>>;
    readonly homeDirectory: string;
  }): UserEnvironment => ({
    variable: (name) => variables[name],
    homeDirectory: () => homeDirectory,
  });

  it("finds the one per-user store under the home directory, outside every repository", () => {
    const locate = locateUserStore({
      environment: environmentWith({ variables: {}, homeDirectory: "C:\\Users\\helen" }),
    });

    expect(locate()).toEqual(succeed("C:/Users/helen/.config/rin-github-apps"));
  });

  it("prefers the directory the environment names", () => {
    const locate = locateUserStore({
      environment: environmentWith({
        variables: { RIN_GITHUB_APPS_CREDENTIALS_DIR: "H:\\keys\\rin" },
        homeDirectory: "/home/helen",
      }),
    });

    expect(locate()).toEqual(succeed("H:/keys/rin"));
  });

  it.each(["/home/helen/keys", "C:/keys/rin"])("accepts the absolute override %s", (directory) => {
    const locate = locateUserStore({
      environment: environmentWith({
        variables: { RIN_GITHUB_APPS_CREDENTIALS_DIR: directory },
        homeDirectory: "/home/helen",
      }),
    });

    expect(locate()).toEqual(succeed(directory));
  });

  it.each(["keys", "./keys", "..\\keys", "C:keys"])(
    "refuses the relative override %s, which would resolve against each worktree",
    (directory) => {
      const locate = locateUserStore({
        environment: environmentWith({
          variables: { RIN_GITHUB_APPS_CREDENTIALS_DIR: directory },
          homeDirectory: "/home/helen",
        }),
      });

      expect(locate()).toEqual(
        fail({
          detail: `RIN_GITHUB_APPS_CREDENTIALS_DIR must be an absolute path, not "${directory}"`,
        }),
      );
    },
  );

  it("ignores an empty override", () => {
    const locate = locateUserStore({
      environment: environmentWith({
        variables: { RIN_GITHUB_APPS_CREDENTIALS_DIR: "" },
        homeDirectory: "/home/helen",
      }),
    });

    expect(locate()).toEqual(succeed("/home/helen/.config/rin-github-apps"));
  });

  it("reports a user with neither an override nor a home directory", () => {
    const locate = locateUserStore({
      environment: environmentWith({ variables: {}, homeDirectory: "" }),
    });

    expect(locate()).toEqual(
      fail({ detail: "no home directory, and RIN_GITHUB_APPS_CREDENTIALS_DIR is unset" }),
    );
  });
});

describe("createFileCredentialStore", () => {
  it("loads a role's app id and the key named relative to the store", async () => {
    const readTextFile = readingFiles(
      '{"author":{"appId":"101","slug":"rin-author","privateKeyPath":"rin-author.private-key.pem"}}',
    );

    const credentials = await createFileCredentialStore({
      locateStoreDirectory: locatedStore(),
      readTextFile,
    }).loadRoleCredentials({ role: "author" });

    assert(credentials.kind === "success");
    expect(credentials.outcome.appId).toBe("101");
    expect(credentials.outcome.privateKey.reveal()).toBe("-----BEGIN RSA PRIVATE KEY-----");
    expect(readTextFile).toHaveBeenNthCalledWith(1, `${storeDirectory}/credentials.json`);
    expect(readTextFile).toHaveBeenNthCalledWith(2, `${storeDirectory}/rin-author.private-key.pem`);
  });

  it("reads a key from the absolute path the store points at", async () => {
    const readTextFile = readingFiles(
      '{"reviewer":{"appId":202,"privateKeyPath":"H:/Development/rin/infra/github-apps/credentials/rin-reviewer.private-key.pem"}}',
    );

    await createFileCredentialStore({
      locateStoreDirectory: locatedStore(),
      readTextFile,
    }).loadRoleCredentials({ role: "reviewer" });

    expect(readTextFile).toHaveBeenNthCalledWith(
      2,
      "H:/Development/rin/infra/github-apps/credentials/rin-reviewer.private-key.pem",
    );
  });
});

describe("createFileCredentialStore refusals", () => {
  it("reports a role the store has no entry for", async () => {
    const credentials = await createFileCredentialStore({
      locateStoreDirectory: locatedStore(),
      readTextFile: readingFiles('{"author":{"appId":"101","privateKeyPath":"a.pem"}}'),
    }).loadRoleCredentials({ role: "reviewer" });

    expect(credentials).toEqual(
      fail({ kind: "role-credentials-missing", role: "reviewer", path: storeDirectory }),
    );
  });

  it("reports a missing credentials file", async () => {
    const readTextFile = vi
      .fn<TextFileReader>()
      .mockResolvedValue(fail({ kind: "file-unreadable", location: "credentials.json" }));

    const credentials = await createFileCredentialStore({
      locateStoreDirectory: locatedStore(),
      readTextFile,
    }).loadRoleCredentials({ role: "author" });

    expect(credentials).toEqual(
      fail({ kind: "credentials-unreadable", path: `${storeDirectory}/credentials.json` }),
    );
  });

  it("reports a credentials file whose app id is not numeric", async () => {
    const credentials = await createFileCredentialStore({
      locateStoreDirectory: locatedStore(),
      readTextFile: readingFiles('{"author":{"appId":"rin","privateKeyPath":"a.pem"}}'),
    }).loadRoleCredentials({ role: "author" });

    assert(credentials.kind === "failure" && credentials.reason.kind === "credentials-invalid");
    expect(credentials.reason.path).toBe(`${storeDirectory}/credentials.json`);
    expect(credentials.reason.issues).toContain("appId");
  });

  it("reports a store it cannot locate", async () => {
    const credentials = await createFileCredentialStore({
      locateStoreDirectory: vi
        .fn<StoreLocator>()
        .mockReturnValue(fail({ detail: "no home directory" })),
      readTextFile: vi.fn<TextFileReader>(),
    }).loadRoleCredentials({ role: "author" });

    expect(credentials).toEqual(
      fail({ kind: "credential-store-unlocatable", detail: "no home directory" }),
    );
  });
});
