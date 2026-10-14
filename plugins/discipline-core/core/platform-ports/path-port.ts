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
  readonly resolve: (request: { readonly path: string }) => AbsolutePath;
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
    return parsed.success
      ? { outcome: "ok", value: parsed.data }
      : notAFileUrl({ url: request.url, detail: "the file URL names no absolute path" });
  } catch (thrown) {
    return notAFileUrl({
      url: request.url,
      detail: thrown instanceof Error ? thrown.message : String(thrown),
    });
  }
};

export type WorkingDirectory = (request: Record<string, never>) => string;

const absoluteFormOf = (request: {
  readonly path: string;
  readonly workingDirectory: WorkingDirectory;
}): string =>
  posix.isAbsolute(request.path)
    ? posix.normalize(request.path)
    : posix.resolve(request.workingDirectory({}), request.path);

export const createPathPort = (options: {
  readonly workingDirectory: WorkingDirectory;
}): PathPort => ({
  join: (request) => posix.join(...request.segments),
  relative: (request) => posix.relative(request.from, request.to),
  directoryOf: (request) => posix.dirname(request.path),
  resolve: (request) =>
    absolutePathSchema.parse(
      absoluteFormOf({ path: request.path, workingDirectory: options.workingDirectory }),
    ),
  fromFileUrl: (request) =>
    URL.canParse(request.url) && new URL(request.url).protocol === "file:"
      ? absolutePathOfFileUrl({ url: request.url })
      : notAFileUrl({ url: request.url, detail: "the text is not a file: URL" }),
});

export const defaultWorkingDirectory: WorkingDirectory = () => process.cwd();

export const createDefaultPathPort = (_options: Record<string, never>): PathPort =>
  createPathPort({ workingDirectory: defaultWorkingDirectory });
