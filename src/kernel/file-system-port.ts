import type { FileContent } from "./file-content.ts";
import { accepted, refused, type Result } from "./result.ts";
import { sourcePath, type SourcePath } from "./values.ts";

export type FileSystemFault = "not-found" | "permission-denied" | "not-a-file" | "failed";

export type FileSystemError = { readonly kind: "unreadable"; readonly code: FileSystemFault };

export type FileWriteError = { readonly kind: "unwritable"; readonly code: FileSystemFault };

export type FolderEntry = { readonly name: string; readonly kind: "file" | "folder" | "other" };

export type TreeFile = { readonly path: SourcePath; readonly content: FileContent };

export type UnreadableTreeFile = {
  readonly within: string;
  readonly code: FileSystemFault | "unportable-name";
};

export type TreeReading = {
  readonly files: readonly TreeFile[];
  readonly unreadable: readonly UnreadableTreeFile[];
};

export type ReadFileArgs = { readonly file: URL };

export type ListFolderArgs = { readonly folder: URL };

export type TreeEntry = { readonly within: string; readonly kind: FolderEntry["kind"] };

export type TreeSelection = (entry: TreeEntry) => "read" | "skip";

export const readEveryEntry: TreeSelection = () => "read";

export type ReadTreeArgs = { readonly folder: URL; readonly select: TreeSelection };

export type MakeScratchFolderArgs = { readonly parent: URL };

export type MakeFolderArgs = { readonly folder: URL };

export type WriteFileArgs = { readonly file: URL; readonly content: FileContent };

export type RemoveFolderArgs = { readonly folder: URL };

export type FileSystem = {
  readFile(readFileArgs: ReadFileArgs): Promise<Result<FileContent, FileSystemError>>;
  listFolder(listFolderArgs: ListFolderArgs): Promise<Result<readonly FolderEntry[], FileSystemError>>;
  readTree(readTreeArgs: ReadTreeArgs): Promise<Result<TreeReading, FileSystemError>>;
  makeScratchFolder(makeScratchFolderArgs: MakeScratchFolderArgs): Promise<Result<URL, FileWriteError>>;
  makeFolder(makeFolderArgs: MakeFolderArgs): Promise<Result<URL, FileWriteError>>;
  writeFile(writeFileArgs: WriteFileArgs): Promise<Result<URL, FileWriteError>>;
  removeFolder(removeFolderArgs: RemoveFolderArgs): Promise<Result<URL, FileWriteError>>;
};

export const asFolder = (folder: URL): URL =>
  folder.href.endsWith("/") ? folder : new URL(`${folder.href}/`);

type TreeWalkArgs = ReadTreeArgs & {
  readonly fileSystem: Pick<FileSystem, "readFile" | "listFolder">;
};

const byWithin = (left: string, right: string): number => (left < right ? -1 : Number(left > right));

const merged = (readings: readonly TreeReading[]): TreeReading => ({
  files: readings.flatMap((reading) => reading.files)
    .toSorted((left, right) => byWithin(left.path, right.path)),
  unreadable: readings.flatMap((reading) => reading.unreadable)
    .toSorted((left, right) => byWithin(left.within, right.within)),
});

type EntryVisit = TreeWalkArgs & { readonly entry: FolderEntry; readonly prefix: string };

const unreadableOnly = (within: string, code: UnreadableTreeFile["code"]): TreeReading =>
  ({ files: [], unreadable: [{ within, code }] });

const NOTHING_READ: TreeReading = { files: [], unreadable: [] };

const visitEntry = async (visit: EntryVisit): Promise<TreeReading> => {
  const within = `${visit.prefix}${visit.entry.name}`;
  if (visit.select({ within, kind: visit.entry.kind }) === "skip") return NOTHING_READ;
  const admitted = sourcePath(within);
  if (!admitted.ok) return unreadableOnly(within, "unportable-name");
  const segment = encodeURIComponent(visit.entry.name);
  if (visit.entry.kind === "other") return unreadableOnly(within, "not-a-file");
  if (visit.entry.kind === "folder") {
    return walkBelow({ ...visit, folder: new URL(`${segment}/`, visit.folder), prefix: `${within}/` });
  }
  const content = await visit.fileSystem.readFile({ file: new URL(segment, visit.folder) });
  return content.ok ? { files: [{ path: admitted.value, content: content.value }], unreadable: [] }
    : unreadableOnly(within, content.refusal.code);
};

const walkBelow = async (walk: TreeWalkArgs & { readonly prefix: string }): Promise<TreeReading> => {
  const listed = await walk.fileSystem.listFolder({ folder: walk.folder });
  if (!listed.ok) return unreadableOnly(walk.prefix, listed.refusal.code);
  const readings = await Promise.all(listed.value.map((entry) => visitEntry({ ...walk, entry })));
  return merged(readings);
};

export const walkTree = async (walk: TreeWalkArgs): Promise<Result<TreeReading, FileSystemError>> => {
  const folder = asFolder(walk.folder);
  const listed = await walk.fileSystem.listFolder({ folder });
  if (!listed.ok) return refused(listed.refusal);
  const readings = await Promise.all(listed.value.map((entry) =>
    visitEntry({ ...walk, folder, entry, prefix: "" })));
  return accepted(merged(readings));
};
