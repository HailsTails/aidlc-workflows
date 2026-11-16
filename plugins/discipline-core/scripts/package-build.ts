import { z } from "zod";
import type { FileTextPort } from "../core/platform-ports/file-text-port.ts";
import type { PathPort } from "../core/platform-ports/path-port.ts";
import { parsedJson } from "../core/rule-set-reader/rule-set-reader.ts";
import type { Result } from "../core/values/result.ts";
import type { Bundle, BundlerPort } from "./esbuild-bundler-port.ts";
import type { ScratchFilesPort } from "./install-proof-ports.ts";
import { peerNamesOf, publishManifestOf } from "./install-manifest.ts";
import { PACKAGE_IDENTITY } from "./package-identity.ts";
import {
  type BundledPackage,
  externalPeersOf,
  type PackagePlan,
  type PieceText,
  packagePlanOf,
  piecePathsIn,
  SHIPPED_NODE_RANGE,
  SHIPPED_NODE_TARGET,
  thirdPartyNoticesOf,
} from "./package-plan.ts";

export type PackageBuildPorts = {
  readonly path: PathPort;
  readonly fileText: FileTextPort;
  readonly scratch: ScratchFilesPort;
  readonly bundler: BundlerPort;
};

export type BuiltPackage = { readonly outputRoot: string; readonly files: readonly string[] };

type BuildContext = PackageBuildPorts & { readonly packageRoot: string; readonly outputRoot: string };

type Built<Value> = Result<Value, string>;

type OutputFile = { readonly path: string; readonly text: string };

const SOURCE_FOLDERS: readonly string[] = ["core", "mechanisms", "rules", "methods", "docs"];

const ROOT_FILES: readonly string[] = ["README.md", "ADOPTING.md", "LICENSE"];

const MANIFEST = "package.json";

const NOTICES = "THIRD-PARTY-NOTICES.md";

const LICENSE_FILES: readonly string[] = ["LICENSE", "LICENSE.md", "LICENSE.txt", "license", "LICENCE"];

const NOTICE_FILES: readonly string[] = ["NOTICE", "NOTICE.md", "NOTICE.txt"];

const bundledManifestSchema = z.object({ name: z.string(), version: z.string(), license: z.string() });

const failedWith = (request: { readonly label: string; readonly detail: string }): Built<never> => ({
  outcome: "failed",
  error: `FAIL: ${request.label}: ${request.detail}`,
});

const repositoryForm = (request: { readonly path: string }): string => request.path.replaceAll("\\", "/");

const readText = (request: { readonly context: BuildContext; readonly path: string }): Built<string> => {
  const read = request.context.fileText.read({ path: request.path });
  return read.outcome === "failed" ? failedWith({ label: `read ${request.path}`, detail: read.error.detail }) : read;
};

const sourceFilesUnder = (request: { readonly context: BuildContext; readonly folder: string }): Built<readonly string[]> => {
  const listed = request.context.scratch.listTree({
    path: request.context.path.join({ segments: [request.context.packageRoot, request.folder] }),
  });
  if (listed.outcome === "failed") {
    return failedWith({ label: `list ${request.folder}`, detail: listed.error.detail });
  }
  return {
    outcome: "ok",
    value: listed.value
      .filter((entry) => entry.entryKind === "file")
      .map((entry) => `${request.folder}/${repositoryForm({ path: entry.path })}`),
  };
};

const presentRootFiles = (request: { readonly context: BuildContext }): readonly string[] =>
  ROOT_FILES.filter(
    (name) =>
      request.context.fileText.exists({ path: request.context.path.join({ segments: [request.context.packageRoot, name] }) }) ===
      "present",
  );

const allOk = <Value>(request: { readonly results: readonly Built<Value>[] }): Built<readonly Value[]> =>
  request.results.reduce<Built<readonly Value[]>>(
    (sofar, next) => {
      if (sofar.outcome === "failed") {
        return sofar;
      }
      return next.outcome === "failed" ? next : { outcome: "ok", value: [...sofar.value, next.value] };
    },
    { outcome: "ok", value: [] },
  );

const sourcePathsOf = (request: { readonly context: BuildContext }): Built<readonly string[]> => {
  const listed = allOk({ results: SOURCE_FOLDERS.map((folder) => sourceFilesUnder({ context: request.context, folder })) });
  return listed.outcome === "failed"
    ? listed
    : { outcome: "ok", value: [...presentRootFiles(request), ...listed.value.flat()] };
};

const sourceFile = (request: { readonly context: BuildContext; readonly path: string }): string =>
  request.context.path.join({ segments: [request.context.packageRoot, request.path] });

const pieceTextsOf = (request: {
  readonly context: BuildContext;
  readonly sourcePaths: readonly string[];
}): Built<readonly PieceText[]> =>
  allOk({
    results: piecePathsIn({ sourcePaths: request.sourcePaths }).map((path) => {
      const text = readText({ context: request.context, path: sourceFile({ context: request.context, path }) });
      return text.outcome === "failed" ? text : { outcome: "ok", value: { path, text: text.value } };
    }),
  });

const planOf = (request: { readonly context: BuildContext }): Built<PackagePlan> => {
  const sourcePaths = sourcePathsOf(request);
  if (sourcePaths.outcome === "failed") {
    return sourcePaths;
  }
  const pieces = pieceTextsOf({ context: request.context, sourcePaths: sourcePaths.value });
  if (pieces.outcome === "failed") {
    return pieces;
  }
  const plan = packagePlanOf({ sourcePaths: sourcePaths.value, pieces: pieces.value });
  return plan.outcome === "failed" ? failedWith({ label: `plan ${plan.error.path}`, detail: plan.error.detail }) : plan;
};

const bundleOf = (request: {
  readonly context: BuildContext;
  readonly plan: PackagePlan;
  readonly developmentManifest: string;
}): Promise<Built<Bundle>> => {
  const peers = peerNamesOf({ developmentManifest: request.developmentManifest });
  if (peers.outcome === "failed") {
    return Promise.resolve(failedWith({ label: MANIFEST, detail: peers.error.detail }));
  }
  return request.context.bundler
    .bundle({
      packageRoot: request.context.packageRoot,
      entryPoints: request.plan.entryPoints,
      external: externalPeersOf({ peers: peers.value }),
      target: SHIPPED_NODE_TARGET,
    })
    .then((bundle) => (bundle.outcome === "failed" ? failedWith({ label: "bundle", detail: bundle.error.detail }) : bundle));
};

const firstPresent = (request: {
  readonly context: BuildContext;
  readonly folder: string;
  readonly names: readonly string[];
}): string | undefined =>
  request.names
    .map((name) => request.context.path.join({ segments: [request.folder, name] }))
    .find((path) => request.context.fileText.exists({ path }) === "present");

const noticeTextOf = (request: { readonly context: BuildContext; readonly packageRoot: string }): Built<string | undefined> => {
  const notice = firstPresent({ context: request.context, folder: request.packageRoot, names: NOTICE_FILES });
  return notice === undefined ? { outcome: "ok", value: undefined } : readText({ context: request.context, path: notice });
};

const bundledManifestOf = (request: {
  readonly context: BuildContext;
  readonly packageRoot: string;
}): Built<z.infer<typeof bundledManifestSchema>> => {
  const manifestPath = request.context.path.join({ segments: [request.packageRoot, MANIFEST] });
  const text = readText({ context: request.context, path: manifestPath });
  if (text.outcome === "failed") {
    return text;
  }
  const document = parsedJson({ text: text.value });
  if (document.outcome === "failed") {
    return failedWith({ label: `read the bundled package ${manifestPath}`, detail: document.error });
  }
  const manifest = bundledManifestSchema.safeParse(document.value);
  return manifest.success
    ? { outcome: "ok", value: manifest.data }
    : failedWith({ label: `read the bundled package ${manifestPath}`, detail: "it names no name, version and license" });
};

const bundledPackageOf = (request: { readonly context: BuildContext; readonly packageRoot: string }): Built<BundledPackage> => {
  const manifest = bundledManifestOf(request);
  if (manifest.outcome === "failed") {
    return manifest;
  }
  const licenseFile = firstPresent({ context: request.context, folder: request.packageRoot, names: LICENSE_FILES });
  if (licenseFile === undefined) {
    return failedWith({ label: `bundle ${manifest.value.name}`, detail: "it ships no licence file to reproduce" });
  }
  const licenseText = readText({ context: request.context, path: licenseFile });
  if (licenseText.outcome === "failed") {
    return licenseText;
  }
  const noticeText = noticeTextOf(request);
  return noticeText.outcome === "failed"
    ? noticeText
    : { outcome: "ok", value: { ...manifest.value, licenseText: licenseText.value, noticeText: noticeText.value } };
};

const copiedFilesOf = (request: { readonly context: BuildContext; readonly plan: PackagePlan }): Built<readonly OutputFile[]> =>
  allOk({
    results: request.plan.copied.map((path) => {
      const text = readText({ context: request.context, path: sourceFile({ context: request.context, path }) });
      return text.outcome === "failed" ? text : { outcome: "ok", value: { path, text: text.value } };
    }),
  });

const topLevelNames = (request: { readonly files: readonly OutputFile[] }): readonly string[] =>
  [...new Set(request.files.map((file) => file.path.split("/")[0]))].sort();

const contentFilesOf = (request: {
  readonly context: BuildContext;
  readonly plan: PackagePlan;
  readonly bundle: Bundle;
}): Built<readonly OutputFile[]> => {
  const copied = copiedFilesOf(request);
  if (copied.outcome === "failed") {
    return copied;
  }
  const bundled = allOk({
    results: request.bundle.packageRoots.map((packageRoot) => bundledPackageOf({ context: request.context, packageRoot })),
  });
  if (bundled.outcome === "failed") {
    return bundled;
  }
  return {
    outcome: "ok",
    value: [
      ...request.bundle.files,
      ...copied.value,
      ...request.plan.pieces,
      { path: NOTICES, text: thirdPartyNoticesOf({ packages: bundled.value }) },
    ],
  };
};

const withManifest = (request: {
  readonly plan: PackagePlan;
  readonly developmentManifest: string;
  readonly files: readonly OutputFile[];
}): Built<readonly OutputFile[]> => {
  const manifest = publishManifestOf({
    developmentManifest: request.developmentManifest,
    identity: PACKAGE_IDENTITY,
    commands: request.plan.commands,
    files: topLevelNames({ files: request.files }),
    nodeRange: SHIPPED_NODE_RANGE,
  });
  return manifest.outcome === "failed"
    ? failedWith({ label: "publish manifest", detail: manifest.error.detail })
    : { outcome: "ok", value: [{ path: MANIFEST, text: manifest.value }, ...request.files] };
};

const writtenFile = (request: { readonly context: BuildContext; readonly file: OutputFile }): Built<string> => {
  const target = request.context.path.join({ segments: [request.context.outputRoot, ...request.file.path.split("/")] });
  const directory = request.context.scratch.makeDirectory({ path: request.context.path.directoryOf({ path: target }) });
  if (directory.outcome === "failed") {
    return failedWith({ label: `create the folder of ${request.file.path}`, detail: directory.error.detail });
  }
  const written = request.context.fileText.write({ path: target, text: request.file.text });
  return written.outcome === "failed"
    ? failedWith({ label: `write ${request.file.path}`, detail: written.error.detail })
    : { outcome: "ok", value: request.file.path };
};

const writtenPackage = (request: { readonly context: BuildContext; readonly files: readonly OutputFile[] }): Built<BuiltPackage> => {
  const cleared = request.context.scratch.removeTree({ path: request.context.outputRoot });
  if (cleared.outcome === "failed") {
    return failedWith({ label: `clear ${request.context.outputRoot}`, detail: cleared.error.detail });
  }
  const written = allOk({ results: request.files.map((file) => writtenFile({ context: request.context, file })) });
  return written.outcome === "failed"
    ? written
    : { outcome: "ok", value: { outputRoot: request.context.outputRoot, files: [...written.value].sort() } };
};

const packageFilesOf = async (request: { readonly context: BuildContext }): Promise<Built<readonly OutputFile[]>> => {
  const plan = planOf(request);
  if (plan.outcome === "failed") {
    return plan;
  }
  const developmentManifest = readText({ context: request.context, path: sourceFile({ context: request.context, path: MANIFEST }) });
  if (developmentManifest.outcome === "failed") {
    return developmentManifest;
  }
  const bundle = await bundleOf({ context: request.context, plan: plan.value, developmentManifest: developmentManifest.value });
  if (bundle.outcome === "failed") {
    return bundle;
  }
  const files = contentFilesOf({ context: request.context, plan: plan.value, bundle: bundle.value });
  return files.outcome === "failed"
    ? files
    : withManifest({ plan: plan.value, developmentManifest: developmentManifest.value, files: files.value });
};

export const buildPackage = async (request: {
  readonly ports: PackageBuildPorts;
  readonly packageRoot: string;
  readonly outputRoot: string;
}): Promise<Built<BuiltPackage>> => {
  const context: BuildContext = { ...request.ports, packageRoot: request.packageRoot, outputRoot: request.outputRoot };
  const files = await packageFilesOf({ context });
  return files.outcome === "failed" ? files : writtenPackage({ context, files: files.value });
};
