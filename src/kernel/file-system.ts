import type { Dirent } from "node:fs";
import { chmod, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  asFolder,
  walkTree,
  type FileSystem,
  type FileSystemError,
  type FileSystemFault,
  type FileWriteError,
  type FolderEntry,
} from "./file-system-port.ts";
import type { FileMode } from "./file-content.ts";
import { accepted, refused, type Result } from "./result.ts";

type NodeWriteFileArgs = { readonly file: URL; readonly bytes: Uint8Array; readonly mode: FileMode };

export type NodeFileLib = {
  readonly readFile: (file: URL) => Promise<Uint8Array>;
  readonly readdir: (folder: URL) => Promise<readonly FolderEntry[]>;
  readonly makeTemporaryFolder: (parent: URL) => Promise<URL>;
  readonly makeFolder: (folder: URL) => Promise<void>;
  readonly writeFile: (nodeWriteFileArgs: NodeWriteFileArgs) => Promise<void>;
  readonly removeFolder: (folder: URL) => Promise<void>;
  readonly removeEntry: (entry: URL) => Promise<void>;
};

export type CreateNodeFileSystemArgs = { readonly fileLib?: NodeFileLib };

const SCRATCH_PREFIX = "scratch-";
const EXECUTABLE_PERMISSIONS = 0o755;

const FAULTS_BY_ERRNO: ReadonlyMap<string, FileSystemFault> = new Map([
  ["ENOENT", "not-found"],
  ["ENOTDIR", "not-found"],
  ["EACCES", "permission-denied"],
  ["EPERM", "permission-denied"],
  ["EISDIR", "not-a-file"],
]);

const faultOf = (thrown: unknown): FileSystemFault => {
  const errno = thrown instanceof Error && "code" in thrown ? String(thrown.code) : "";
  return FAULTS_BY_ERRNO.get(errno) ?? "failed";
};

const failingAs = <Failure>(failure: (code: FileSystemFault) => Failure) =>
  async <Value>(operation: () => Promise<Value>): Promise<Result<Value, Failure>> => {
    try {
      return accepted(await operation());
    } catch (thrown) {
      return refused(failure(faultOf(thrown)));
    }
  };

const attempt = failingAs((code): FileSystemError => ({ kind: "unreadable", code }));

const attemptWrite = failingAs((code): FileWriteError => ({ kind: "unwritable", code }));

const entryKind = (entry: Dirent): FolderEntry["kind"] => {
  if (entry.isDirectory()) return "folder";
  return entry.isFile() ? "file" : "other";
};

const nodeFileLib: NodeFileLib = {
  readFile: async (file) => new Uint8Array(await readFile(file)),
  readdir: async (folder) => (await readdir(folder, { withFileTypes: true }))
    .map((entry) => ({ name: entry.name, kind: entryKind(entry) })),
  makeTemporaryFolder: async (parent) => {
    await mkdir(parent, { recursive: true });
    return pathToFileURL(await mkdtemp(`${fileURLToPath(asFolder(parent))}${SCRATCH_PREFIX}`));
  },
  makeFolder: async (folder) => {
    await mkdir(folder, { recursive: true });
  },
  writeFile: async ({ file, bytes, mode }) => {
    await mkdir(new URL(".", file), { recursive: true });
    await writeFile(file, bytes);
    if (mode === "executable") await chmod(file, EXECUTABLE_PERMISSIONS);
  },
  removeFolder: (folder) => rm(folder, { recursive: true, force: true }),
  removeEntry: (entry) => rm(entry, { recursive: true }),
};

const bytesOf = (content: Parameters<FileSystem["writeFile"]>[0]["content"]): Uint8Array =>
  content.kind === "bytes" ? content.bytes : new TextEncoder().encode(content.text);

export const createNodeFileSystem = (
  { fileLib = nodeFileLib }: CreateNodeFileSystemArgs = {},
): FileSystem => {
  const reads: Pick<FileSystem, "readFile" | "listFolder"> = {
    readFile: ({ file }) => attempt(async () => ({ kind: "bytes", bytes: await fileLib.readFile(file) })),
    listFolder: ({ folder }) => attempt(() => fileLib.readdir(folder)),
  };
  return {
    ...reads,
    readTree: ({ folder, select }) => walkTree({ fileSystem: reads, folder, select }),
    makeScratchFolder: ({ parent }) =>
      attemptWrite(async () => asFolder(await fileLib.makeTemporaryFolder(parent))),
    makeFolder: ({ folder }) => attemptWrite(async () => {
      await fileLib.makeFolder(folder);
      return asFolder(folder);
    }),
    writeFile: ({ file, content, mode = "regular" }) => attemptWrite(async () => {
      await fileLib.writeFile({ file, bytes: bytesOf(content), mode });
      return file;
    }),
    removeFolder: ({ folder }) => attemptWrite(async () => {
      await fileLib.removeFolder(folder);
      return asFolder(folder);
    }),
    removeEntry: ({ entry }) => attemptWrite(async () => {
      await fileLib.removeEntry(entry);
      return entry;
    }),
  };
};
