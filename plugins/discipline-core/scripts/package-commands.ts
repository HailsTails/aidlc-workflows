import type { ProcessPort } from "../core/platform-ports/process-port.ts";
import type { Result } from "../core/values/result.ts";
import type { CommandRunPort } from "./install-proof-ports.ts";
import { type BuiltPackage, buildPackage, type PackageBuildPorts } from "./package-build.ts";

export type PackageCommandRequest = PackageBuildPorts & {
  readonly process: ProcessPort;
  readonly commands: CommandRunPort;
  readonly moduleUrl: string;
};

type Done<Value> = Result<Value, string>;

const BUILD_FOLDER = "dist";

const ARTEFACTS_FOLDER = "artefacts";

const TARBALL_SUFFIX = ".tgz";

const PACKED_BUILD_FOLDER = "package-build";

const PACKED_TARBALL_FOLDER = "package-tarball";

const DETERMINISM_PREFIX = "discipline-core-package-determinism-";

const NPM_PACK = ["pack", "--ignore-scripts", "--pack-destination"];

const packageRootOf = (request: PackageCommandRequest): Done<string> => {
  const script = request.path.fromFileUrl({ url: request.moduleUrl });
  return script.outcome === "failed"
    ? { outcome: "failed", error: `FAIL: locate the package root: ${script.error.detail}` }
    : { outcome: "ok", value: request.path.directoryOf({ path: request.path.directoryOf({ path: script.value }) }) };
};

const finished = (request: { readonly process: ProcessPort; readonly outcome: Done<string> }): void => {
  request.process.writeOut({ text: `${request.outcome.outcome === "failed" ? request.outcome.error : request.outcome.value}\n` });
  request.process.exitWith({ code: request.outcome.outcome === "failed" ? 1 : 0 });
};


export const packedTarball = async (request: {
  readonly ports: PackageBuildPorts;
  readonly commands: CommandRunPort;
  readonly packageRoot: string;
  readonly outputRoot: string;
  readonly packDestination: string;
}): Promise<Done<string>> => {
  const built = await buildPackage(request);
  if (built.outcome === "failed") {
    return built;
  }
  const destination = request.ports.scratch.makeDirectory({ path: request.packDestination });
  if (destination.outcome === "failed") {
    return { outcome: "failed", error: `FAIL: create ${request.packDestination}: ${destination.error.detail}` };
  }
  const packed = request.commands.run({
    command: "npm",
    arguments: [...NPM_PACK, request.packDestination, request.outputRoot],
    directory: request.packageRoot,
  });
  if (packed.outcome === "not-exited" || packed.exitCode !== 0) {
    return { outcome: "failed", error: `FAIL: npm pack ${request.outputRoot}: ${JSON.stringify(packed)}` };
  }
  const listed = request.ports.scratch.listTree({ path: request.packDestination });
  const tarballs = listed.outcome === "failed" ? [] : listed.value.filter((entry) => entry.name.endsWith(TARBALL_SUFFIX));
  const [tarball] = tarballs;
  return tarballs.length === 1 && tarball !== undefined
    ? { outcome: "ok", value: request.ports.path.join({ segments: [request.packDestination, tarball.path] }) }
    : { outcome: "failed", error: `FAIL: npm pack left ${tarballs.length} tarballs in ${request.packDestination}, not one` };
};

const buildOutcome = async (request: PackageCommandRequest): Promise<Done<string>> => {
  const packageRoot = packageRootOf(request);
  if (packageRoot.outcome === "failed") {
    return packageRoot;
  }
  const outputRoot = request.path.join({ segments: [packageRoot.value, BUILD_FOLDER] });
  const built = await buildPackage({ ports: request, packageRoot: packageRoot.value, outputRoot });
  return built.outcome === "failed"
    ? built
    : { outcome: "ok", value: `build package: wrote ${built.value.files.length} files to ${built.value.outputRoot}` };
};

const packOutcome = async (request: PackageCommandRequest): Promise<Done<string>> => {
  const packageRoot = packageRootOf(request);
  if (packageRoot.outcome === "failed") {
    return packageRoot;
  }
  const packDestination = request.path.join({ segments: [packageRoot.value, ARTEFACTS_FOLDER] });
  const cleared = request.scratch.removeTree({ path: packDestination });
  if (cleared.outcome === "failed") {
    return { outcome: "failed", error: `FAIL: clear ${packDestination}: ${cleared.error.detail}` };
  }
  const tarball = await packedTarball({
    ports: request,
    commands: request.commands,
    packageRoot: packageRoot.value,
    outputRoot: request.path.join({ segments: [packageRoot.value, BUILD_FOLDER] }),
    packDestination,
  });
  return tarball.outcome === "failed" ? tarball : { outcome: "ok", value: `pack package: wrote ${tarball.value}` };
};

const builtText = (request: { readonly ports: PackageBuildPorts; readonly built: BuiltPackage; readonly file: string }): string | undefined => {
  const read = request.ports.fileText.read({
    path: request.ports.path.join({ segments: [request.built.outputRoot, ...request.file.split("/")] }),
  });
  return read.outcome === "ok" ? read.value : undefined;
};

const sameInBoth = (request: {
  readonly ports: PackageBuildPorts;
  readonly first: BuiltPackage;
  readonly second: BuiltPackage;
  readonly file: string;
}): "same" | "different" => {
  const first = builtText({ ports: request.ports, built: request.first, file: request.file });
  return first !== undefined && first === builtText({ ports: request.ports, built: request.second, file: request.file })
    ? "same"
    : "different";
};

const differingFiles = (request: {
  readonly ports: PackageBuildPorts;
  readonly first: BuiltPackage;
  readonly second: BuiltPackage;
}): readonly string[] =>
  [...new Set([...request.first.files, ...request.second.files])]
    .sort()
    .filter((file) => sameInBoth({ ...request, file }) === "different");

const determinismIn = async (request: {
  readonly ports: PackageBuildPorts;
  readonly packageRoot: string;
  readonly temporaryRoot: string;
}): Promise<Done<string>> => {
  const first = await buildPackage({ ...request, outputRoot: request.ports.path.join({ segments: [request.temporaryRoot, "first"] }) });
  if (first.outcome === "failed") {
    return first;
  }
  const second = await buildPackage({ ...request, outputRoot: request.ports.path.join({ segments: [request.temporaryRoot, "second"] }) });
  if (second.outcome === "failed") {
    return second;
  }
  const differing = differingFiles({ ports: request.ports, first: first.value, second: second.value });
  return differing.length === 0
    ? { outcome: "ok", value: `package determinism: pass, ${first.value.files.length} files byte-identical across two builds` }
    : { outcome: "failed", error: `FAIL: package determinism: two builds differ in ${differing.join(", ")}` };
};

const determinismOutcome = async (request: PackageCommandRequest): Promise<Done<string>> => {
  const packageRoot = packageRootOf(request);
  if (packageRoot.outcome === "failed") {
    return packageRoot;
  }
  const temporaryRoot = request.scratch.createTemporaryDirectory({ prefix: DETERMINISM_PREFIX });
  if (temporaryRoot.outcome === "failed") {
    return { outcome: "failed", error: `FAIL: create a temporary root: ${temporaryRoot.error.detail}` };
  }
  const compared = await determinismIn({ ports: request, packageRoot: packageRoot.value, temporaryRoot: temporaryRoot.value });
  const removed = request.scratch.removeTree({ path: temporaryRoot.value });
  return compared.outcome === "ok" && removed.outcome === "failed"
    ? { outcome: "failed", error: `FAIL: remove ${temporaryRoot.value}: ${removed.error.detail}` }
    : compared;
};

export const runBuildPackage = (request: PackageCommandRequest): Promise<void> =>
  buildOutcome(request).then((outcome) => finished({ process: request.process, outcome }));

export const runPackPackage = (request: PackageCommandRequest): Promise<void> =>
  packOutcome(request).then((outcome) => finished({ process: request.process, outcome }));

export const runPackageDeterminism = (request: PackageCommandRequest): Promise<void> =>
  determinismOutcome(request).then((outcome) => finished({ process: request.process, outcome }));

export type TarballPackerPort = {
  readonly pack: (request: { readonly packageRoot: string; readonly workRoot: string }) => Promise<Done<string>>;
};

export const createTarballPacker = (options: {
  readonly ports: PackageBuildPorts;
  readonly commands: CommandRunPort;
}): TarballPackerPort => ({
  pack: (request) =>
    packedTarball({
      ports: options.ports,
      commands: options.commands,
      packageRoot: request.packageRoot,
      outputRoot: options.ports.path.join({ segments: [request.workRoot, PACKED_BUILD_FOLDER] }),
      packDestination: options.ports.path.join({ segments: [request.workRoot, PACKED_TARBALL_FOLDER] }),
    }),
});
