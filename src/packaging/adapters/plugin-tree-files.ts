import { brand } from "../../kernel/brand.ts";
import { asFolder, readEveryEntry, type FileSystem } from "../../kernel/file-system-port.ts";
import { accepted, refused, type Result } from "../../kernel/result.ts";
import type { ArchiveEntry, ArchiveFile, PackagingRefusal } from "../domain/artifact.ts";

export const readPluginTreeFiles = async (request: {
  readonly root: URL;
  readonly fileSystem: Pick<FileSystem, "readTree">;
}): Promise<Result<readonly ArchiveFile[], readonly PackagingRefusal[]>> => {
  const reading = await request.fileSystem.readTree({ folder: asFolder(request.root), select: readEveryEntry });
  if (!reading.ok) return reading.refusal.code === "not-found" ? accepted([])
    : refused([{ kind: "plugin-tree-unreadable", within: "", code: reading.refusal.code }]);
  if (reading.value.unreadable.length > 0) return refused(reading.value.unreadable.map((entry) =>
    ({ kind: "plugin-tree-unreadable", within: entry.within, code: entry.code })));
  return accepted(reading.value.files.map((file) => ({ entry: brand<ArchiveEntry>(`plugins/${file.path}`),
    content: file.content, mode: "regular" })));
};
