import { assert, describe, expect, it, vi } from "vitest";
import { fail, succeed } from "../domain/result.ts";
import { secret } from "../domain/secret.ts";
import { createGitHubAppApi } from "./github-app-api.ts";
import type { GitHubHttp } from "./github-http.ts";

const appJwt = secret("app.jwt.signature");

const repository = { owner: "HailsTails", name: "minutesarah-shop" };

const fakeHttp = (reply: unknown) => ({
  requestJson: vi.fn<GitHubHttp["requestJson"]>().mockResolvedValue(succeed(reply)),
});

describe("createGitHubAppApi", () => {
  it("reads the slug of the app the JWT authenticates as", async () => {
    const http = fakeHttp({ id: 42, slug: "rin-author" });

    expect(await createGitHubAppApi({ http }).readAuthenticatedApp({ appJwt })).toEqual(
      succeed({ appSlug: "rin-author" }),
    );
    expect(http.requestJson).toHaveBeenCalledExactlyOnceWith({
      operation: "read authenticated app",
      method: "GET",
      path: "/app",
      credential: appJwt,
      requestBody: undefined,
    });
  });

  it("finds the installation on the configured repository", async () => {
    const http = fakeHttp({ id: 77 });

    expect(
      await createGitHubAppApi({ http }).findRepositoryInstallation({ appJwt, repository }),
    ).toEqual(succeed({ installationId: 77 }));
    expect(http.requestJson).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ path: "/repos/HailsTails/minutesarah-shop/installation" }),
    );
  });

  it("reads a 404 on the installation lookup as the app not being installed", async () => {
    const http = {
      requestJson: vi.fn<GitHubHttp["requestJson"]>().mockResolvedValue(
        fail({
          kind: "github-rejected",
          operation: "find repository installation",
          status: 404,
          detail: "Not Found",
        }),
      ),
    };

    expect(
      await createGitHubAppApi({ http }).findRepositoryInstallation({ appJwt, repository }),
    ).toEqual(fail({ kind: "app-not-installed", repository }));
  });
});

describe("createGitHubAppApi token creation", () => {
  it("creates a token scoped to the one repository and keeps it redacted", async () => {
    const http = fakeHttp({ token: "ghs_minted" });

    const minted = await createGitHubAppApi({ http }).createInstallationToken({
      appJwt,
      repository,
      installationId: 77,
    });

    assert(minted.kind === "success");
    expect(minted.outcome.reveal()).toBe("ghs_minted");
    expect(JSON.stringify(minted)).not.toContain("ghs_minted");
    expect(http.requestJson).toHaveBeenCalledExactlyOnceWith({
      operation: "create installation token",
      method: "POST",
      path: "/app/installations/77/access_tokens",
      credential: appJwt,
      requestBody: { repositories: ["minutesarah-shop"] },
    });
  });

  it("reports a token reply without a token", async () => {
    const http = fakeHttp({ message: "Integration suspended" });

    const minted = await createGitHubAppApi({ http }).createInstallationToken({
      appJwt,
      repository,
      installationId: 77,
    });

    assert(minted.kind === "failure" && minted.reason.kind === "github-response-invalid");
    expect(minted.reason.operation).toBe("create installation token");
    expect(minted.reason.issues).toContain("token");
  });
});
