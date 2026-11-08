export type OwnedDirectoryRemoval = { readonly status: "removed" } | { readonly status: "foreign-root" };
export type OwnedDirectories = {
  readonly allocate: () => string;
  readonly remove: (input: { readonly root: string }) => OwnedDirectoryRemoval;
};
export type OwnedDirectoryStorage = {
  readonly create: (parent: string) => string;
  readonly remove: (root: string) => void;
};

// Ownership and storage effects are sequenced here; failed cleanup keeps its claim for retry.
export const createOwnedDirectories = ({ parent, storage }: { readonly parent: string; readonly storage: OwnedDirectoryStorage }): OwnedDirectories => {
  const allocated = new Set<string>();
  return {
    allocate: () => {
      const root = storage.create(parent);
      allocated.add(root);
      return root;
    },
    remove: ({ root }) => {
      if (!allocated.has(root)) return { status: "foreign-root" };
      storage.remove(root);
      allocated.delete(root);
      return { status: "removed" };
    },
  };
};
