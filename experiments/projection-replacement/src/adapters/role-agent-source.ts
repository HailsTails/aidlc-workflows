import { parseAgentSource } from "./agent-source.ts";
import { createOwnershipDigest } from "./projection-ownership.ts";
import type { RoleActorSource } from "../domain/plugin-role-contract.ts";
import type { SourceOrigin } from "../domain/source-origin.ts";
import type { Outcome } from "../domain/model.ts";
export const parseRoleAgentSource = ({ text, origin, digest = createOwnershipDigest() }: { readonly text: string; readonly origin: SourceOrigin; readonly digest?: (input: { readonly bytes: Uint8Array }) => string }): Outcome<RoleActorSource> => {
  const parsed = parseAgentSource({ text, origin });
  return parsed.status === "invalid" ? parsed : { status: "ok", value: { agent: parsed.value, sha256: digest({ bytes: new TextEncoder().encode(text) }) } };
};
