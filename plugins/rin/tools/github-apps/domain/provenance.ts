import type { AgentRole } from "./agent-role.ts";

type Provenance = { readonly role: AgentRole; readonly session: string };

type AttributedBody = { readonly provenance: Provenance; readonly authoredBody: string };

const MARKER_UNSAFE_CHARACTERS = /[^\w./:#-]/g;

const markerSafeSession = (session: string): string =>
  session.replaceAll(MARKER_UNSAFE_CHARACTERS, "_");

const provenanceMarker = ({ role, session }: Provenance): string =>
  `<!-- rin-bot: role=${role} session=${markerSafeSession(session)} -->`;

const withProvenance = ({ provenance, authoredBody }: AttributedBody): string =>
  `${provenanceMarker(provenance)}\n\n${authoredBody}`;

export { provenanceMarker, withProvenance, type Provenance };
