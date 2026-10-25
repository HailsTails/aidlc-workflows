import { describe, expect, it, vi } from "vitest";
import { secret } from "../domain/secret.ts";
import { createGitHubHttp, type FetchResource } from "./github-http.ts";

const request = {
  operation: "read app",
  method: "POST",
  path: "/graphql",
  credential: secret("ghs_token"),
  requestBody: { query: "{ viewer { login } }" },
} as const;

describe("createGitHubHttp", () => {
  it("sends an authenticated JSON request to the GitHub API and parses the reply", async () => {
    const fetchResource = vi
      .fn<FetchResource>()
      .mockResolvedValue(new Response('{"data":{"viewer":{"login":"rin-author[bot]"}}}'));

    const reply = await createGitHubHttp({ fetchResource }).requestJson(request);

    expect(reply).toEqual({
      kind: "success",
      outcome: { data: { viewer: { login: "rin-author[bot]" } } },
    });
    expect(fetchResource).toHaveBeenCalledExactlyOnceWith("https://api.github.com/graphql", {
      method: "POST",
      headers: [
        ["Accept", "application/vnd.github+json"],
        ["Authorization", "Bearer ghs_token"],
        ["Content-Type", "application/json"],
        ["User-Agent", "rin-github-apps"],
        ["X-GitHub-Api-Version", "2022-11-28"],
      ],
      body: '{"query":"{ viewer { login } }"}',
    });
  });

  it("sends no body for a request without one", async () => {
    const fetchResource = vi.fn<FetchResource>().mockResolvedValue(new Response("{}"));

    await createGitHubHttp({ fetchResource }).requestJson({
      ...request,
      method: "GET",
      path: "/app",
      requestBody: undefined,
    });

    expect(fetchResource).toHaveBeenCalledExactlyOnceWith("https://api.github.com/app", {
      method: "GET",
      headers: [
        ["Accept", "application/vnd.github+json"],
        ["Authorization", "Bearer ghs_token"],
        ["Content-Type", "application/json"],
        ["User-Agent", "rin-github-apps"],
        ["X-GitHub-Api-Version", "2022-11-28"],
      ],
    });
  });
});

describe("createGitHubHttp failures", () => {
  it("reports a rejection with its status and GitHub's explanation", async () => {
    const fetchResource = vi
      .fn<FetchResource>()
      .mockResolvedValue(new Response('{"message":"Bad credentials"}', { status: 401 }));

    expect(await createGitHubHttp({ fetchResource }).requestJson(request)).toEqual({
      kind: "failure",
      reason: {
        kind: "github-rejected",
        operation: "read app",
        status: 401,
        detail: '{"message":"Bad credentials"}',
      },
    });
  });

  it("reports an unreachable API", async () => {
    const fetchResource = vi.fn<FetchResource>().mockRejectedValue(new TypeError("fetch failed"));

    expect(await createGitHubHttp({ fetchResource }).requestJson(request)).toEqual({
      kind: "failure",
      reason: { kind: "github-unreachable", operation: "read app" },
    });
  });

  it("reports a reply that is not JSON", async () => {
    const fetchResource = vi.fn<FetchResource>().mockResolvedValue(new Response("<html>"));

    expect(await createGitHubHttp({ fetchResource }).requestJson(request)).toEqual({
      kind: "failure",
      reason: {
        kind: "github-response-invalid",
        operation: "read app",
        issues: "response is not JSON",
      },
    });
  });
});
