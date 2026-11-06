import type { DocumentSource } from "./model.ts";
import { finding, type Outcome } from "./model.ts";

export type SourceBasis = {
  readonly source: DocumentSource;
  readonly pin: string;
};
export type SourceOrigin = SourceBasis & {
  readonly path: string;
};
export type SourceContentDigest = { readonly path: string; readonly sha256: string };
export const mergeSourceDigests = ({ groups }: { readonly groups: readonly (readonly SourceContentDigest[])[] }): Outcome<readonly SourceContentDigest[]> => {
  const observations = groups.flatMap((group) => group);
  const changed = observations.filter((observation) => observations.some((other) => other.path === observation.path && other.sha256 !== observation.sha256));
  if (changed.length > 0) return { status: "invalid", findings: [finding({ code: "foreign-content", subject: changed[0]?.path ?? "source-inputs", detail: "source preparations reported different digests for the same input; inspect source stability and witness representation before composing" })] };
  return { status: "ok", value: observations.filter((observation, index) => observations.findIndex((other) => other.path === observation.path) === index) };
};
