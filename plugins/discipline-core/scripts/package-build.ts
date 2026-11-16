import { z } from "zod";
import type { FileTextPort } from "../core/platform-ports/file-text-port.ts";
import type { PathPort } from "../core/platform-ports/path-port.ts";
import { parsedJson } from "../core/rule-set-reader/rule-set-reader.ts";
import type { Result } from "../core/values/result.ts";
import type { Bundle, BundlerPort } from "./esbuild-bundler-port.ts";
import type { CopiedEntry, ScratchFilesPort } from "./install-proof-ports.ts";
import type { EntryDisposition } from "./install-proof-plan.ts";
import { deadLinksOf, misplacedEntriesOf, unbundledImportsOf, unlockedPackagesOf } from "./package-guards.ts";
import { dependencyNamesOf, peerNamesOf, publishManifestOf } from "./published-manifest.ts";
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

type BuildContext = PackageBuildPorts & {
  readonly packageRoot: string;
  readonly outputRoot: string;
  readonly dependencies: string;
};

type Built<Value> = Result<Value, string>;

type OutputFile = { readonly path: string; readonly text: string };

type BundledPackageAt = BundledPackage & { readonly root: string };

type StagedBundle = { readonly bundle: Bundle; readonly packages: readonly BundledPackageAt[] };

const SOURCE_FOLDERS: readonly string[] = ["core", "mechanisms", "rules", "methods", "docs"];

const BUNDLED_SOURCE_FOLDERS: readonly string[] = ["core", "mechanisms"];

const BUNDLED_SOURCE_FILES: readonly string[] = ["package.json", "tsconfig.json"];

const LEFT_OUT_FOLDERS: ReadonlySet<string> = new Set(["tests", "test-fixtures", "node_modules"]);

const LEFT_OUT_FILE_SUFFIX = ".test.ts";

const ROOT_FILES: readonly string[] = ["README.md", "ADOPTING.md", "MIGRATING.md", "LICENSE"];

const MANIFEST = "package.json";

const INSTALL_LOCK: readonly string[] = ["bun.lock"];

const NODE_MODULES = "node_modules";

const STAGE_PREFIX = "discipline-core-package-stage-";

const STAGED_SOURCE = "source";

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
  request.context.path.join({ segments: [request.context.packageRoot, ...request.path.split("/")] });

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

const stagedDisposition = (entry: CopiedEntry): EntryDisposition => {
  if (entry.entryKind === "folder") {
    return LEFT_OUT_FOLDERS.has(entry.name) ? "left-out" : "kept";
  }
  return entry.name.endsWith(LEFT_OUT_FILE_SUFFIX) ? "left-out" : "kept";
};

const stagedTree = (request: {
  readonly context: BuildContext;
  readonly from: string;
  readonly to: string;
  readonly disposition: (entry: CopiedEntry) => EntryDisposition;
}): Built<null> => {
  const copied = request.context.scratch.copyTree({ from: request.from, to: request.to, disposition: request.disposition });
  return copied.outcome === "failed" ? failedWith({ label: `stage ${request.from}`, detail: copied.error.detail }) : copied;
};

const stagedFile = (request: { readonly context: BuildContext; readonly sourceRoot: string; readonly name: string }): Built<null> => {
  const text = readText({ context: request.context, path: sourceFile({ context: request.context, path: request.name }) });
  if (text.outcome === "failed") {
    return text;
  }
  const written = request.context.fileText.write({
    path: request.context.path.join({ segments: [request.sourceRoot, request.name] }),
    text: text.value,
  });
  return written.outcome === "failed" ? failedWith({ label: `stage ${request.name}`, detail: written.error.detail }) : { outcome: "ok", value: null };
};

const stagedSource = (request: { readonly context: BuildContext; readonly sourceRoot: string }): Built<readonly null[]> =>
  allOk({
    results: [
      ...BUNDLED_SOURCE_FOLDERS.map((folder) =>
        stagedTree({
          context: request.context,
          from: sourceFile({ context: request.context, path: folder }),
          to: request.context.path.join({ segments: [request.sourceRoot, folder] }),
          disposition: stagedDisposition,
        }),
      ),
      ...BUNDLED_SOURCE_FILES.map((name) => stagedFile({ context: request.context, sourceRoot: request.sourceRoot, name })),
      stagedTree({
        context: request.context,
        from: request.context.dependencies,
        to: request.context.path.join({ segments: [request.sourceRoot, NODE_MODULES] }),
        disposition: () => "kept",
      }),
    ],
  });

const failedOnProblems = (request: { readonly label: string; readonly problems: readonly string[] }): Built<null> =>
  request.problems.length === 0
    ? { outcome: "ok", value: null }
    : failedWith({ label: request.label, detail: request.problems.join("; ") });

const bundleOf = (request: {
  readonly context: BuildContext;
  readonly plan: PackagePlan;
  readonly peers: readonly string[];
  readonly sourceRoot: string;
}): Promise<Built<Bundle>> =>
  request.context.bundler
    .bundle({
      sourceRoot: request.sourceRoot,
      entryPoints: request.plan.entryPoints,
      external: externalPeersOf({ peers: request.peers }),
      target: SHIPPED_NODE_TARGET,
    })
    .then((bundle): Built<Bundle> => {
      if (bundle.outcome === "failed") {
        return failedWith({ label: "bundle", detail: bundle.error.detail });
      }
      const unbundled = failedOnProblems({
        label: "bundle: an output imports what is neither bundled, a node: builtin nor a declared peer",
        problems: unbundledImportsOf({ outputs: bundle.value.outputs, peers: request.peers }),
      });
      if (unbundled.outcome === "failed") {
        return unbundled;
      }
      const misplaced = failedOnProblems({
        label: "bundle: an entry would not find the install root from its own module",
        problems: misplacedEntriesOf({ entryPoints: request.plan.entryPoints, outputs: bundle.value.outputs }),
      });
      return misplaced.outcome === "failed" ? misplaced : bundle;
    });

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

const bundledPackageOf = (request: {
  readonly context: BuildContext;
  readonly sourceRoot: string;
  readonly root: string;
}): Built<BundledPackageAt> => {
  const packageRoot = request.context.path.join({ segments: [request.sourceRoot, ...request.root.split("/")] });
  const manifest = bundledManifestOf({ context: request.context, packageRoot });
  if (manifest.outcome === "failed") {
    return manifest;
  }
  const licenseFile = firstPresent({ context: request.context, folder: packageRoot, names: LICENSE_FILES });
  if (licenseFile === undefined) {
    return failedWith({ label: `bundle ${manifest.value.name}`, detail: "it ships no licence file to reproduce" });
  }
  const licenseText = readText({ context: request.context, path: licenseFile });
  if (licenseText.outcome === "failed") {
    return licenseText;
  }
  const noticeText = noticeTextOf({ context: request.context, packageRoot });
  return noticeText.outcome === "failed"
    ? noticeText
    : {
        outcome: "ok",
        value: { ...manifest.value, root: request.root, licenseText: licenseText.value, noticeText: noticeText.value },
      };
};

const lockedPackagesOf = (request: {
  readonly context: BuildContext;
  readonly packages: readonly BundledPackageAt[];
  readonly dependencies: readonly string[];
}): Built<readonly BundledPackageAt[]> => {
  const lockPath = sourceFile({ context: request.context, path: INSTALL_LOCK.join("/") });
  const lockText = readText({ context: request.context, path: lockPath });
  if (lockText.outcome === "failed") {
    return lockText;
  }
  const unlocked = unlockedPackagesOf({ bundled: request.packages, lockText: lockText.value, dependencies: request.dependencies });
  if (unlocked.outcome === "failed") {
    return failedWith({ label: `read ${lockPath}`, detail: unlocked.error });
  }
  const checked = failedOnProblems({
    label: `bundle: a bundled package is not the one ${INSTALL_LOCK.join("/")} locks`,
    problems: unlocked.value,
  });
  return checked.outcome === "failed" ? checked : { outcome: "ok", value: request.packages };
};

const bundledInStage = async (request: {
  readonly context: BuildContext;
  readonly plan: PackagePlan;
  readonly peers: readonly string[];
  readonly dependencies: readonly string[];
  readonly sourceRoot: string;
}): Promise<Built<StagedBundle>> => {
  const staged = stagedSource(request);
  if (staged.outcome === "failed") {
    return staged;
  }
  const bundle = await bundleOf(request);
  if (bundle.outcome === "failed") {
    return bundle;
  }
  const packages = allOk({
    results: bundle.value.packageRoots.map((root) => bundledPackageOf({ context: request.context, sourceRoot: request.sourceRoot, root })),
  });
  if (packages.outcome === "failed") {
    return packages;
  }
  const locked = lockedPackagesOf({ context: request.context, packages: packages.value, dependencies: request.dependencies });
  return locked.outcome === "failed" ? locked : { outcome: "ok", value: { bundle: bundle.value, packages: locked.value } };
};

const stagedBundleOf = async (request: {
  readonly context: BuildContext;
  readonly plan: PackagePlan;
  readonly peers: readonly string[];
  readonly dependencies: readonly string[];
}): Promise<Built<StagedBundle>> => {
  const stage = request.context.scratch.createTemporaryDirectory({ prefix: STAGE_PREFIX });
  if (stage.outcome === "failed") {
    return failedWith({ label: "create the bundling stage", detail: stage.error.detail });
  }
  const bundled = await bundledInStage({
    ...request,
    sourceRoot: request.context.path.join({ segments: [stage.value, STAGED_SOURCE] }),
  });
  const removed = request.context.scratch.removeTree({ path: stage.value });
  return bundled.outcome === "ok" && removed.outcome === "failed"
    ? failedWith({ label: `remove ${stage.value}`, detail: removed.error.detail })
    : bundled;
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
  readonly staged: StagedBundle;
}): Built<readonly OutputFile[]> => {
  const copied = copiedFilesOf(request);
  if (copied.outcome === "failed") {
    return copied;
  }
  return {
    outcome: "ok",
    value: [
      ...request.staged.bundle.outputs.map(({ path, text }) => ({ path, text })),
      ...copied.value,
      ...request.plan.pieces,
      { path: NOTICES, text: thirdPartyNoticesOf({ packages: request.staged.packages }) },
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
    exported: request.plan.exported,
    nodeRange: SHIPPED_NODE_RANGE,
  });
  return manifest.outcome === "failed"
    ? failedWith({ label: "publish manifest", detail: manifest.error.detail })
    : { outcome: "ok", value: [{ path: MANIFEST, text: manifest.value }, ...request.files] };
};

const linkedFiles = (request: { readonly files: readonly OutputFile[] }): Built<readonly OutputFile[]> => {
  const checked = failedOnProblems({
    label: "a shipped page links to a file the package does not ship",
    problems: deadLinksOf({ files: request.files }),
  });
  return checked.outcome === "failed" ? checked : { outcome: "ok", value: request.files };
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
  const peers = peerNamesOf({ developmentManifest: developmentManifest.value });
  if (peers.outcome === "failed") {
    return failedWith({ label: MANIFEST, detail: peers.error.detail });
  }
  const dependencies = dependencyNamesOf({ developmentManifest: developmentManifest.value });
  if (dependencies.outcome === "failed") {
    return failedWith({ label: MANIFEST, detail: dependencies.error.detail });
  }
  const staged = await stagedBundleOf({ context: request.context, plan: plan.value, peers: peers.value, dependencies: dependencies.value });
  if (staged.outcome === "failed") {
    return staged;
  }
  const files = contentFilesOf({ context: request.context, plan: plan.value, staged: staged.value });
  if (files.outcome === "failed") {
    return files;
  }
  const manifested = withManifest({ plan: plan.value, developmentManifest: developmentManifest.value, files: files.value });
  return manifested.outcome === "failed" ? manifested : linkedFiles({ files: manifested.value });
};

export const buildPackage = async (request: {
  readonly ports: PackageBuildPorts;
  readonly packageRoot: string;
  readonly outputRoot: string;
  readonly dependencies: string;
}): Promise<Built<BuiltPackage>> => {
  const context: BuildContext = {
    ...request.ports,
    packageRoot: request.packageRoot,
    outputRoot: request.outputRoot,
    dependencies: request.dependencies,
  };
  const files = await packageFilesOf({ context });
  return files.outcome === "failed" ? files : writtenPackage({ context, files: files.value });
};
