import { assert, describe, expect, it } from "vitest";
import { secret } from "../domain/secret.ts";
import { createRs256Signer } from "./rs256-signer.ts";

const rsaParameters = {
  name: "RSASSA-PKCS1-v1_5",
  hash: "SHA-256",
  modulusLength: 2048,
  publicExponent: new Uint8Array([1, 0, 1]),
};

const generatedKeyPair = await crypto.subtle.generateKey(rsaParameters, true, ["sign", "verify"]);

const pkcs8Body = Buffer.from(
  await crypto.subtle.exportKey("pkcs8", generatedKeyPair.privateKey),
).toString("base64");

const privateKeyPem = `-----BEGIN PRIVATE KEY-----\n${pkcs8Body}\n-----END PRIVATE KEY-----\n`;

const signingInput = "header.claims";

describe("createRs256Signer", () => {
  it("produces a base64url RS256 signature the matching public key verifies", async () => {
    const signature = createRs256Signer().signRs256({
      signingInput,
      privateKey: secret(privateKeyPem),
    });

    assert(signature.kind === "success");
    expect(signature.outcome).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(
      await crypto.subtle.verify(
        rsaParameters,
        generatedKeyPair.publicKey,
        Buffer.from(signature.outcome, "base64url"),
        new TextEncoder().encode(signingInput),
      ),
    ).toBe(true);
  });

  it("reports a key it cannot sign with", () => {
    expect(
      createRs256Signer().signRs256({ signingInput, privateKey: secret("not a pem") }),
    ).toEqual({ kind: "failure", reason: { kind: "jwt-signing-failed" } });
  });
});
