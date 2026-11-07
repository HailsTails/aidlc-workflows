import type { SourceOrigin, SourceContentDigest } from "./source-origin.ts";
export type AuthoredKnowledge = { readonly relativePath: string; readonly origin: SourceOrigin; readonly text: string };
export type CoreKnowledgeSources = { readonly documents: readonly AuthoredKnowledge[]; readonly inputs: readonly SourceContentDigest[] };
