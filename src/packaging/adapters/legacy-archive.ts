import { createTarGz } from "../../../core/tools/aidlc-archive.ts";
import type { FileContent } from "../../kernel/file-content.ts";
import { asFolder, type FileSystem } from "../../kernel/file-system-port.ts";
import { accepted, refused, type Result } from "../../kernel/result.ts";
import { projectPath } from "../../kernel/values.ts";
import type { ArtifactWriter, ContentHasher } from "../application/ports.ts";
import type { ArchiveFile, PackagingRefusal } from "../domain/artifact.ts";

const REGULAR_MODE = 0o644;
const EXECUTABLE_MODE = 0o755;
const legacyBytes = (content: FileContent): Buffer =>
  content.kind === "text" ? Buffer.from(content.text) : Buffer.from(content.bytes);

const encodedArchive = ({ files, name }: { readonly files: readonly ArchiveFile[]; readonly name: string }, encode: typeof createTarGz)
: Result<Uint8Array, PackagingRefusal> => {
  try {
    return accepted(encode(files.map((file) => ({ path: file.entry, type: "file",
      mode: file.mode === "executable" ? EXECUTABLE_MODE : REGULAR_MODE, data: legacyBytes(file.content) }))));
  } catch (error) {
    return refused({ kind: "archive-not-written", name, reason: error instanceof Error ? error.message : String(error) });
  }
};

export const createLegacyArtifactWriter = (binding: {
  readonly folder: URL;
  readonly fileSystem: Pick<FileSystem, "makeFolder" | "writeFile">;
  readonly hasher: ContentHasher;
}, encode: typeof createTarGz = createTarGz): ArtifactWriter => ({ write: async (request) => {
  const name = projectPath(request.name);
  if (!name.ok) return refused({ kind: "archive-not-written", name: request.name,
    reason: "The archive name must be a portable project-relative path." });
  const encoded = encodedArchive(request, encode);
  if (!encoded.ok) return encoded;
  const content: FileContent = { kind: "bytes", bytes: encoded.value };
  const digest = binding.hasher.hash(content);
  if (!digest.ok) return refused({ kind: "archive-not-written", name: request.name, reason: JSON.stringify(digest.refusal) });
  const target = new URL(name.value.split("/").map(encodeURIComponent).join("/"), asFolder(binding.folder));
  const created = await binding.fileSystem.makeFolder({ folder: new URL("./", target) });
  if (!created.ok) return refused({ kind: "archive-not-written", name: request.name, reason: created.refusal.code });
  const written = await binding.fileSystem.writeFile({ file: target, content, mode: "regular" });
  return written.ok ? accepted(digest.value)
    : refused({ kind: "archive-not-written", name: request.name, reason: written.refusal.code });
} });
