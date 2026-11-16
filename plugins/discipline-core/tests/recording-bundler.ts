import type { Result } from "../core/values/result.ts";
import type { Bundle, BundleFailure, BundleRequest, BundlerPort } from "../scripts/esbuild-bundler-port.ts";
import type { InMemoryFiles } from "./in-memory-files.ts";

export type RecordingBundler = {
  readonly bundler: BundlerPort;
  readonly requests: () => readonly BundleRequest[];
  readonly stagedWhenBundled: () => readonly string[];
};

export const recordingBundler = (request: {
  readonly files: InMemoryFiles;
  readonly stage: string;
  readonly bundle: Result<Bundle, BundleFailure>;
}): RecordingBundler => {
  const recorded: { requests: readonly BundleRequest[]; staged: readonly string[] } = { requests: [], staged: [] };
  return {
    requests: () => recorded.requests,
    stagedWhenBundled: () => recorded.staged,
    bundler: {
      bundle: (bundleRequest) => {
        recorded.requests = [...recorded.requests, bundleRequest];
        recorded.staged = request.files.pathsUnder({ folder: request.stage });
        return Promise.resolve(request.bundle);
      },
    },
  };
};
