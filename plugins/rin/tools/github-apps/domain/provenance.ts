import type { AgentRole } from "./agent-role.ts";

type WriteCredential = "installation" | "user-grant";

type Provenance = {
  readonly role: AgentRole;
  readonly session: string;
  readonly via: WriteCredential;
};

type AttributedBody = { readonly provenance: Provenance; readonly authoredBody: string };

const MARKER_UNSAFE_CHARACTERS = /[^\w./:#-]/g;

const markerSafeSession = (session: string): string =>
  session.replaceAll(MARKER_UNSAFE_CHARACTERS, "_");

const CREDENTIAL_MARKER_SUFFIX: Readonly<Record<WriteCredential, string>> = {
  installation: "",
  "user-grant": " via=user-grant",
};

const provenanceMarker = ({ role, session, via }: Provenance): string =>
  `<!-- rin-bot: role=${role} session=${markerSafeSession(session)}${CREDENTIAL_MARKER_SUFFIX[via]} -->`;

const withProvenance = ({ provenance, authoredBody }: AttributedBody): string =>
  `${provenanceMarker(provenance)}\n\n${authoredBody}`;

export { provenanceMarker, withProvenance, type Provenance, type WriteCredential };
