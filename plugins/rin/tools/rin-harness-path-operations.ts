import { posix, win32 } from "node:path";

type PathFlavour = "win32" | "posix";

type PathOperations = {
  readonly flavour: PathFlavour;
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

const pathOperationsFor = ({
  flavour,
}: {
  readonly flavour: PathFlavour;
}): PathOperations => {
  const platformPath = PLATFORM_PATHS[flavour];
  return {
    flavour,
    basename: ({ path }) => platformPath.basename(path),
    join: ({ segments }) => platformPath.join(...segments),
    resolve: ({ segments }) => platformPath.resolve(...segments),
    relative: ({ from, to }) => platformPath.relative(from, to),
    isAbsolute: ({ path }) => platformPath.isAbsolute(path),
  };
};

const defaultPathOperations = (): PathOperations =>
  pathOperationsFor({ flavour: process.platform === "win32" ? "win32" : "posix" });

export type { PathFlavour, PathOperations };
export { defaultPathOperations, pathOperationsFor };
