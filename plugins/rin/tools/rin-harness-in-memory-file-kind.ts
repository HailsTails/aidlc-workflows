import type { FileKindPort } from "./rin-harness-sidecar-file-reader.ts";

type InMemoryEntries = {
  readonly files: readonly string[];
  readonly directories: readonly string[];
};

const inMemoryFileKindPort = ({ files, directories }: InMemoryEntries): FileKindPort => ({
  isFile: (path) => files.includes(path),
  isDirectory: (path) => directories.includes(path),
});

export type { InMemoryEntries };
export { inMemoryFileKindPort };
