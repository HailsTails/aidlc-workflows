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

type CommandPorts = { readonly ports: PackageBuildPorts; readonly commands: CommandRunPort };

const BUILD_FOLDER = "dist";

const ARTEFACTS_FOLDER = "artefacts";

const TARBALL_SUFFIX = ".tgz";

const PACKED_BUILD_FOLDER = "package-build";

const PACKED_TARBALL_FOLDER = "package-tarball";

const DETERMINISM_PREFIX = "discipline-core-package-determinism-";

const DEPENDENCIES_PREFIX = "discipline-core-package-dependencies-";

const INSTALL_FOLDER = "install";

const INSTALL_FILES: readonly string[] = ["package.json", "package-lock.json"];

const NODE_MODULES = "node_modules";

const NPM_PACK = ["pack", "--ignore-scripts", "--pack-destination"];

const NPM_CI = ["ci", "--ignore-scripts", "--no-audit", "--no-fund", "--prefer-offline"];

const FIRST_BUILD = "first";

const SECOND_BUILD = "second";

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

const succeeded = (request: { readonly label: string; readonly run: ReturnType<CommandRunPort["run"]> }): Done<null> =>
  request.run.outcome === "not-exited" || request.run.exitCode !== 0
    ? { outcome: "failed", error: `FAIL: ${request.label}: ${JSON.stringify(request.run)}` }
    : { outcome: "ok", value: null };

const copiedInstallFile = (request: CommandPorts & {
  readonly packageRoot: string;
  readonly folder: string;
  readonly name: string;
}): Done<null> => {
  const from = request.ports.path.join({ segments: [request.packageRoot, INSTALL_FOLDER, request.name] });
  const text = request.ports.fileText.read({ path: from });
  if (text.outcome === "failed") {
    return { outcome: "failed", error: `FAIL: read ${from}: ${text.error.detail}` };
  }
  const written = request.ports.fileText.write({ path: request.ports.path.join({ segments: [request.folder, request.name] }), text: text.value });
  return written.outcome === "failed" ? { outcome: "failed", error: `FAIL: stage ${request.name}: ${written.error.detail}` } : { outcome: "ok", value: null };
};

const installedDependenciesIn = (request: CommandPorts & { readonly packageRoot: string; readonly folder: string }): Done<string> => {
  const copied = INSTALL_FILES.map((name) => copiedInstallFile({ ...request, name })).find((staged) => staged.outcome === "failed");
  if (copied !== undefined) {
    return copied;
  }
  const installed = succeeded({
    label: "npm ci core's own packages from install/package-lock.json",
    run: request.commands.run({ command: "npm", arguments: NPM_CI, directory: request.folder }),
  });
  return installed.outcome === "failed"
    ? installed
    : { outcome: "ok", value: request.ports.path.join({ segments: [request.folder, NODE_MODULES] }) };
};

const withDependencies = async <Value>(request: CommandPorts & {
  readonly packageRoot: string;
  readonly use: (dependencies: string) => Promise<Done<Value>>;
}): Promise<Done<Value>> => {
  const folder = request.ports.scratch.createTemporaryDirectory({ prefix: DEPENDENCIES_PREFIX });
  if (folder.outcome === "failed") {
    return { outcome: "failed", error: `FAIL: create a folder for core's own packages: ${folder.error.detail}` };
  }
  const dependencies = installedDependenciesIn({ ...request, folder: folder.value });
  const used = dependencies.outcome === "failed" ? dependencies : await request.use(dependencies.value);
  const removed = request.ports.scratch.removeTree({ path: folder.value });
  return used.outcome === "ok" && removed.outcome === "failed"
    ? { outcome: "failed", error: `FAIL: remove ${folder.value}: ${removed.error.detail}` }
    : used;
};

const packedBuild = (request: CommandPorts & {
  readonly packageRoot: string;
  readonly outputRoot: string;
  readonly packDestination: string;
}): Done<string> => {
  const destination = request.ports.scratch.makeDirectory({ path: request.packDestination });
  if (destination.outcome === "failed") {
    return { outcome: "failed", error: `FAIL: create ${request.packDestination}: ${destination.error.detail}` };
  }
  const packed = succeeded({
    label: `npm pack ${request.outputRoot}`,
    run: request.commands.run({
      command: "npm",
      arguments: [...NPM_PACK, request.packDestination, request.outputRoot],
      directory: request.packageRoot,
    }),
  });
  if (packed.outcome === "failed") {
    return packed;
  }
  const listed = request.ports.scratch.listTree({ path: request.packDestination });
  const tarballs = listed.outcome === "failed" ? [] : listed.value.filter((entry) => entry.name.endsWith(TARBALL_SUFFIX));
  const [tarball] = tarballs;
  return tarballs.length === 1 && tarball !== undefined
    ? { outcome: "ok", value: request.ports.path.join({ segments: [request.packDestination, tarball.path] }) }
    : { outcome: "failed", error: `FAIL: npm pack left ${tarballs.length} tarballs in ${request.packDestination}, not one` };
};

export const packedTarball = async (request: CommandPorts & {
  readonly packageRoot: string;
  readonly outputRoot: string;
  readonly packDestination: string;
  readonly dependencies: string;
}): Promise<Done<string>> => {
  const built = await buildPackage(request);
  return built.outcome === "failed" ? built : packedBuild(request);
};

const buildOutcome = async (request: PackageCommandRequest): Promise<Done<string>> => {
  const packageRoot = packageRootOf(request);
  if (packageRoot.outcome === "failed") {
    return packageRoot;
  }
  const outputRoot = request.path.join({ segments: [packageRoot.value, BUILD_FOLDER] });
  const built = await withDependencies({
    ports: request,
    commands: request.commands,
    packageRoot: packageRoot.value,
    use: (dependencies) => buildPackage({ ports: request, packageRoot: packageRoot.value, outputRoot, dependencies }),
  });
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
  const tarball = await withDependencies({
    ports: request,
    commands: request.commands,
    packageRoot: packageRoot.value,
    use: (dependencies) =>
      packedTarball({
        ports: request,
        commands: request.commands,
        packageRoot: packageRoot.value,
        outputRoot: request.path.join({ segments: [packageRoot.value, BUILD_FOLDER] }),
        packDestination,
        dependencies,
      }),
  });
  return tarball.outcome === "failed" ? tarball : { outcome: "ok", value: `pack package: wrote ${tarball.value}` };
};

type PackedBuild = { readonly built: BuiltPackage; readonly tarball: string };

const packedBuildIn = async (request: CommandPorts & {
  readonly packageRoot: string;
  readonly dependencies: string;
  readonly root: string;
}): Promise<Done<PackedBuild>> => {
  const outputRoot = request.ports.path.join({ segments: [request.root, "package"] });
  const built = await buildPackage({ ...request, outputRoot });
  if (built.outcome === "failed") {
    return built;
  }
  const tarball = packedBuild({ ...request, outputRoot, packDestination: request.ports.path.join({ segments: [request.root, "tarball"] }) });
  return tarball.outcome === "failed" ? tarball : { outcome: "ok", value: { built: built.value, tarball: tarball.value } };
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

const digestOf = (request: { readonly ports: PackageBuildPorts; readonly tarball: string }): string | undefined => {
  const digest = request.ports.scratch.digestOf({ path: request.tarball });
  return digest.outcome === "ok" ? digest.value : undefined;
};

const comparedBuilds = (request: {
  readonly ports: PackageBuildPorts;
  readonly first: PackedBuild;
  readonly second: PackedBuild;
}): Done<string> => {
  const differing = differingFiles({ ports: request.ports, first: request.first.built, second: request.second.built });
  if (differing.length > 0) {
    return { outcome: "failed", error: `FAIL: package determinism: two builds differ in ${differing.join(", ")}` };
  }
  const firstDigest = digestOf({ ports: request.ports, tarball: request.first.tarball });
  return firstDigest !== undefined && firstDigest === digestOf({ ports: request.ports, tarball: request.second.tarball })
    ? {
        outcome: "ok",
        value: `package determinism: pass, ${request.first.built.files.length} files and the packed tarball byte-identical across two builds`,
      }
    : { outcome: "failed", error: "FAIL: package determinism: the two builds' packed tarballs differ" };
};

const determinismIn = async (request: CommandPorts & {
  readonly packageRoot: string;
  readonly temporaryRoot: string;
  readonly dependencies: string;
}): Promise<Done<string>> => {
  const first = await packedBuildIn({ ...request, root: request.ports.path.join({ segments: [request.temporaryRoot, FIRST_BUILD] }) });
  if (first.outcome === "failed") {
    return first;
  }
  const second = await packedBuildIn({ ...request, root: request.ports.path.join({ segments: [request.temporaryRoot, SECOND_BUILD] }) });
  return second.outcome === "failed" ? second : comparedBuilds({ ports: request.ports, first: first.value, second: second.value });
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
  const compared = await withDependencies({
    ports: request,
    commands: request.commands,
    packageRoot: packageRoot.value,
    use: (dependencies) =>
      determinismIn({ ports: request, commands: request.commands, packageRoot: packageRoot.value, temporaryRoot: temporaryRoot.value, dependencies }),
  });
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
  readonly pack: (request: {
    readonly packageRoot: string;
    readonly workRoot: string;
    readonly dependencies: string;
  }) => Promise<Done<string>>;
};

export const createTarballPacker = (options: CommandPorts): TarballPackerPort => ({
  pack: (request) =>
    packedTarball({
      ports: options.ports,
      commands: options.commands,
      packageRoot: request.packageRoot,
      outputRoot: options.ports.path.join({ segments: [request.workRoot, PACKED_BUILD_FOLDER] }),
      packDestination: options.ports.path.join({ segments: [request.workRoot, PACKED_TARBALL_FOLDER] }),
      dependencies: request.dependencies,
    }),
});
