import { createOwnedDirectories, type OwnedDirectories, type OwnedDirectoryStorage } from "./owned-directory.ts";
import { createSessionDirectoryStorage, type SessionDirectoryStorage } from "./session-directory-storage.ts";

export type DistributionDirectories = OwnedDirectories;
export type DistributionDirectoryFactory = () => DistributionDirectories;

export const createDistributionDirectoryFactory = ({ parent, storage = createSessionDirectoryStorage({ purpose: "distribution" }) }: { readonly parent: string; readonly storage?: OwnedDirectoryStorage }): DistributionDirectoryFactory => () => createOwnedDirectories({ parent, storage });

export const createDistributionSessionDirectories = ({ storage = createSessionDirectoryStorage({ purpose: "distribution" }) }: { readonly storage?: SessionDirectoryStorage } = {}): DistributionDirectories => createOwnedDirectories({ parent: storage.temporaryParent(), storage });

export const removeDistributionDirectory = ({ directories, root }: { readonly directories: DistributionDirectories; readonly root: string }): void => {
  if (directories.remove({ root }).status === "foreign-root") throw new Error("Distribution cleanup requires a root allocated by this directory instance; foreign-root cleanup is programmer misuse");
};
