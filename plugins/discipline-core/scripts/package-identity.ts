export type PackageIdentity = {
  readonly name: string;
  readonly checkBin: string;
  readonly projectBin: string;
};

export const PACKAGE_IDENTITY: PackageIdentity = {
  name: "discipline-core",
  checkBin: "discipline-core-check",
  projectBin: "discipline-core-project",
};
