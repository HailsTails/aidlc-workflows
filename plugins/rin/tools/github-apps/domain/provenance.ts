import type { AgentRole } from "./agent-role.ts";

type Provenance = { readonly role: AgentRole; readonly session: string };

type AttributedBody = { readonly provenance: Provenance; readonly authoredBody: string };

const provenanceMarker = ({ role, session }: Provenance): string =>
  `<!-- rin-bot: role=${role} session=${session} -->`;

const withProvenance = ({ provenance, authoredBody }: AttributedBody): string =>
  `${provenanceMarker(provenance)}\n\n${authoredBody}`;

export { provenanceMarker, withProvenance, type Provenance };
