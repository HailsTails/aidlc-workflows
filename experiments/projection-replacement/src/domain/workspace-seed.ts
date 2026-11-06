import type { SourceOrigin } from "./source-origin.ts";
export type WorkspaceSeedSource = { readonly origin: SourceOrigin; readonly sha256: string; readonly file: "aidlc/active-space"; readonly content: string };
