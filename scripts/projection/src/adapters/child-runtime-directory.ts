import { createOwnedDirectories, type OwnedDirectoryStorage } from "./owned-directory.ts";
import { createSessionDirectoryStorage, type SessionDirectoryStorage } from "./session-directory-storage.ts";

export type ChildRuntimeDirectories = {
  readonly allocate: () => string;
  readonly remove: (input: { readonly root: string }) => void;
};
export type ChildRuntimeDirectoryStorage = OwnedDirectoryStorage;
export type ChildRuntimeSessionStorage = SessionDirectoryStorage;
export const createChildRuntimeDirectoryStorage = (): ChildRuntimeSessionStorage => createSessionDirectoryStorage({ purpose: "runtime" });

// A session and each emission own separate runtime homes, never distribution roots.
export const createChildRuntimeDirectories = ({ parent, storage = createChildRuntimeDirectoryStorage() }: { readonly parent: string; readonly storage?: ChildRuntimeDirectoryStorage }): ChildRuntimeDirectories => {
  const directories = createOwnedDirectories({ parent, storage });
  return {
    allocate: directories.allocate,
    remove: ({ root }) => {
      if (directories.remove({ root }).status === "foreign-root") throw new Error("Runtime cleanup requires a root allocated by this directory instance");
    },
  };
};

export const createChildRuntimeSessionDirectories = ({ storage = createChildRuntimeDirectoryStorage() }: { readonly storage?: ChildRuntimeSessionStorage } = {}): ChildRuntimeDirectories => createChildRuntimeDirectories({ parent: storage.temporaryParent(), storage });
