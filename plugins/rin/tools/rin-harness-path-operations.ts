import { posix, win32 } from "node:path";

type PathFlavour = "win32" | "posix";

type PathOperations = {
  readonly flavour: PathFlavour;
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
    resolve: ({ segments }) => platformPath.resolve(...segments),
    relative: ({ from, to }) => platformPath.relative(from, to),
    isAbsolute: ({ path }) => platformPath.isAbsolute(path),
  };
};

export type { PathFlavour, PathOperations };
export { pathOperationsFor };
