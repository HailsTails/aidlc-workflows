import { containsPrivateKey, isInsideDirectory } from "../domain/publishable-text.ts";
import { fail, succeed, type Result } from "../domain/result.ts";
import type { StoreLocator } from "./credential-store-port.ts";
import type { CanonicalPathResolver, TextFileReader } from "./text-file-port.ts";

type BodyFileFailure =
  | { readonly kind: "body-file-unreadable"; readonly location: string }
  | {
      readonly kind: "body-file-refused";
      readonly location: string;
      readonly reason: "inside-credential-store" | "contains-private-key";
    };

type BodyFileReader = (location: string) => Promise<Result<string, BodyFileFailure>>;

type BodyFileSafeguards = {
  readonly readTextFile: TextFileReader;
  readonly resolveCanonicalPath: CanonicalPathResolver;
  readonly locateCredentialStore: StoreLocator;
};

type StoreBoundary = Pick<BodyFileSafeguards, "resolveCanonicalPath" | "locateCredentialStore">;

const credentialStoreDirectories = async ({
  resolveCanonicalPath,
  locateCredentialStore,
}: StoreBoundary): Promise<readonly string[]> => {
  const located = locateCredentialStore();
  if (located.kind === "failure") return [];
  const canonical = await resolveCanonicalPath(located.outcome);
  return canonical.kind === "success" ? [located.outcome, canonical.outcome] : [located.outcome];
};

const createBodyFileReader =
  (safeguards: BodyFileSafeguards): BodyFileReader =>
  async (location) => {
    const canonical = await safeguards.resolveCanonicalPath(location);
    if (canonical.kind === "failure") return fail({ kind: "body-file-unreadable", location });
    const storeDirectories = await credentialStoreDirectories(safeguards);
    if (
      storeDirectories.some((directory) =>
        isInsideDirectory({ path: canonical.outcome, directory }),
      )
    ) {
      return fail({ kind: "body-file-refused", location, reason: "inside-credential-store" });
    }
    const bodyText = await safeguards.readTextFile(canonical.outcome);
    if (bodyText.kind === "failure") return fail({ kind: "body-file-unreadable", location });
    if (containsPrivateKey(bodyText.outcome)) {
      return fail({ kind: "body-file-refused", location, reason: "contains-private-key" });
    }
    return succeed(bodyText.outcome);
  };

export { createBodyFileReader, type BodyFileFailure, type BodyFileReader };
