export type PackageIdentity = {
  readonly name: string;
  readonly description: string;
  readonly checkBin: string;
  readonly projectBin: string;
};

export const PACKAGE_IDENTITY: PackageIdentity = {
  name: "discipline-core",
  description: "Checks a repository against the coding disciplines it selects, applies its recorded exceptions and prints one verdict.",
  checkBin: "discipline-core-check",
  projectBin: "discipline-core-project",
};
