import { readdirSync } from "node:fs";
import { join } from "node:path";

const EXCLUDED_DIRECTORY_NAMES: ReadonlySet<string> = new Set([
  "node_modules",
  "dist",
  "build",
  "coverage",
  ".git",
  ".claude",
  "aidlc",
  ".aidlc",
]);

const EXCLUDED_ROOT_DIRECTORY_NAMES: ReadonlySet<string> = new Set([
  "vendor",
  ".codex",
  ".opencode",
  ".agents",
]);

type DirectoryExclusion = (directory: { readonly name: string }) => boolean;

const isExcludedDirectory: DirectoryExclusion = ({ name }) =>
  EXCLUDED_DIRECTORY_NAMES.has(name);

const isExcludedRootDirectory: DirectoryExclusion = ({ name }) =>
  EXCLUDED_ROOT_DIRECTORY_NAMES.has(name) || isExcludedDirectory({ name });

type DirectoryEntry = {
  readonly name: string;
  readonly isDirectory: boolean;
};

type DirectoryReader = (directoryPath: string) => readonly DirectoryEntry[];

const createFsDirectoryReader = (): DirectoryReader => (directoryPath) => {
  try {
    return readdirSync(directoryPath, { withFileTypes: true }).map((entry) => ({
      name: entry.name,
      isDirectory: entry.isDirectory(),
    }));
  } catch {
    return [];
  }
};

const walkDirectory = ({
  directory,
  readDirectory,
  isExcluded,
}: {
  readonly directory: string;
  readonly readDirectory: DirectoryReader;
  readonly isExcluded: DirectoryExclusion;
}): readonly string[] =>
  readDirectory(directory).flatMap((entry) => {
    const entryPath = join(directory, entry.name);
    if (!entry.isDirectory) {
      return [entryPath];
    }
    if (isExcluded({ name: entry.name })) {
      return [];
    }
    return walkDirectory({
      directory: entryPath,
      readDirectory,
      isExcluded: isExcludedDirectory,
    });
  });

const walkSourceFiles = ({
  rootDir,
  readDirectory = createFsDirectoryReader(),
}: {
  readonly rootDir: string;
  readonly readDirectory?: DirectoryReader;
}): readonly string[] =>
  walkDirectory({
    directory: rootDir,
    readDirectory,
    isExcluded: isExcludedRootDirectory,
  });

export {
  createFsDirectoryReader,
  type DirectoryEntry,
  type DirectoryReader,
  EXCLUDED_DIRECTORY_NAMES,
  EXCLUDED_ROOT_DIRECTORY_NAMES,
  isExcludedDirectory,
  isExcludedRootDirectory,
  walkSourceFiles,
};
