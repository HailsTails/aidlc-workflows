import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";

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
