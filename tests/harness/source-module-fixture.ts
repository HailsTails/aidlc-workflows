import { createRuntimeFixtureFilesystem } from "./runtime-fixture-filesystem.ts";

// Owns file and module operations, never a product scenario or assertions.
export const createSourceModuleFixtures = () => {
  const filesystem = createRuntimeFixtureFilesystem();
  return {
    create: (sources: readonly string[]) => filesystem.create({ prefix: "source-module-", sources, dependencies: "repository-link" }),
    cleanup: filesystem.cleanup,
    write: filesystem.write,
    read: filesystem.read,
    path: filesystem.path,
    change: ({ root, relative, before, after }: { readonly root: string; readonly relative: string; readonly before: string; readonly after: string }) => {
      const original = filesystem.read({ root, relative });
      if (original.split(before).length !== 2) throw new Error("Source replacement requires exactly one occurrence");
      filesystem.write({ root, relative, text: original.replace(before, after) });
    },
    load: ({ root, relative }: { readonly root: string; readonly relative: string }) => import(Bun.pathToFileURL(filesystem.path({ root, relative })).href),
  };
};
