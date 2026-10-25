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

const pkcs8Der = new Uint8Array(
  await crypto.subtle.exportKey("pkcs8", generatedKeyPair.privateKey),
);

type DerElement = { readonly contentStart: number; readonly end: number };

const SHORT_FORM_LENGTH_LIMIT = 0x80;

const LONG_FORM_OCTET_COUNT_MASK = 0x7f;

const derElementAt = (der: Uint8Array, offset: number): DerElement => {
  const lengthByte = der[offset + 1] ?? 0;
  if (lengthByte < SHORT_FORM_LENGTH_LIMIT) {
    return { contentStart: offset + 2, end: offset + 2 + lengthByte };
  }
  const lengthOctets = lengthByte & LONG_FORM_OCTET_COUNT_MASK;
  const contentStart = offset + 2 + lengthOctets;
  const length = der
    .subarray(offset + 2, contentStart)
    .reduce((total, octet) => total * 256 + octet, 0);
  return { contentStart, end: contentStart + length };
};

const pkcs1FromPkcs8 = (der: Uint8Array): Uint8Array => {
  const privateKeyInfo = derElementAt(der, 0);
  const version = derElementAt(der, privateKeyInfo.contentStart);
  const algorithm = derElementAt(der, version.end);
  const privateKey = derElementAt(der, algorithm.end);
  return der.subarray(privateKey.contentStart, privateKey.end);
};

const pemOf = ({ label, der }: { readonly label: string; readonly der: Uint8Array }): string =>
  `-----BEGIN ${label}-----\n${Buffer.from(der).toString("base64")}\n-----END ${label}-----\n`;

const privateKeyPem = pemOf({ label: "PRIVATE KEY", der: pkcs8Der });

const rsaPrivateKeyPem = pemOf({ label: "RSA PRIVATE KEY", der: pkcs1FromPkcs8(pkcs8Der) });

const signingInput = "header.claims";

const verifies = (signature: string): Promise<boolean> =>
  crypto.subtle.verify(
    rsaParameters,
    generatedKeyPair.publicKey,
    Buffer.from(signature, "base64url"),
    new TextEncoder().encode(signingInput),
  );

describe("createRs256Signer", () => {
  it("produces a base64url RS256 signature the matching public key verifies", async () => {
    const signature = createRs256Signer().signRs256({
      signingInput,
      privateKey: secret(privateKeyPem),
    });

    assert(signature.kind === "success");
    expect(signature.outcome).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(await verifies(signature.outcome)).toBe(true);
  });

  it("signs with the PKCS#1 RSA PRIVATE KEY that GitHub issues for an app", async () => {
    const signature = createRs256Signer().signRs256({
      signingInput,
      privateKey: secret(rsaPrivateKeyPem),
    });

    assert(signature.kind === "success");
    expect(await verifies(signature.outcome)).toBe(true);
  });

  it("reports a key it cannot sign with", () => {
    expect(
      createRs256Signer().signRs256({ signingInput, privateKey: secret("not a pem") }),
    ).toEqual({ kind: "failure", reason: { kind: "jwt-signing-failed" } });
  });
});
