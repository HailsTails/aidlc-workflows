import type { FileContent } from "../../kernel/file-content.ts";
import { asFolder, type TreeSelection } from "../../kernel/file-system-port.ts";
import { accepted, refused } from "../../kernel/result.ts";
import { sourcePath, type SourcePath } from "../../kernel/values.ts";
import { METHOD_SOURCE_FOLDERS } from "../../workflow-definition/domain/method-source.ts";
import type { MethodSource } from "../../workflow-definition/domain/method-source.ts";
import type { HostFileReader } from "../application/ports/host-sources.ts";
import type { NeutralReading } from "../application/ports/documents.ts";
import type { SessionSkillTreeReader } from "../application/ports/skills.ts";
import type { NeutralDocument, NeutralDocumentRole } from "../domain/neutral-surface.ts";
import type { ProjectionRefusal } from "../domain/projection.ts";

type DocumentCapture = {
  readonly documents: readonly NeutralDocument[];
  readonly failures: readonly ProjectionRefusal[];
};
const copyContent = (content: FileContent): FileContent => content.kind === "text" ? content
  : { kind: "bytes", bytes: new Uint8Array(content.bytes) };
const decode = (content: FileContent): string => content.kind === "text" ? content.text
  : new TextDecoder("utf-8", { ignoreBOM: true }).decode(content.bytes);
const unreadable = (source: SourcePath, reason: string): ProjectionRefusal =>
  ({ kind: "neutral-source-unreadable", source, reason });
const invalidSource = (name: string): ProjectionRefusal => ({ kind: "render-failed",
  concept: "neutral-document", name, reason: "The neutral source is not a portable path." });

const capturedDocument = ({ source, role, content }: {
  readonly source: string; readonly role: NeutralDocumentRole; readonly content: FileContent;
}): DocumentCapture => {
  const path = sourcePath(source);
  return path.ok ? { documents: [{ source: path.value, role, content: copyContent(content) }], failures: [] }
    : { documents: [], failures: [invalidSource(source)] };
};
const authoredDocuments = (sources: readonly MethodSource[]): DocumentCapture => {
  const captures = sources.flatMap((source): readonly DocumentCapture[] => {
    const role = source.path.startsWith(`${METHOD_SOURCE_FOLDERS.stage}/`) ? "stage"
      : source.path.startsWith(`${METHOD_SOURCE_FOLDERS.knowledge}/`) ? "knowledge" : null;
    return role === null ? [] : [capturedDocument({ source: source.path, role, content: source.content })];
  });
  return { documents: captures.flatMap((capture) => capture.documents),
    failures: captures.flatMap((capture) => capture.failures) };
};
const selectProtocol: TreeSelection = ({ within, kind }) =>
  kind === "folder" || within.endsWith(".md") ? "read" : "skip";

const protocolDocuments = async (tree: SessionSkillTreeReader, core: URL): Promise<DocumentCapture> => {
  const folder = "aidlc-common/protocols";
  const root = sourcePath(folder);
  if (!root.ok) return { documents: [], failures: [invalidSource(folder)] };
  const reading = await tree.readTree({ folder: new URL(`${folder}/`, core), select: selectProtocol });
  if (!reading.ok) return { documents: [], failures: [unreadable(root.value, reading.refusal.code)] };
  const captures = reading.value.files.map((file) => capturedDocument({ source: `${folder}/${file.path}`, role: "protocol", content: file.content }));
  return { documents: captures.flatMap((capture) => capture.documents), failures: [
    ...reading.value.unreadable.map((failure) => {
      const raw = `${folder}/${failure.within}`.replace(/\/$/, "");
      const path = sourcePath(raw);
      return unreadable(path.ok ? path.value : root.value,
        path.ok ? failure.code : `${failure.code}: ${raw}`);
    }),
    ...captures.flatMap((capture) => capture.failures),
  ] };
};

type NeutralReadPorts = { readonly files: HostFileReader; readonly tree: SessionSkillTreeReader };
const readText = async ({ files, core, source }: {
  readonly files: HostFileReader; readonly core: URL; readonly source: string;
}) => {
  const path = sourcePath(source);
  if (!path.ok) return refused(invalidSource(source));
  const reading = await files.readFile({ file: new URL(source, core) });
  return reading.ok ? accepted(decode(reading.value)) : refused(unreadable(path.value, reading.refusal.code));
};

export const createNeutralReading = (ports: NeutralReadPorts): NeutralReading => async (capture) => {
  const core = asFolder(capture.core);
  const [conductor, protocols, neutral, harness] = await Promise.all([
    readText({ files: ports.files, core, source: "aidlc-common/conductor.md" }), protocolDocuments(ports.tree, core),
    readText({ files: ports.files, core, source: "templates/onboarding.md" }),
    readText({ files: ports.files, core, source: "templates/onboarding-harness.md" }),
  ]);
  const authored = authoredDocuments(capture.sources);
  const failures = [conductor, neutral, harness].flatMap((reading) => reading.ok ? [] : [reading.refusal]);
  failures.push(...protocols.failures, ...authored.failures);
  if (!conductor.ok || !neutral.ok || !harness.ok || failures.length > 0) return refused(failures);
  const captured = capturedDocument({ source: "aidlc-common/conductor.md", role: "conductor",
    content: { kind: "text", text: conductor.value } });
  return accepted({ documents: [...captured.documents, ...protocols.documents, ...authored.documents],
    skills: [], onboarding: { neutral: neutral.value, harnessSkeleton: harness.value } });
};
