import type { FileTextPort } from "../core/platform-ports/file-text-port.ts";
import type { PathPort } from "../core/platform-ports/path-port.ts";
import type { AbsolutePath } from "../core/values/absolute-path.ts";
import type { RepoPath } from "../core/values/repo-path.ts";
import type { Result } from "../core/values/result.ts";
import type { EffectFailure, ScratchFilesPort } from "./install-proof-ports.ts";

export type PreparedConsumerFixtures = {
  readonly providerRoot: AbsolutePath;
  readonly consumers: Readonly<Record<string, AbsolutePath>>;
  readonly providerFiles: Readonly<Record<string, {
    readonly file: AbsolutePath;
    readonly directory: AbsolutePath;
  }>>;
};

const absolutePathOf = (request: {
  readonly path: PathPort;
  readonly location: string;
}): Result<AbsolutePath, EffectFailure> => {
  const resolved = request.path.resolve({ path: request.location });
  return resolved.outcome === "ok" ? resolved : {
    outcome: "failed",
    error: { kind: "effect-failed", detail: `${request.location} resolves to no absolute path` },
  };
};

const copiedProviderFile = (request: {
  readonly file: RepoPath;
  readonly providerRoot: AbsolutePath;
  readonly sourceRoot: AbsolutePath;
  readonly path: PathPort;
  readonly scratch: ScratchFilesPort;
}): Result<PreparedConsumerFixtures["providerFiles"][string], EffectFailure> => {
  const file = absolutePathOf({
    path: request.path,
    location: request.path.join({ segments: [request.providerRoot, request.file] }),
  });
  if (file.outcome === "failed") return file;
  const directory = absolutePathOf({
    path: request.path,
    location: request.path.directoryOf({ path: file.value }),
  });
  if (directory.outcome === "failed") return directory;
  const copied = request.scratch.copyTree({
    from: request.path.join({ segments: [request.sourceRoot, request.file] }),
    to: file.value,
    disposition: () => "kept",
  });
  return copied.outcome === "failed" ? copied : {
    outcome: "ok", value: { file: file.value, directory: directory.value },
  };
};

const rewrittenFixture = (request: {
  readonly file: string;
  readonly previous: string;
  readonly replacement: string;
  readonly fileText: FileTextPort;
}): Result<void, EffectFailure> => {
  const read = request.fileText.read({ path: request.file });
  if (read.outcome === "failed") {
    return { outcome: "failed", error: { kind: "effect-failed", detail: `${request.file}: ${read.error.detail}` } };
  }
  if (!read.value.includes(request.previous)) {
    return {
      outcome: "failed",
      error: { kind: "effect-failed", detail: `${request.file} does not contain the requested import` },
    };
  }
  const written = request.fileText.write({
    path: request.file,
    text: read.value.replace(request.previous, () => request.replacement),
  });
  return written.outcome === "failed" ? {
    outcome: "failed", error: { kind: "effect-failed", detail: `${request.file}: ${written.error.detail}` },
  } : written;
};

export const prepareConsumerFixtures = (options: {
  readonly enclosure: AbsolutePath;
  readonly sourceRoot: AbsolutePath;
  readonly consumerFixture: AbsolutePath;
  readonly consumers: readonly RepoPath[];
  readonly providerFiles: readonly RepoPath[];
  readonly rewrites: readonly {
    readonly file: RepoPath;
    readonly previous: string;
    readonly replacement: string;
  }[];
  readonly scratch: ScratchFilesPort;
  readonly fileText: FileTextPort;
  readonly path: PathPort;
}): Result<PreparedConsumerFixtures, EffectFailure> => {
  const providerRoot = absolutePathOf({
    path: options.path,
    location: options.path.join({ segments: [options.enclosure, "provider"] }),
  });
  if (providerRoot.outcome === "failed") return providerRoot;
  const consumersRoot = absolutePathOf({
    path: options.path,
    location: options.path.join({ segments: [options.enclosure, "consumers"] }),
  });
  if (consumersRoot.outcome === "failed") return consumersRoot;
  const copied = options.scratch.copyTree({
    from: options.consumerFixture,
    to: consumersRoot.value,
    disposition: () => "kept",
  });
  if (copied.outcome === "failed") return copied;
  const providerFiles = options.providerFiles.reduce<Result<PreparedConsumerFixtures["providerFiles"], EffectFailure>>(
    (gathered, file) => {
      if (gathered.outcome === "failed") return gathered;
      const entry = copiedProviderFile({
        file,
        providerRoot: providerRoot.value,
        sourceRoot: options.sourceRoot,
        path: options.path,
        scratch: options.scratch,
      });
      return entry.outcome === "failed" ? entry : { outcome: "ok", value: { ...gathered.value, [file]: entry.value } };
    },
    { outcome: "ok", value: {} },
  );
  if (providerFiles.outcome === "failed") return providerFiles;
  const consumers = options.consumers.reduce<Result<PreparedConsumerFixtures["consumers"], EffectFailure>>(
    (gathered, consumer) => {
      if (gathered.outcome === "failed") return gathered;
      const location = absolutePathOf({
        path: options.path,
        location: options.path.join({ segments: [consumersRoot.value, consumer] }),
      });
      return location.outcome === "failed" ? location : {
        outcome: "ok", value: { ...gathered.value, [consumer]: location.value },
      };
    },
    { outcome: "ok", value: {} },
  );
  if (consumers.outcome === "failed") return consumers;
  const rewritten = options.rewrites.reduce<Result<void, EffectFailure>>(
    (previous, rewrite) => previous.outcome === "failed" ? previous : rewrittenFixture({
        ...rewrite,
        file: options.path.join({ segments: [consumersRoot.value, rewrite.file] }),
        fileText: options.fileText,
      }),
    { outcome: "ok", value: undefined },
  );
  return rewritten.outcome === "failed" ? rewritten : {
    outcome: "ok",
    value: { providerRoot: providerRoot.value, consumers: consumers.value, providerFiles: providerFiles.value },
  };
};
