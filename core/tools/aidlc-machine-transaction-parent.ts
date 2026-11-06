type MachineDirectory = Readonly<{
  filesystemRoot: string;
  segments: readonly string[];
}>;

/** Discovery and path decoding stay with the platform; transaction scope follows these resolved facts. */
export function planMachineTransactionParent({ installDirectory, commandDirectory }: {
  readonly installDirectory: MachineDirectory;
  readonly commandDirectory: MachineDirectory;
}): Readonly<{ filesystemRoot: string; segments: readonly string[] }> {
  if (installDirectory.filesystemRoot !== commandDirectory.filesystemRoot) {
    throw new Error("machine install and command directories must be on one filesystem root");
  }
  const candidates = installDirectory.segments.slice(0, Math.min(installDirectory.segments.length, commandDirectory.segments.length));
  const divergence = candidates.findIndex((segment, index) => segment !== commandDirectory.segments[index]);
  const shared = divergence < 0 ? candidates : candidates.slice(0, divergence);
  if (shared.length === 0) {
    throw new Error("machine install and command directories need a writable shared parent");
  }
  return { filesystemRoot: installDirectory.filesystemRoot, segments: shared };
}

/** Native joining may collapse nonempty decoded segments; admit only its final non-root result. */
export function admitMachineTransactionParent({ filesystemRoot, parentPath }: {
  readonly filesystemRoot: string;
  readonly parentPath: string;
}): string {
  if (parentPath === filesystemRoot) {
    throw new Error("machine install and command directories need a writable shared parent");
  }
  return parentPath;
}
