import { brand, type Brand } from "../../kernel/brand.ts";
import { accepted, refused, type Result } from "../../kernel/result.ts";
import { sourcePath, type SourcePath } from "../../kernel/values.ts";
import type { FileContent } from "../../kernel/file-content.ts";
import type { NeutralDocument } from "./neutral-surface.ts";
import type { DistributionChannel } from "./projected-file.ts";

export type CwdGuidanceSource = { readonly kind: "legacy-authored" }
  | { readonly kind: "framework-cwd"; readonly source: string };
type AdmittedCwdSource = { readonly kind: "legacy-authored" }
  | { readonly kind: "framework-cwd"; readonly source: SourcePath };
export type AdmittedCwdDocuments = Brand<Readonly<{
  readonly documents: readonly NeutralDocument[];
  readonly guidance: AdmittedCwdSource;
}>, "AdmittedCwdDocuments">;

const COPY = "**CWD drift warning**: If a stage runs `cd` in Bash (e.g., `cd todo-app/server && npm install`), subsequent `bun {{HARNESS_DIR}}/tools/...` calls using relative paths will fail with \"Module not found\". Never change the working directory in the main shell: run `cd` commands in subshells, `(cd subdir && npm install)`, so every engine command keeps the bare relative form the harness pre-approves. An absolute-path form, a `cd ... &&` prefix, an environment-variable prefix, a pipe, or a `$(...)` capture around an engine command all fall outside that pre-approval and prompt the user.";
const NATIVE = "**CWD drift warning**: Native release commands resolve `aidlc` from `PATH`, so changing directories does not change the engine path. Keep project-relative file arguments anchored to the project root, or run `cd` commands in subshells: `(cd subdir && npm install)`.";
const SLOT = "{{SLOT:framework_cwd_guidance}}";
const textOf = (content: FileContent): string => content.kind === "text" ? content.text
  : new TextDecoder("utf-8", { ignoreBOM: true }).decode(content.bytes);

const snapshot = (document: NeutralDocument): NeutralDocument => {
  const content = document.content;
  if (content.kind === "text") return Object.freeze({ source: document.source, role: document.role,
    content: Object.freeze({ kind: "text", text: content.text }) });
  const bytes = new Uint8Array(content.bytes);
  return Object.freeze({ source: document.source, role: document.role,
    get content(): FileContent { return { kind: "bytes", bytes: new Uint8Array(bytes) }; } });
};

export const admitCwdDocuments = (request: {
  readonly documents: readonly NeutralDocument[]; readonly guidance: CwdGuidanceSource;
}): Result<AdmittedCwdDocuments, string> => {
  const documents = Object.freeze(request.documents.map(snapshot));
  if (request.guidance?.kind !== "legacy-authored" && request.guidance?.kind !== "framework-cwd") return refused("CWD authoring intent must be declared explicitly.");
  if (request.guidance.kind === "legacy-authored") return accepted(brand<AdmittedCwdDocuments>(Object.freeze({
    documents, guidance: Object.freeze({ kind: "legacy-authored" }) })));
  if (typeof request.guidance.source !== "string") return refused("The declared CWD protocol source must be a portable source path.");
  const source = sourcePath(request.guidance.source);
  if (!source.ok) return refused("The declared CWD protocol source must be a portable source path.");
  const targets = documents.filter((document) => document.source === source.value);
  if (targets.length !== 1 || targets[0]?.role !== "protocol") return refused("Declared CWD guidance requires exactly one captured protocol at its authored source.");
  if (textOf(targets[0].content).split(SLOT).length !== 2) return refused("Declared CWD guidance requires exactly one {{SLOT:framework_cwd_guidance}} position.");
  return accepted(brand<AdmittedCwdDocuments>(Object.freeze({ documents,
    guidance: Object.freeze({ kind: "framework-cwd", source: source.value }) })));
};

export const bindCwdDocuments = (request: {
  readonly captured: AdmittedCwdDocuments; readonly channel: DistributionChannel;
}): readonly NeutralDocument[] => {
  const guidance = request.captured.guidance;
  return guidance.kind === "legacy-authored" ? request.captured.documents
    : request.captured.documents.map((document) => document.source !== guidance.source ? document
      : { ...document, content: { kind: "text", text: textOf(document.content).replace(SLOT,
        request.channel === "copy" ? COPY : NATIVE) } });
};
