import { posix } from "node:path";
import { fileURLToPath } from "node:url";
import { type AbsolutePath, absolutePathSchema } from "../values/absolute-path.ts";
import type { Result } from "../values/result.ts";

export type PathPort = {
  readonly join: (request: { readonly segments: readonly string[] }) => string;
  readonly relative: (request: {
    readonly from: string;
    readonly to: string;
  }) => string;
  readonly directoryOf: (request: { readonly path: string }) => string;
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
}): Result<AbsolutePath, FileUrlFailure["error"]> => {
  try {
    const parsed = absolutePathSchema.safeParse(fileURLToPath(request.url));
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

const workingDirectoryText = (request: { readonly workingDirectory: WorkingDirectory }): string => {
  try {
    return request.workingDirectory({});
  } catch {
    return UNREADABLE_WORKING_DIRECTORY;
  }
};

const absoluteFormOf = (request: {
  readonly path: string;
  readonly workingDirectory: WorkingDirectory;
}): string => {
  if (posix.isAbsolute(request.path)) {
    return posix.normalize(request.path);
  }
  const workingDirectory = workingDirectoryText(request);
  if (!posix.isAbsolute(workingDirectory)) {
    return posix.normalize(request.path);
  }
  return posix.resolve(workingDirectory, request.path);
};

const rootedFormOf = (request: {
  readonly path: string;
  readonly workingDirectory: WorkingDirectory;
}): string => posix.join(posix.sep, absoluteFormOf(request));

export const createPathPort = (options: {
  readonly workingDirectory: WorkingDirectory;
}): PathPort => ({
  join: (request) => posix.join(...request.segments),
  relative: (request) =>
    posix.relative(
      rootedFormOf({ path: request.from, workingDirectory: options.workingDirectory }),
      rootedFormOf({ path: request.to, workingDirectory: options.workingDirectory }),
    ),
  directoryOf: (request) => posix.dirname(request.path),
  resolve: (request) =>
    absoluteFormOf({ path: request.path, workingDirectory: options.workingDirectory }),
  fromFileUrl: (request) =>
    fileUrlForm({ url: request.url }) === "not-a-file-url"
      ? notAFileUrl({ url: request.url, detail: "the text is not a file: URL" })
      : absolutePathOfFileUrl({ url: request.url }),
});

export const defaultWorkingDirectory: WorkingDirectory = () => process.cwd();

export const createDefaultPathPort = (_options: Record<string, never>): PathPort =>
  createPathPort({ workingDirectory: defaultWorkingDirectory });
