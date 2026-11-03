import { isInsideDirectory } from "../domain/publishable-text.ts";
import type { StoreLocator } from "./credential-store-port.ts";
import type { CanonicalPathResolver } from "./text-file-port.ts";

type StoreBoundary = {
  readonly resolveCanonicalPath: CanonicalPathResolver;
  readonly locateCredentialStore: StoreLocator;
};

type StorePlacement =
  | { readonly kind: "inside-store" }
  | { readonly kind: "outside-store"; readonly canonicalPath: string }
  | { readonly kind: "unresolvable" };

type StorePlacementCheck = (location: string) => Promise<StorePlacement>;

const credentialStoreDirectories = async ({
  resolveCanonicalPath,
  locateCredentialStore,
}: StoreBoundary): Promise<readonly string[]> => {
  const located = locateCredentialStore();
  if (located.kind === "failure") return [];
  const canonical = await resolveCanonicalPath(located.outcome);
  return canonical.kind === "success" ? [located.outcome, canonical.outcome] : [located.outcome];
};

const createStorePlacementCheck =
  (boundary: StoreBoundary): StorePlacementCheck =>
  async (location) => {
    const canonical = await boundary.resolveCanonicalPath(location);
    if (canonical.kind === "failure") return { kind: "unresolvable" };
    const storeDirectories = await credentialStoreDirectories(boundary);
    const insideStore = storeDirectories.some((directory) =>
      isInsideDirectory({ path: canonical.outcome, directory }),
    );
    return insideStore
      ? { kind: "inside-store" }
      : { kind: "outside-store", canonicalPath: canonical.outcome };
  };

export {
  createStorePlacementCheck,
  type StoreBoundary,
  type StorePlacement,
  type StorePlacementCheck,
};
