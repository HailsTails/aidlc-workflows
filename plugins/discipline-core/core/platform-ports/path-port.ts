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
  readonly flavour: PathFlavour;
}): Result<AbsolutePath, FileUrlFailure["error"]> => {
  try {
    const parsed = absolutePathSchema.safeParse(
      fileURLToPath(request.url, { windows: request.flavour === win32 }),
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

const anchorRootOf = (request: { readonly flavour: PathFlavour }): string =>
  request.flavour === win32 ? WINDOWS_ANCHOR_ROOT : request.flavour.sep;

const workingDirectoryText = (request: { readonly workingDirectory: WorkingDirectory }): string => {
  try {
    return request.workingDirectory({});
  } catch {
    return UNREADABLE_WORKING_DIRECTORY;
  }
};

const rootOf = (request: { readonly path: string; readonly flavour: PathFlavour }): string =>
  request.flavour.parse(request.path).root.toLowerCase();

type RootForm = "fully-rooted" | "rooted-without-drive" | "drive-relative" | "relative";

const DRIVE_LESS_ROOTS: readonly string[] = ["\\", "/"];

const rootFormOf = (request: { readonly path: string; readonly flavour: PathFlavour }): RootForm => {
  const root = request.flavour.parse(request.path).root;
  if (root === "") {
    return "relative";
  }
  if (request.flavour === win32 && DRIVE_LESS_ROOTS.includes(root)) {
    return "rooted-without-drive";
  }
  return request.flavour.isAbsolute(request.path) ? "fully-rooted" : "drive-relative";
};

type WorkingDirectoryReading =
  | { readonly usability: "usable"; readonly directory: string }
  | { readonly usability: "unusable" };

const workingDirectoryReadingOf = (request: {
  readonly flavour: PathFlavour;
  readonly workingDirectory: WorkingDirectory;
}): WorkingDirectoryReading => {
  const directory = workingDirectoryText(request);
  return rootFormOf({ path: directory, flavour: request.flavour }) === "fully-rooted"
    ? { usability: "usable", directory }
    : { usability: "unusable" };
};

const driveRelationOf = (request: {
  readonly driveRoot: string;
  readonly reading: WorkingDirectoryReading;
  readonly flavour: PathFlavour;
}): "same-drive" | "another-drive" =>
  request.reading.usability === "usable" &&
  rootOf({ path: request.reading.directory, flavour: request.flavour }).startsWith(request.driveRoot.toLowerCase())
    ? "same-drive"
    : "another-drive";

const driveRelativeFormOf = (request: {
  readonly path: string;
  readonly flavour: PathFlavour;
  readonly workingDirectory: WorkingDirectory;
}): string => {
  const driveRoot = request.flavour.parse(request.path).root;
  const reading = workingDirectoryReadingOf(request);
  if (reading.usability === "unusable" || driveRelationOf({ driveRoot, reading, flavour: request.flavour }) === "another-drive") {
    return request.flavour.resolve(`${driveRoot}${request.flavour.sep}`, request.path);
  }
  return request.flavour.resolve(reading.directory, request.path);
};

const rootedWithoutDriveFormOf = (request: {
  readonly path: string;
  readonly flavour: PathFlavour;
  readonly workingDirectory: WorkingDirectory;
}): string => {
  const reading = workingDirectoryReadingOf(request);
  if (reading.usability === "unusable") {
    return request.flavour.normalize(request.path);
  }
  return request.flavour.resolve(request.flavour.parse(reading.directory).root, request.path);
};

const relativeFormOf = (request: {
  readonly path: string;
  readonly flavour: PathFlavour;
  readonly workingDirectory: WorkingDirectory;
}): string => {
  const reading = workingDirectoryReadingOf(request);
  if (reading.usability === "unusable") {
    return request.flavour.normalize(request.path);
  }
  return request.flavour.resolve(reading.directory, request.path);
};

const absoluteFormOf = (request: {
  readonly path: string;
  readonly flavour: PathFlavour;
  readonly workingDirectory: WorkingDirectory;
}): string => {
  const rootForm = rootFormOf(request);
  switch (rootForm) {
    case "fully-rooted":
      return request.flavour.normalize(request.path);
    case "rooted-without-drive":
      return rootedWithoutDriveFormOf(request);
    case "drive-relative":
      return driveRelativeFormOf(request);
    case "relative":
      return relativeFormOf(request);
  }
};

type DriveForm = "drive-carrying" | "drive-less";

const driveFormOf = (request: { readonly path: string; readonly flavour: PathFlavour }): DriveForm =>
  request.flavour === win32 && rootFormOf(request) === "fully-rooted" ? "drive-carrying" : "drive-less";

const relativeLocationBetween = (request: {
  readonly from: string;
  readonly to: string;
  readonly flavour: PathFlavour;
}): RelativeLocation => {
  const fromDriveForm = driveFormOf({ path: request.from, flavour: request.flavour });
  if (fromDriveForm !== driveFormOf({ path: request.to, flavour: request.flavour })) {
    return { relation: "different-root" };
  }
  if (fromDriveForm === "drive-carrying") {
    return relativeLocationOf(request);
  }
  const anchorRoot = anchorRootOf(request);
  return relativeLocationOf({
    flavour: request.flavour,
    from: request.flavour.resolve(anchorRoot, request.from),
    to: request.flavour.resolve(anchorRoot, request.to),
  });
};

const relativeLocationOf = (request: {
  readonly from: string;
  readonly to: string;
  readonly flavour: PathFlavour;
}): RelativeLocation =>
  rootOf({ path: request.from, flavour: request.flavour }) === rootOf({ path: request.to, flavour: request.flavour })
    ? {
        relation: "within-root",
        path: repositoryFormOf({ flavour: request.flavour, path: request.flavour.relative(request.from, request.to) }),
      }
    : { relation: "different-root" };

const repositoryFormOf = (request: { readonly path: string; readonly flavour: PathFlavour }): string =>
  request.path.split(request.flavour.sep).join(REPOSITORY_SEPARATOR);

export type PathFlavour = typeof posix;

export const posixPathFlavour: PathFlavour = posix;

export const windowsPathFlavour: PathFlavour = win32;

export const createFlavouredPathPort = (options: {
  readonly flavour: PathFlavour;
  readonly workingDirectory: WorkingDirectory;
}): PathPort => ({
  join: (request) => options.flavour.join(...request.segments),
  joinRepository: (request) => posix.join(...request.segments),
  relative: (request) =>
    relativeLocationBetween({
      flavour: options.flavour,
      from: absoluteFormOf({ path: request.from, flavour: options.flavour, workingDirectory: options.workingDirectory }),
      to: absoluteFormOf({ path: request.to, flavour: options.flavour, workingDirectory: options.workingDirectory }),
    }),
  directoryOf: (request) => options.flavour.dirname(request.path),
  repositoryDirectoryOf: (request) => posix.dirname(request.path),
  resolve: (request) =>
    absoluteFormOf({ path: request.path, flavour: options.flavour, workingDirectory: options.workingDirectory }),
  fromFileUrl: (request) =>
    fileUrlForm({ url: request.url }) === "not-a-file-url"
      ? notAFileUrl({ url: request.url, detail: "the text is not a file: URL" })
      : absolutePathOfFileUrl({ url: request.url, flavour: options.flavour }),
});

export const createPathPort = (options: {
  readonly workingDirectory: WorkingDirectory;
}): PathPort => createFlavouredPathPort({ flavour: platformPath, workingDirectory: options.workingDirectory });

export const defaultWorkingDirectory: WorkingDirectory = () => process.cwd();

export const createDefaultPathPort = (_options: Record<string, never>): PathPort =>
  createPathPort({ workingDirectory: defaultWorkingDirectory });
