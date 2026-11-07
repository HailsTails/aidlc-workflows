import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";

type SidecarFileReader = {
  readonly fileExists: (path: string) => boolean;
  readonly readFile: (path: string) => string | undefined;
  readonly listDirectory: (path: string) => readonly string[] | undefined;
};

const entriesAfterDirectoryFailure = ({ error }: { readonly error: unknown }): readonly string[] | undefined =>
  error instanceof Error && "code" in error && error.code === "ENOENT"
    ? []
    : undefined;

const defaultSidecarFileReader = (): SidecarFileReader => ({
  fileExists: (path) => existsSync(path),
  readFile: (path) => {
    try {
      return readFileSync(path, "utf-8");
    } catch {
      return undefined;
    }
  },
  listDirectory: (path) => {
    try {
      return readdirSync(path);
    } catch (error) {
      return entriesAfterDirectoryFailure({ error });
    }
  },
});

type FileKindPort = {
  readonly isFile: (path: string) => boolean;
  readonly isDirectory: (path: string) => boolean;
};

const defaultFileKindPort = (): FileKindPort => {
  const isKind = (path: string, kind: "file" | "directory"): boolean => {
    try {
      const stat = statSync(path);
      return kind === "file" ? stat.isFile() : stat.isDirectory();
    } catch {
      return false;
    }
  };
  return {
    isFile: (path) => isKind(path, "file"),
    isDirectory: (path) => isKind(path, "directory"),
  };
};

export type { FileKindPort, SidecarFileReader };
export { defaultFileKindPort, defaultSidecarFileReader, entriesAfterDirectoryFailure };


type TextEncoding = "utf8" | "utf-8";
type DirectoryOptions = { readonly recursive?: boolean };
type RemovalOptions = { readonly recursive?: boolean; readonly force?: boolean };
type FileTextPort = {
  readonly exists: (path: string) => boolean;
  readonly read: (path: string, encoding?: TextEncoding) => string;
  readonly write: (path: string, text: string, encoding?: TextEncoding) => void;
  readonly writeExecutable: (path: string, text: string) => void;
  readonly append: (path: string, text: string, encoding?: TextEncoding) => void;
  readonly mkdir: (path: string, options?: DirectoryOptions) => void;
  readonly remove: (path: string, options?: RemovalOptions) => void;
  readonly makeTemporaryDirectory: (prefix: string) => string;
  readonly temporaryRoot: () => string;
};

const fileOperation = <Value>(operation: () => Value): Value => {
  try { return operation(); }
  catch (error) { throw new Error(error instanceof Error ? error.message : String(error)); }
};

const EXECUTABLE_FILE_MODE = 0o755;

const defaultFileTextPort = (): FileTextPort => ({
  exists: (path) => existsSync(path),
  read: (path, encoding = "utf8") => fileOperation(() => readFileSync(path, encoding)),
  write: (path, text, encoding = "utf8") => fileOperation(() => writeFileSync(path, text, encoding)),
  writeExecutable: (path, text) =>
    fileOperation(() => writeFileSync(path, text, { encoding: "utf8", mode: EXECUTABLE_FILE_MODE })),
  append: (path, text, encoding = "utf8") => fileOperation(() => appendFileSync(path, text, encoding)),
  mkdir: (path, options) => { fileOperation(() => mkdirSync(path, options)); },
  remove: (path, options) => fileOperation(() => rmSync(path, options)),
  makeTemporaryDirectory: (prefix) => fileOperation(() => mkdtempSync(prefix)),
  temporaryRoot: () => tmpdir(),
});

export type { FileTextPort };
export { defaultFileTextPort };
