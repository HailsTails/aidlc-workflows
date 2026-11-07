import type { Result } from "../domain/result.ts";
import type { Secret } from "../domain/secret.ts";

type SigningRequest = { readonly signingInput: string; readonly privateKey: Secret };

type JwtSigningFailed = { readonly kind: "jwt-signing-failed" };

type Rs256SignerPort = {
  readonly signRs256: (request: SigningRequest) => Result<string, JwtSigningFailed>;
};

export type { JwtSigningFailed, Rs256SignerPort, SigningRequest };
