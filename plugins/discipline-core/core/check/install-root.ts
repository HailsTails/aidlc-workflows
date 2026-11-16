import type { PathPort } from "../platform-ports/path-port.ts";
import type { AbsolutePath } from "../values/absolute-path.ts";
import { installRootAboveEntry } from "../values/install-layout.ts";
import type { Result } from "../values/result.ts";
import type { LoadFailure } from "./load-failure.ts";

const installRootUnresolvable = (request: {
  readonly url: string;
  readonly detail: string;
}): { readonly outcome: "failed"; readonly error: LoadFailure } => ({
  outcome: "failed",
  error: { kind: "install-root-unresolvable", url: request.url, detail: request.detail },
});

const installRootAboveCommand = (request: { readonly path: PathPort; readonly entry: string }): string =>
  installRootAboveEntry({
    entryFile: request.entry,
    entry: "command",
    directoryOf: (path) => request.path.directoryOf({ path }),
  });

export const installRootOf = (request: {
  readonly path: PathPort;
  readonly moduleUrl: string;
}): Result<AbsolutePath, LoadFailure> => {
  const entry = request.path.fromFileUrl({ url: request.moduleUrl });
  if (entry.outcome === "failed") {
    return installRootUnresolvable({ url: entry.error.url, detail: entry.error.detail });
  }
  const resolved = request.path.resolve({ path: installRootAboveCommand({ path: request.path, entry: entry.value }) });
  if (resolved.outcome === "failed") {
    return installRootUnresolvable({
      url: request.moduleUrl,
      detail: "the install root three directories above the entry file is not an absolute path",
    });
  }
  return resolved;
};
