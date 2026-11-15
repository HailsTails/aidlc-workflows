import { describe, expect, it, vi } from "vitest";
import { secret } from "../domain/secret.ts";
import type { FetchResource } from "./github-http.ts";
import { createGitHubUserAuthorisation } from "./github-user-authorisation.ts";

const jsonReply = (body: unknown): Response => new Response(JSON.stringify(body));

const deviceCodeReply = {
  device_code: "device-secret-1",
  user_code: "WDJB-MJHT",
  verification_uri: "https://github.com/login/device",
  expires_in: 900,
  interval: 5,
};

const grantReply = {
  access_token: "ghu_access-secret",
  expires_in: 28800,
  refresh_token: "ghr_refresh-secret",
  refresh_token_expires_in: 15811200,
  token_type: "bearer",
  scope: "",
};

const redemption = { clientId: "Iv1.client", deviceCode: secret("device-secret-1") };

const refresh = { clientId: "Iv1.client", refreshToken: secret("ghr_refresh-secret") };

const headers = [
  ["Accept", "application/json"],
  ["Content-Type", "application/json"],
  ["User-Agent", "rin-github-apps"],
];

const refusedOn = (operation: string, error: string, description: string) => ({
  kind: "oauth-request-refused",
  operation,
  error,
  description,
});

const adapterReplying = (reply: Response) => {
  const fetchResource = vi.fn<FetchResource>().mockResolvedValue(reply);
  return { fetchResource, port: createGitHubUserAuthorisation({ fetchResource }) };
};

describe("requestDeviceCode", () => {
  it("posts the client id to the device code endpoint and maps the reply", async () => {
    const { fetchResource, port } = adapterReplying(jsonReply(deviceCodeReply));

    const result = await port.requestDeviceCode({ clientId: "Iv1.client" });

    expect(fetchResource).toHaveBeenCalledExactlyOnceWith("https://github.com/login/device/code", {
      method: "POST",
      headers,
      signal: expect.any(AbortSignal),
      body: '{"client_id":"Iv1.client"}',
    });
    expect(result.kind === "success" && result.outcome.deviceCode.reveal()).toBe("device-secret-1");
    expect(result.kind === "success" && result.outcome).toMatchObject({
      userCode: "WDJB-MJHT",
      verificationUri: "https://github.com/login/device",
      expiresInSeconds: 900,
      pollIntervalSeconds: 5,
    });
  });

  it("does not leak the device code when serialised", async () => {
    const { port } = adapterReplying(jsonReply(deviceCodeReply));

    const result = await port.requestDeviceCode({ clientId: "Iv1.client" });

    expect(JSON.stringify(result)).not.toContain("device-secret-1");
  });

  it.each([
    ["device_flow_disabled", { kind: "device-flow-disabled" }],
    ["incorrect_client_credentials", { kind: "oauth-client-rejected" }],
    ["incorrect_device_code", refusedOn("request a device code", "incorrect_device_code", "nope")],
    ["bad_refresh_token", refusedOn("request a device code", "bad_refresh_token", "nope")],
    ["access_denied", refusedOn("request a device code", "access_denied", "nope")],
  ])("maps the %s reply", async (error, reason) => {
    const { port } = adapterReplying(jsonReply({ error, error_description: "nope" }));

    expect(await port.requestDeviceCode({ clientId: "Iv1.client" })).toEqual({
      kind: "failure",
      reason,
    });
  });

  it("reports a reply of the wrong shape", async () => {
    const { port } = adapterReplying(jsonReply({ device_code: "" }));

    expect(await port.requestDeviceCode({ clientId: "Iv1.client" })).toMatchObject({
      kind: "failure",
      reason: { kind: "github-response-invalid", operation: "request a device code" },
    });
  });
});

describe("redeemDeviceCode", () => {
  it("posts the device code grant without a client secret and maps the granted tokens", async () => {
    const { fetchResource, port } = adapterReplying(jsonReply(grantReply));

    const result = await port.redeemDeviceCode(redemption);

    expect(fetchResource).toHaveBeenCalledExactlyOnceWith(
      "https://github.com/login/oauth/access_token",
      {
        method: "POST",
        headers,
        signal: expect.any(AbortSignal),
        body: '{"client_id":"Iv1.client","device_code":"device-secret-1","grant_type":"urn:ietf:params:oauth:grant-type:device_code"}',
      },
    );
    expect(result.kind === "success" && result.outcome).toMatchObject({
      kind: "granted",
      issued: { accessTokenLifetimeSeconds: 28800, refreshTokenLifetimeSeconds: 15811200 },
    });
  });

  it("wraps both tokens as secrets", async () => {
    const { port } = adapterReplying(jsonReply(grantReply));

    const result = await port.redeemDeviceCode(redemption);

    const outcome = result.kind === "success" ? result.outcome : undefined;
    const issued = outcome?.kind === "granted" ? outcome.issued : undefined;
    expect(issued?.accessToken.reveal()).toBe("ghu_access-secret");
    expect(issued?.refreshToken.reveal()).toBe("ghr_refresh-secret");
  });

  it("does not leak any token when serialised", async () => {
    const { port } = adapterReplying(jsonReply(grantReply));

    const serialised = JSON.stringify(await port.redeemDeviceCode(redemption));

    expect(serialised).not.toContain("ghu_access-secret");
    expect(serialised).not.toContain("ghr_refresh-secret");
    expect(serialised).not.toContain("device-secret-1");
  });

  it("reports authorization_pending as pending", async () => {
    const { port } = adapterReplying(jsonReply({ error: "authorization_pending" }));

    expect(await port.redeemDeviceCode(redemption)).toEqual({
      kind: "success",
      outcome: { kind: "pending" },
    });
  });

  it("reports slow_down with the interval GitHub asks for", async () => {
    const { port } = adapterReplying(jsonReply({ error: "slow_down", interval: 10 }));

    expect(await port.redeemDeviceCode(redemption)).toEqual({
      kind: "success",
      outcome: { kind: "slow-down", pollIntervalSeconds: 10 },
    });
  });

  it("reports slow_down without an interval as an invalid response", async () => {
    const { port } = adapterReplying(jsonReply({ error: "slow_down" }));

    expect(await port.redeemDeviceCode(redemption)).toMatchObject({
      kind: "failure",
      reason: { kind: "github-response-invalid", operation: "redeem the device code" },
    });
  });

  it.each([
    ["expired_token", { kind: "device-code-expired" }],
    ["token_expired", { kind: "device-code-expired" }],
    ["bad_verification_code", { kind: "device-code-expired" }],
    ["access_denied", { kind: "device-authorisation-denied" }],
    ["device_flow_disabled", { kind: "device-flow-disabled" }],
    ["incorrect_client_credentials", { kind: "oauth-client-rejected" }],
    ["incorrect_device_code", refusedOn("redeem the device code", "incorrect_device_code", "")],
    ["unsupported_grant_type", refusedOn("redeem the device code", "unsupported_grant_type", "")],
    ["bad_refresh_token", refusedOn("redeem the device code", "bad_refresh_token", "")],
  ])("maps the %s reply", async (error, reason) => {
    const { port } = adapterReplying(jsonReply({ error }));

    expect(await port.redeemDeviceCode(redemption)).toEqual({ kind: "failure", reason });
  });

  it("carries GitHub's description on a refused request", async () => {
    const { port } = adapterReplying(
      jsonReply({ error: "incorrect_device_code", error_description: "The device code is wrong." }),
    );

    expect(await port.redeemDeviceCode(redemption)).toMatchObject({
      reason: { description: "The device code is wrong." },
    });
  });

  it("reports a reply of the wrong shape", async () => {
    const { port } = adapterReplying(jsonReply({ access_token: "ghu_x" }));

    expect(await port.redeemDeviceCode(redemption)).toMatchObject({
      kind: "failure",
      reason: { kind: "github-response-invalid", operation: "redeem the device code" },
    });
  });
});

describe("refreshGrant", () => {
  it("posts the refresh token grant without a client secret and maps the new tokens", async () => {
    const { fetchResource, port } = adapterReplying(jsonReply(grantReply));

    const result = await port.refreshGrant(refresh);

    expect(fetchResource).toHaveBeenCalledExactlyOnceWith(
      "https://github.com/login/oauth/access_token",
      {
        method: "POST",
        headers,
        signal: expect.any(AbortSignal),
        body: '{"client_id":"Iv1.client","grant_type":"refresh_token","refresh_token":"ghr_refresh-secret"}',
      },
    );
    expect(result.kind === "success" && result.outcome.accessToken.reveal()).toBe(
      "ghu_access-secret",
    );
    expect(result.kind === "success" && result.outcome.refreshTokenLifetimeSeconds).toBe(15811200);
  });

  it("does not leak any token when serialised", async () => {
    const { port } = adapterReplying(jsonReply(grantReply));

    const serialised = JSON.stringify(await port.refreshGrant(refresh));

    expect(serialised).not.toContain("ghu_access-secret");
    expect(serialised).not.toContain("ghr_refresh-secret");
  });

  it.each([
    ["bad_refresh_token", { kind: "refresh-token-rejected" }],
    ["device_flow_disabled", { kind: "device-flow-disabled" }],
    ["incorrect_client_credentials", { kind: "oauth-client-rejected" }],
    ["expired_token", refusedOn("refresh the user grant", "expired_token", "")],
    ["authorization_pending", refusedOn("refresh the user grant", "authorization_pending", "")],
    ["access_denied", refusedOn("refresh the user grant", "access_denied", "")],
  ])("maps the %s reply", async (error, reason) => {
    const { port } = adapterReplying(jsonReply({ error }));

    expect(await port.refreshGrant(refresh)).toEqual({ kind: "failure", reason });
  });

  it("reports a reply of the wrong shape", async () => {
    const { port } = adapterReplying(jsonReply({ access_token: "ghu_x", expires_in: 0 }));

    expect(await port.refreshGrant(refresh)).toMatchObject({
      kind: "failure",
      reason: { kind: "github-response-invalid", operation: "refresh the user grant" },
    });
  });
});

describe("transport failures", () => {
  it("reports an unreachable GitHub for each operation", async () => {
    const fetchResource = vi.fn<FetchResource>().mockRejectedValue(new TypeError("fetch failed"));
    const port = createGitHubUserAuthorisation({ fetchResource });

    expect(await port.requestDeviceCode({ clientId: "Iv1.client" })).toEqual({
      kind: "failure",
      reason: { kind: "github-unreachable", operation: "request a device code" },
    });
    expect(await port.redeemDeviceCode(redemption)).toEqual({
      kind: "failure",
      reason: { kind: "github-unreachable", operation: "redeem the device code" },
    });
    expect(await port.refreshGrant(refresh)).toEqual({
      kind: "failure",
      reason: { kind: "github-unreachable", operation: "refresh the user grant" },
    });
  });

  it("reports a reply that times out as unreachable", async () => {
    const fetchResource = vi
      .fn<FetchResource>()
      .mockRejectedValue(new DOMException("The operation timed out.", "TimeoutError"));

    expect(await createGitHubUserAuthorisation({ fetchResource }).refreshGrant(refresh)).toEqual({
      kind: "failure",
      reason: { kind: "github-unreachable", operation: "refresh the user grant" },
    });
  });

  it("reports a non-2xx status with the first 500 characters of the body", async () => {
    const { port } = adapterReplying(new Response("x".repeat(600), { status: 503 }));

    expect(await port.redeemDeviceCode(redemption)).toEqual({
      kind: "failure",
      reason: {
        kind: "github-rejected",
        operation: "redeem the device code",
        status: 503,
        detail: "x".repeat(500),
      },
    });
  });

  it("reports a reply that is not JSON", async () => {
    const { port } = adapterReplying(new Response("<html>"));

    expect(await port.requestDeviceCode({ clientId: "Iv1.client" })).toEqual({
      kind: "failure",
      reason: {
        kind: "github-response-invalid",
        operation: "request a device code",
        issues: "response is not JSON",
      },
    });
  });
});
