import platformPath, { posix, win32 } from "node:path";
import { fileURLToPath } from "node:url";
import { type AbsolutePath, absolutePathSchema } from "../values/absolute-path.ts";
import type { Result } from "../values/result.ts";

export type RelativeLocation =
  | { readonly relation: "within-root"; readonly path: string }
  | { readonly relation: "different-root" };

export type PathPort = {
  readonly join: (request: { readonly segments: readonly string[] }) => string;
  readonly joinRepository: (request: { readonly segments: readonly string[] }) => string;
  readonly relative: (request: {
    readonly from: string;
    readonly to: string;
  }) => RelativeLocation;
  readonly directoryOf: (request: { readonly path: string }) => string;
  readonly repositoryDirectoryOf: (request: { readonly path: string }) => string;
  readonly resolve: (request: { readonly path: string }) => string;
  readonly fromFileUrl: (request: { readonly url: string }) => Result<
    AbsolutePath,
    {
      readonly kind: "not-a-file-url";
      readonly url: string;
      readonly detail: string;
    }
  >;
};

type FileUrlFailure = {
  readonly outcome: "failed";
  readonly error: {
    readonly kind: "not-a-file-url";
    readonly url: string;
    readonly detail: string;
  };
};

const notAFileUrl = (request: {
  readonly url: string;
  readonly detail: string;
}): FileUrlFailure => ({
  outcome: "failed",
  error: { kind: "not-a-file-url", url: request.url, detail: request.detail },
});

const absolutePathOfFileUrl = (request: {
  readonly url: string;
  readonly surface: PathSurface;
}): Result<AbsolutePath, FileUrlFailure["error"]> => {
  try {
    const parsed = absolutePathSchema.safeParse(
      fileURLToPath(request.url, { windows: request.surface === win32 }),
    );
    if (!parsed.success) {
      return notAFileUrl({ url: request.url, detail: "the file URL names no absolute path" });
    }
    return { outcome: "ok", value: parsed.data };
  } catch (thrown) {
    return notAFileUrl({
      url: request.url,
      detail: thrown instanceof Error ? thrown.message : String(thrown),
    });
  }
};

const fileUrlForm = (request: { readonly url: string }): "file-url" | "not-a-file-url" =>
  URL.canParse(request.url) && new URL(request.url).protocol === "file:" ? "file-url" : "not-a-file-url";

export type WorkingDirectory = (request: Record<string, never>) => string;

const UNREADABLE_WORKING_DIRECTORY = "";

const REPOSITORY_SEPARATOR = "/";

const WINDOWS_ANCHOR_ROOT = "C:\\";

const anchorRootOf = (request: { readonly surface: PathSurface }): string =>
  request.surface === win32 ? WINDOWS_ANCHOR_ROOT : request.surface.sep;

const workingDirectoryText = (request: { readonly workingDirectory: WorkingDirectory }): string => {
  try {
    return request.workingDirectory({});
  } catch {
    return UNREADABLE_WORKING_DIRECTORY;
  }
};

const rootOf = (request: { readonly path: string; readonly surface: PathSurface }): string =>
  request.surface.parse(request.path).root.toLowerCase();

type RootForm = "fully-rooted" | "rooted-without-drive" | "drive-relative" | "relative";

const DRIVE_LESS_ROOTS: readonly string[] = ["\\", "/"];

const rootFormOf = (request: { readonly path: string; readonly surface: PathSurface }): RootForm => {
  const root = request.surface.parse(request.path).root;
  if (root === "") {
    return "relative";
  }
  if (request.surface === win32 && DRIVE_LESS_ROOTS.includes(root)) {
    return "rooted-without-drive";
  }
  return request.surface.isAbsolute(request.path) ? "fully-rooted" : "drive-relative";
};

type WorkingDirectoryReading =
  | { readonly usability: "usable"; readonly directory: string }
  | { readonly usability: "unusable" };

const workingDirectoryReadingOf = (request: {
  readonly surface: PathSurface;
  readonly workingDirectory: WorkingDirectory;
}): WorkingDirectoryReading => {
  const directory = workingDirectoryText(request);
  return rootFormOf({ path: directory, surface: request.surface }) === "fully-rooted"
    ? { usability: "usable", directory }
    : { usability: "unusable" };
};

const driveRelationOf = (request: {
  readonly driveRoot: string;
  readonly reading: WorkingDirectoryReading;
  readonly surface: PathSurface;
}): "same-drive" | "another-drive" =>
  request.reading.usability === "usable" &&
  rootOf({ path: request.reading.directory, surface: request.surface }).startsWith(request.driveRoot.toLowerCase())
    ? "same-drive"
    : "another-drive";

const driveRelativeFormOf = (request: {
  readonly path: string;
  readonly surface: PathSurface;
  readonly workingDirectory: WorkingDirectory;
}): string => {
  const driveRoot = request.surface.parse(request.path).root;
  const reading = workingDirectoryReadingOf(request);
  if (reading.usability === "unusable" || driveRelationOf({ driveRoot, reading, surface: request.surface }) === "another-drive") {
    return request.surface.resolve(`${driveRoot}${request.surface.sep}`, request.path);
  }
  return request.surface.resolve(reading.directory, request.path);
};

const rootedWithoutDriveFormOf = (request: {
  readonly path: string;
  readonly surface: PathSurface;
  readonly workingDirectory: WorkingDirectory;
}): string => {
  const reading = workingDirectoryReadingOf(request);
  if (reading.usability === "unusable") {
    return request.surface.normalize(request.path);
  }
  return request.surface.resolve(request.surface.parse(reading.directory).root, request.path);
};

const relativeFormOf = (request: {
  readonly path: string;
  readonly surface: PathSurface;
  readonly workingDirectory: WorkingDirectory;
}): string => {
  const reading = workingDirectoryReadingOf(request);
  if (reading.usability === "unusable") {
    return request.surface.normalize(request.path);
  }
  return request.surface.resolve(reading.directory, request.path);
};

const absoluteFormOf = (request: {
  readonly path: string;
  readonly surface: PathSurface;
  readonly workingDirectory: WorkingDirectory;
}): string => {
  const rootForm = rootFormOf(request);
  switch (rootForm) {
    case "fully-rooted":
      return request.surface.normalize(request.path);
    case "rooted-without-drive":
      return rootedWithoutDriveFormOf(request);
    case "drive-relative":
      return driveRelativeFormOf(request);
    case "relative":
      return relativeFormOf(request);
  }
};

type DriveForm = "drive-carrying" | "drive-less";

const driveFormOf = (request: { readonly path: string; readonly surface: PathSurface }): DriveForm =>
  request.surface === win32 && rootFormOf(request) === "fully-rooted" ? "drive-carrying" : "drive-less";

const relativeLocationBetween = (request: {
  readonly from: string;
  readonly to: string;
  readonly surface: PathSurface;
}): RelativeLocation => {
  const fromDriveForm = driveFormOf({ path: request.from, surface: request.surface });
  if (fromDriveForm !== driveFormOf({ path: request.to, surface: request.surface })) {
    return { relation: "different-root" };
  }
  if (fromDriveForm === "drive-carrying") {
    return relativeLocationOf(request);
  }
  const anchorRoot = anchorRootOf(request);
  return relativeLocationOf({
    surface: request.surface,
    from: request.surface.resolve(anchorRoot, request.from),
    to: request.surface.resolve(anchorRoot, request.to),
  });
};

const relativeLocationOf = (request: {
  readonly from: string;
  readonly to: string;
  readonly surface: PathSurface;
}): RelativeLocation =>
  rootOf({ path: request.from, surface: request.surface }) === rootOf({ path: request.to, surface: request.surface })
    ? {
        relation: "within-root",
        path: repositoryFormOf({ surface: request.surface, path: request.surface.relative(request.from, request.to) }),
      }
    : { relation: "different-root" };

const repositoryFormOf = (request: { readonly path: string; readonly surface: PathSurface }): string =>
  request.path.split(request.surface.sep).join(REPOSITORY_SEPARATOR);

type PathSurface = typeof posix;

export type PathFlavour = "posix" | "windows" | "platform";

const surfaceOf = (request: { readonly flavour: PathFlavour }): PathSurface => {
  switch (request.flavour) {
    case "posix":
      return posix;
    case "windows":
      return win32;
    case "platform":
      return platformPath;
  }
};

const portOver = (options: {
  readonly surface: PathSurface;
  readonly workingDirectory: WorkingDirectory;
}): PathPort => ({
  join: (request) => options.surface.join(...request.segments),
  joinRepository: (request) => posix.join(...request.segments),
  relative: (request) =>
    relativeLocationBetween({
      surface: options.surface,
      from: absoluteFormOf({ path: request.from, surface: options.surface, workingDirectory: options.workingDirectory }),
      to: absoluteFormOf({ path: request.to, surface: options.surface, workingDirectory: options.workingDirectory }),
    }),
  directoryOf: (request) => options.surface.dirname(request.path),
  repositoryDirectoryOf: (request) => posix.dirname(request.path),
  resolve: (request) =>
    absoluteFormOf({ path: request.path, surface: options.surface, workingDirectory: options.workingDirectory }),
  fromFileUrl: (request) =>
    fileUrlForm({ url: request.url }) === "not-a-file-url"
      ? notAFileUrl({ url: request.url, detail: "the text is not a file: URL" })
      : absolutePathOfFileUrl({ url: request.url, surface: options.surface }),
});

export const createPathPort = (options: {
  readonly flavour: PathFlavour;
  readonly workingDirectory: WorkingDirectory;
}): PathPort => portOver({ surface: surfaceOf({ flavour: options.flavour }), workingDirectory: options.workingDirectory });

export const defaultWorkingDirectory: WorkingDirectory = () => process.cwd();

export const createDefaultPathPort = (_options: Record<string, never>): PathPort =>
  createPathPort({ flavour: "platform", workingDirectory: defaultWorkingDirectory });
