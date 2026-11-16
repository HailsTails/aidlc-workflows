import { build, type Metafile, type OutputFile } from "esbuild";
import type { PathPort } from "../core/platform-ports/path-port.ts";
import type { Result } from "../core/values/result.ts";

export type BundleRequest = {
  readonly sourceRoot: string;
  readonly entryPoints: readonly string[];
  readonly external: readonly string[];
  readonly target: string;
};

export type BundledOutput = {
  readonly path: string;
  readonly text: string;
  readonly entryPoint: string | undefined;
  readonly inputs: readonly string[];
  readonly externalImports: readonly string[];
};

export type Bundle = { readonly outputs: readonly BundledOutput[]; readonly packageRoots: readonly string[] };

export type BundleFailure = { readonly kind: "bundle-failed"; readonly detail: string };

export type BundlerPort = { readonly bundle: (request: BundleRequest) => Promise<Result<Bundle, BundleFailure>> };

const LAYOUT_OUTPUT_FOLDER = "dist";

const BUNDLED_PACKAGE_ROOT = /^(.*node_modules\/(?:@[^/]+\/)?[^/]+)\//;

const repositoryPathBetween = (request: { readonly path: PathPort; readonly from: string; readonly to: string }): string => {
  const location = request.path.relative({ from: request.from, to: request.to });
  return location.relation === "within-root" ? location.path : request.to;
};

const NO_OUTPUT_META: Metafile["outputs"][string] = { bytes: 0, inputs: {}, imports: [], exports: [] };

const bundledOutputOf = (request: {
  readonly path: PathPort;
  readonly outputFile: OutputFile;
  readonly outdir: string;
  readonly sourceRoot: string;
  readonly metafile: Metafile;
}): BundledOutput => {
  const meta =
    request.metafile.outputs[repositoryPathBetween({ path: request.path, from: request.sourceRoot, to: request.outputFile.path })] ??
    NO_OUTPUT_META;
  return {
    path: repositoryPathBetween({ path: request.path, from: request.outdir, to: request.outputFile.path }),
    text: request.outputFile.text,
    entryPoint: meta.entryPoint,
    inputs: Object.keys(meta.inputs),
    externalImports: meta.imports.filter((imported) => imported.external === true).map((imported) => imported.path),
  };
};

const packageRootsOf = (request: { readonly metafile: Metafile }): readonly string[] =>
  [
    ...new Set(
      Object.keys(request.metafile.inputs).flatMap((input) => {
        const match = BUNDLED_PACKAGE_ROOT.exec(input);
        return match === null ? [] : [match[1]];
      }),
    ),
  ].sort();

const bundled = async (request: BundleRequest & { readonly path: PathPort }): Promise<Bundle> => {
  const outdir = request.path.join({ segments: [request.sourceRoot, LAYOUT_OUTPUT_FOLDER] });
  const built = await build({
    absWorkingDir: request.sourceRoot,
    entryPoints: [...request.entryPoints],
    outdir,
    outbase: request.sourceRoot,
    entryNames: "[dir]/[name]",
    chunkNames: "chunks/[name]-[hash]",
    bundle: true,
    splitting: true,
    format: "esm",
    platform: "node",
    target: request.target,
    mainFields: ["module", "main"],
    external: [...request.external],
    sourcemap: false,
    metafile: true,
    write: false,
    logLevel: "silent",
  });
  return {
    outputs: built.outputFiles.map((outputFile) =>
      bundledOutputOf({ path: request.path, outputFile, outdir, sourceRoot: request.sourceRoot, metafile: built.metafile }),
    ),
    packageRoots: packageRootsOf({ metafile: built.metafile }),
  };
};

export const createEsbuildBundlerPort = (options: { readonly path: PathPort }): BundlerPort => ({
  bundle: (request) =>
    bundled({ ...request, path: options.path }).then(
      (bundle): Result<Bundle, BundleFailure> => ({ outcome: "ok", value: bundle }),
      (thrown: unknown): Result<Bundle, BundleFailure> => ({
        outcome: "failed",
        error: { kind: "bundle-failed", detail: thrown instanceof Error ? thrown.message : String(thrown) },
      }),
    ),
});
