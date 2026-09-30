import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

type Result<T, E> =
  | { readonly outcome: "ok"; readonly value: T }
  | { readonly outcome: "failed"; readonly error: E };

const succeed = <T>(value: T): Result<T, never> => ({ outcome: "ok", value });
const failWith = <E>(error: E): Result<never, E> => ({
  outcome: "failed",
  error,
});

type RecordStoreFailure =
  | {
      readonly kind: "read-failed";
      readonly path: string;
      readonly detail: string;
    }
  | {
      readonly kind: "write-failed";
      readonly path: string;
      readonly detail: string;
    };

type RecordStore = {
  readonly readBinding: (args: {
    readonly recordDir: string;
  }) => Result<string | null, RecordStoreFailure>;
  readonly writeBinding: (args: {
    readonly recordDir: string;
    readonly contents: string;
  }) => Result<void, RecordStoreFailure>;
  readonly listRecordDirs: (args: {
    readonly intentsRoot: string;
  }) => Result<readonly string[], RecordStoreFailure>;
};

type Clock = { readonly nowUtc: () => Date };

const detailOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const isMissingEntry = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  error.code === "ENOENT";

// The three fs capabilities are parameters with real defaults so the wrapper's
// own mapping — notably ENOENT to an absent-not-failed result — is provable
// without touching disk (CD-47) and without module-mocking (CD-26).
type FileSystemCapabilities = {
  readonly readFile: (args: { readonly path: string }) => string;
  readonly writeFile: (args: {
    readonly path: string;
    readonly contents: string;
  }) => void;
  readonly readDirectoryNames: (args: {
    readonly path: string;
  }) => readonly string[];
  readonly directoryExists: (args: { readonly path: string }) => boolean;
};

const nodeFileSystemCapabilities: FileSystemCapabilities = {
  readFile: ({ path }) => readFileSync(path, "utf-8"),
  writeFile: ({ path, contents }) => writeFileSync(path, contents, "utf-8"),
  readDirectoryNames: ({ path }) =>
    readdirSync(path, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name),
  directoryExists: ({ path }) => existsSync(path),
};

const createRecordStore = (args: {
  readonly bindingFilename: string;
  readonly fileSystem: FileSystemCapabilities;
}): RecordStore => ({
  readBinding: ({ recordDir }) => {
    const path = join(recordDir, args.bindingFilename);
    try {
      return succeed(args.fileSystem.readFile({ path }));
    } catch (error) {
      return isMissingEntry(error)
        ? succeed(null)
        : failWith({
            kind: "read-failed",
            path,
            detail: detailOf(error),
          });
    }
  },
  writeBinding: ({ recordDir, contents }) => {
    const path = join(recordDir, args.bindingFilename);
    try {
      args.fileSystem.writeFile({ path, contents });
      return succeed(undefined);
    } catch (error) {
      return failWith({ kind: "write-failed", path, detail: detailOf(error) });
    }
  },
  listRecordDirs: ({ intentsRoot }) => {
    try {
      return succeed(
        args.fileSystem
          .readDirectoryNames({ path: intentsRoot })
          .map((name) => join(intentsRoot, name))
          .sort(),
      );
    } catch (error) {
      return isMissingEntry(error)
        ? succeed([])
        : failWith({
            kind: "read-failed",
            path: intentsRoot,
            detail: detailOf(error),
          });
    }
  },
});

const createNodeRecordStore = (args: {
  readonly bindingFilename: string;
}): RecordStore =>
  createRecordStore({
    bindingFilename: args.bindingFilename,
    fileSystem: nodeFileSystemCapabilities,
  });

const createSystemClock = (): Clock => ({ nowUtc: () => new Date() });

export {
  type Clock,
  createNodeRecordStore,
  createRecordStore,
  createSystemClock,
  type FileSystemCapabilities,
  nodeFileSystemCapabilities,
  type RecordStore,
  type RecordStoreFailure,
};
