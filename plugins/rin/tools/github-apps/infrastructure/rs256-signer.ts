import { createSign } from "node:crypto";
import type { Rs256SignerPort } from "../application/rs256-signer-port.ts";
import { fail, succeed } from "../domain/result.ts";

const createRs256Signer = (): Rs256SignerPort => ({
  signRs256: ({ signingInput, privateKey }) => {
    try {
      return succeed(
        createSign("RSA-SHA256").update(signingInput).sign(privateKey.reveal(), "base64url"),
      );
    } catch {
      return fail({ kind: "jwt-signing-failed" });
    }
  },
});

export { createRs256Signer };
