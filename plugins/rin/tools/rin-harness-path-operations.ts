import { posix, win32 } from "node:path";
import { fileURLToPath } from "node:url";

type PathFlavour = "win32" | "posix";

type PathOperations = {
  readonly flavour: PathFlavour;
  readonly dirname: (input: { readonly path: string }) => string;
  readonly fromFileUrl: (input: { readonly url: string }) => string;
  readonly basename: (input: { readonly path: string }) => string;
  readonly join: (input: { readonly segments: readonly string[] }) => string;
  readonly resolve: (input: { readonly segments: readonly string[] }) => string;
  readonly relative: (input: {
    readonly from: string;
    readonly to: string;
  }) => string;
  readonly isAbsolute: (input: { readonly path: string }) => boolean;
};

const PLATFORM_PATHS: Readonly<Record<PathFlavour, typeof posix>> = {
  win32,
  posix,
};

const pathOperation = <Value>(operation: () => Value): Value => {
  try { return operation(); }
  catch (error) { throw new Error(error instanceof Error ? error.message : String(error)); }
};

const pathOperationsFor = ({
  flavour,
}: {
  readonly flavour: PathFlavour;
}): PathOperations => {
  const platformPath = PLATFORM_PATHS[flavour];
  return {
    flavour,
    dirname: ({ path }) => pathOperation(() => platformPath.dirname(path)),
    fromFileUrl: ({ url }) => pathOperation(() => fileURLToPath(url)),
    basename: ({ path }) => pathOperation(() => platformPath.basename(path)),
    join: ({ segments }) => pathOperation(() => platformPath.join(...segments)),
    resolve: ({ segments }) => pathOperation(() => platformPath.resolve(...segments)),
    relative: ({ from, to }) => pathOperation(() => platformPath.relative(from, to)),
    isAbsolute: ({ path }) => pathOperation(() => platformPath.isAbsolute(path)),
  };
};

const defaultPathOperations = (): PathOperations =>
  pathOperationsFor({ flavour: process.platform === "win32" ? "win32" : "posix" });

export type { PathFlavour, PathOperations };
export { defaultPathOperations, pathOperationsFor };
