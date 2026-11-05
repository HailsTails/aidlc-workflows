import type { DocumentSource } from "./model.ts";

export type SourceBasis = {
  readonly source: DocumentSource;
  readonly pin: string;
};
export type SourceOrigin = SourceBasis & {
  readonly path: string;
};
export type SourceContentDigest = { readonly path: string; readonly sha256: string };
