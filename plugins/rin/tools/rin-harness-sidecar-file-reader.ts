import { existsSync, readdirSync, readFileSync } from "node:fs";

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

export type { SidecarFileReader };
export { defaultSidecarFileReader, entriesAfterDirectoryFailure };
