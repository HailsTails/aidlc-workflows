import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import {
  createDefaultPathPort,
  type PathPort,
} from "../../plugins/discipline-core/core/platform-ports/path-port.ts";

export type FixtureFiles = {
  readonly temporaryRoot: () => string;
  readonly read: (path: string) => string;
  readonly write: (path: string, text: string) => void;
  readonly directory: (path: string) => void;
  readonly copy: (source: string, destination: string) => void;
  readonly remove: (path: string) => void;
  readonly redirect: (target: string, link: string) => void;
};

export type FixtureWorkspace = {
  readonly root: string;
  readonly path: (relativePath: string) => string;
  readonly relative: (absolutePath: string) => string;
  readonly read: (relativePath: string) => string;
  readonly write: (relativePath: string, text: string) => void;
  readonly directory: (relativePath: string) => void;
  readonly copyFrom: (source: string, relativePath: string) => void;
  readonly remove: (relativePath: string) => void;
  readonly redirectDirectory: (relativePath: string, targetPath: string) => void;
  readonly [Symbol.dispose]: () => void;
};

const workspaceRelativePath = (request: {
  readonly root: string;
  readonly path: string;
  readonly paths: PathPort;
}): string => {
  const location = request.paths.relative({ from: request.root, to: request.path });
  if (
    location.relation === "different-root" ||
    location.path === ".." ||
    location.path.startsWith("../")
  ) {
    throw new Error("fixture path is outside its workspace");
  }
  return location.path;
};

/** Paths are lexically confined, not a sandbox for untrusted symlink trees. Copies read trusted fixture/release sources. */
export const createFixtureWorkspace = (options: {
  readonly files: FixtureFiles;
  readonly paths: PathPort;
}): FixtureWorkspace => {
  const root = options.files.temporaryRoot();
  const relative = (absolutePath: string): string =>
    workspaceRelativePath({ root, path: absolutePath, paths: options.paths });
  const path = (relativePath: string): string => {
    if (/^(?:[A-Za-z]:|[\\/])/.test(relativePath)) {
      throw new Error("fixture path must be relative to its workspace");
    }
    const destination = options.paths.join({ segments: [root, relativePath] });
    relative(destination);
    return destination;
  };
  return {
    root,
    path,
    relative,
    read: (relativePath) => options.files.read(path(relativePath)),
    write: (relativePath, text) => {
      const destination = path(relativePath);
      options.files.directory(options.paths.directoryOf({ path: destination }));
      options.files.write(destination, text);
    },
    directory: (relativePath) => options.files.directory(path(relativePath)),
    copyFrom: (source, relativePath) => options.files.copy(source, path(relativePath)),
    remove: (relativePath) => options.files.remove(path(relativePath)),
    redirectDirectory: (relativePath, targetPath) =>
      options.files.redirect(path(targetPath), path(relativePath)),
    [Symbol.dispose]: () => options.files.remove(root),
  };
};

/** Native types and link-kind differences remain at the fixture resource boundary. */
export const createDefaultFixtureWorkspace = (): FixtureWorkspace => {
  const paths = createDefaultPathPort({});
  return createFixtureWorkspace({
    paths,
    files: {
      temporaryRoot: () => mkdtempSync(paths.join({ segments: [tmpdir(), "aidlc-fixture-"] })),
      read: (path) => readFileSync(path, "utf8"),
      write: (path, text) => {
        writeFileSync(path, text);
      },
      directory: (path) => {
        mkdirSync(path, { recursive: true });
      },
      copy: (source, destination) => cpSync(source, destination, { recursive: true }),
      remove: (path) => rmSync(path, { recursive: true, force: true }),
      redirect: (target, link) =>
        symlinkSync(target, link, process.platform === "win32" ? "junction" : "dir"),
    },
  });
};
