import type { PathPort } from "../platform-ports/path-port.ts";
import { type AbsolutePath, absolutePathSchema } from "../values/absolute-path.ts";
import type { Result } from "../values/result.ts";
import type { LoadFailure } from "./load-failure.ts";

const installRootUnresolvable = (request: {
  readonly url: string;
  readonly detail: string;
}): { readonly outcome: "failed"; readonly error: LoadFailure } => ({
  outcome: "failed",
  error: { kind: "install-root-unresolvable", url: request.url, detail: request.detail },
});

const threeLevelsAbove = (request: { readonly path: PathPort; readonly entry: string }): string =>
  request.path.directoryOf({
    path: request.path.directoryOf({ path: request.path.directoryOf({ path: request.entry }) }),
  });

export const installRootOf = (request: {
  readonly path: PathPort;
  readonly moduleUrl: string;
}): Result<AbsolutePath, LoadFailure> => {
  const entry = request.path.fromFileUrl({ url: request.moduleUrl });
  if (entry.outcome === "failed") {
    return installRootUnresolvable({ url: entry.error.url, detail: entry.error.detail });
  }
  const parsed = absolutePathSchema.safeParse(
    request.path.resolve({ path: threeLevelsAbove({ path: request.path, entry: entry.value }) }),
  );
  if (!parsed.success) {
    return installRootUnresolvable({
      url: request.moduleUrl,
      detail: "the install root three directories above the entry file is not an absolute path",
    });
  }
  return { outcome: "ok", value: parsed.data };
};
