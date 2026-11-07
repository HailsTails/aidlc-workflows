import { assert, describe, expect, it, vi } from "vitest";
import { fail, succeed } from "../domain/result.ts";
import { secret } from "../domain/secret.ts";
import { createAppJwt } from "./app-jwt.ts";
import type { Rs256SignerPort } from "./rs256-signer-port.ts";

const credentials = { appId: "1234", privateKey: secret("pem") };

const encodedHeader = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9";

const encodedClaims = "eyJpYXQiOjE3MDAwMDAwMDAsImV4cCI6MTcwMDAwMDU0MCwiaXNzIjoiMTIzNCJ9";

describe("createAppJwt", () => {
  it("signs a backdated nine-minute app JWT issued by the app id", () => {
    const signRs256 = vi.fn<Rs256SignerPort["signRs256"]>().mockReturnValue(succeed("signature"));

    const appJwt = createAppJwt({
      credentials,
      nowEpochSeconds: 1_700_000_060,
      signer: { signRs256 },
    });

    assert(appJwt.kind === "success");
    expect(appJwt.outcome.reveal()).toBe(`${encodedHeader}.${encodedClaims}.signature`);
    expect(signRs256).toHaveBeenCalledExactlyOnceWith({
      signingInput: `${encodedHeader}.${encodedClaims}`,
      privateKey: credentials.privateKey,
    });
  });

  it("passes a signing failure through", () => {
    const signRs256 = vi
      .fn<Rs256SignerPort["signRs256"]>()
      .mockReturnValue(fail({ kind: "jwt-signing-failed" }));

    expect(createAppJwt({ credentials, nowEpochSeconds: 1, signer: { signRs256 } })).toEqual({
      kind: "failure",
      reason: { kind: "jwt-signing-failed" },
    });
  });
});
