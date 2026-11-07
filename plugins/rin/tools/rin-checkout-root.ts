import type { PathOperations } from "./rin-harness-path-operations.ts";
import type { FileKindPort } from "./rin-harness-sidecar-file-reader.ts";

type CheckoutRootPorts = {
  readonly pathOperations: PathOperations;
  readonly fileKind: FileKindPort;
};

const holdsGitEntry = ({ directory, ports }: { readonly directory: string; readonly ports: CheckoutRootPorts }): boolean => {
  const gitEntry = ports.pathOperations.join({ segments: [directory, ".git"] });
  return ports.fileKind.isDirectory(gitEntry) || ports.fileKind.isFile(gitEntry);
};

const nearestCheckoutRootOf = ({
  directory,
  ports,
}: {
  readonly directory: string;
  readonly ports: CheckoutRootPorts;
}): string | undefined => {
  if (holdsGitEntry({ directory, ports })) {
    return directory;
  }
  const parent = ports.pathOperations.dirname({ path: directory });
  return parent === directory ? undefined : nearestCheckoutRootOf({ directory: parent, ports });
};

export type { CheckoutRootPorts };
export { nearestCheckoutRootOf };
