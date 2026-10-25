import { succeed, type Result } from "../domain/result.ts";
import { secret, type Secret } from "../domain/secret.ts";
import type { RoleCredentials } from "./credential-store-port.ts";
import type { JwtSigningFailed, Rs256SignerPort } from "./rs256-signer-port.ts";

const CLOCK_SKEW_ALLOWANCE_SECONDS = 60;

const JWT_LIFETIME_SECONDS = 540;

type AppJwtRequest = {
  readonly credentials: RoleCredentials;
  readonly nowEpochSeconds: number;
  readonly signer: Rs256SignerPort;
};

const base64UrlJson = (segment: Readonly<Record<string, string | number>>): string =>
  btoa(JSON.stringify(segment)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");

const createAppJwt = ({
  credentials,
  nowEpochSeconds,
  signer,
}: AppJwtRequest): Result<Secret, JwtSigningFailed> => {
  const issuedAt = nowEpochSeconds - CLOCK_SKEW_ALLOWANCE_SECONDS;
  const header = base64UrlJson({ alg: "RS256", typ: "JWT" });
  const claims = base64UrlJson({
    iat: issuedAt,
    exp: issuedAt + JWT_LIFETIME_SECONDS,
    iss: credentials.appId,
  });
  const signingInput = `${header}.${claims}`;
  const signature = signer.signRs256({ signingInput, privateKey: credentials.privateKey });
  if (signature.kind === "failure") return signature;
  return succeed(secret(`${signingInput}.${signature.outcome}`));
};

export { createAppJwt };
