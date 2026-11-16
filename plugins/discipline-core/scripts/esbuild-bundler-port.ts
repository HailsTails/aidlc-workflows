import { build, type Metafile, type OutputFile } from "esbuild";
import { relative, resolve, sep } from "node:path";
import type { Result } from "../core/values/result.ts";

export type BundleRequest = {
  readonly packageRoot: string;
  readonly entryPoints: readonly string[];
  readonly external: readonly string[];
  readonly target: string;
};

export type BundledFile = { readonly path: string; readonly text: string };

export type Bundle = { readonly files: readonly BundledFile[]; readonly packageRoots: readonly string[] };

export type BundleFailure = { readonly kind: "bundle-failed"; readonly detail: string };

export type BundlerPort = { readonly bundle: (request: BundleRequest) => Promise<Result<Bundle, BundleFailure>> };

const LAYOUT_OUTPUT_FOLDER = "dist";

const BUNDLED_PACKAGE_ROOT = /^(.*node_modules\/(?:@[^/]+\/)?[^/]+)\//;

const repositoryForm = (request: { readonly path: string }): string => request.path.split(sep).join("/");

const bundledFileOf = (request: { readonly outputFile: OutputFile; readonly outdir: string }): BundledFile => ({
  path: repositoryForm({ path: relative(request.outdir, request.outputFile.path) }),
  text: request.outputFile.text,
});

const packageRootsOf = (request: { readonly metafile: Metafile; readonly packageRoot: string }): readonly string[] =>
  [
    ...new Set(
      Object.keys(request.metafile.inputs).flatMap((input) => {
        const match = BUNDLED_PACKAGE_ROOT.exec(input);
        return match === null ? [] : [resolve(request.packageRoot, match[1])];
      }),
    ),
  ].sort();

const bundled = async (request: BundleRequest): Promise<Bundle> => {
  const outdir = resolve(request.packageRoot, LAYOUT_OUTPUT_FOLDER);
  const result = await build({
    absWorkingDir: request.packageRoot,
    entryPoints: [...request.entryPoints],
    outdir,
    outbase: request.packageRoot,
    entryNames: "[dir]/[name]",
    chunkNames: "chunks/[name]-[hash]",
    bundle: true,
    splitting: true,
    format: "esm",
    platform: "node",
    target: request.target,
    mainFields: ["module", "main"],
    external: [...request.external],
    sourcemap: "linked",
    sourcesContent: false,
    metafile: true,
    write: false,
    logLevel: "silent",
  });
  return {
    files: result.outputFiles.map((outputFile) => bundledFileOf({ outputFile, outdir })),
    packageRoots: packageRootsOf({ metafile: result.metafile, packageRoot: request.packageRoot }),
  };
};

export const createEsbuildBundlerPort = (_options: Record<string, never>): BundlerPort => ({
  bundle: (request) =>
    bundled(request).then(
      (bundle): Result<Bundle, BundleFailure> => ({ outcome: "ok", value: bundle }),
      (thrown: unknown): Result<Bundle, BundleFailure> => ({
        outcome: "failed",
        error: { kind: "bundle-failed", detail: thrown instanceof Error ? thrown.message : String(thrown) },
      }),
    ),
});
