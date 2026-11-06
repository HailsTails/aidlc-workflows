import type { SourceOrigin, SourceBasis, SourceContentDigest } from "./source-origin.ts";
import type { AuthoredProseContext } from "./authored-prose.ts";
import type { Outcome } from "./model.ts";
export type MethodContents = { readonly kind: "prose"; readonly text: string } | { readonly kind: "directory-marker"; readonly bytes: Uint8Array };
export type AuthoredMethodDocument = { readonly origin: SourceOrigin; readonly relativePath: string } & MethodContents;
export type CoreMethodSources = { readonly basis: SourceBasis; readonly documents: readonly AuthoredMethodDocument[]; readonly inputs: readonly SourceContentDigest[] };
export type PreparedMethodFile = { readonly origin: SourceOrigin; readonly delivery: "workspace-template" | "engine-recovery-seed"; readonly path: string } & MethodContents;
export type MethodProseRenderer = (input: { readonly markdown: string; readonly context: AuthoredProseContext; readonly subject: string }) => Outcome<string>;
const methodDeliveries = ({ document, contents, context }: { readonly document: AuthoredMethodDocument; readonly contents: MethodContents; readonly context: AuthoredProseContext }): readonly PreparedMethodFile[] => [
  { origin: document.origin, delivery: "workspace-template", path: `aidlc/spaces/default/memory/${document.relativePath}`, ...contents },
  { origin: document.origin, delivery: "engine-recovery-seed", path: `${context.directory}/tools/data/memory-seed/${document.relativePath}`, ...contents },
];
const renderMethodDocument = ({ document, context, prose }: { readonly document: AuthoredMethodDocument; readonly context: AuthoredProseContext; readonly prose: MethodProseRenderer }): Outcome<readonly PreparedMethodFile[]> => {
  if (document.kind === "directory-marker") return { status: "ok", value: methodDeliveries({ document, contents: { kind: "directory-marker", bytes: document.bytes }, context }) };
  const rendered = prose({ markdown: document.text, context, subject: document.origin.path });
  return rendered.status === "invalid" ? rendered : { status: "ok", value: methodDeliveries({ document, contents: { kind: "prose", text: rendered.value }, context }) };
};
const collectMethodFiles = ({ prepared }: { readonly prepared: readonly Outcome<readonly PreparedMethodFile[]>[] }): Outcome<readonly PreparedMethodFile[]> => {
  const findings = prepared.flatMap((document) => document.status === "invalid" ? document.findings : []);
  return findings.length > 0 ? { status: "invalid", findings } : { status: "ok", value: prepared.flatMap((document) => document.status === "ok" ? document.value : []) };
};
export const prepareMethodFiles = ({ sources, context, prose }: { readonly sources: CoreMethodSources; readonly context: AuthoredProseContext; readonly prose: MethodProseRenderer }): Outcome<readonly PreparedMethodFile[]> => {
  return collectMethodFiles({ prepared: sources.documents.map((document) => renderMethodDocument({ document, context, prose })) });
};
