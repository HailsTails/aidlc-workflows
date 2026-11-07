import { containsPrivateKey } from "../domain/publishable-text.ts";
import { fail, succeed, type Result } from "../domain/result.ts";
import type { StorePlacementCheck } from "./credential-store-boundary.ts";
import type { TextFileReader } from "./text-file-port.ts";

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
  readonly placeInStore: StorePlacementCheck;
};

const createBodyFileReader =
  ({ readTextFile, placeInStore }: BodyFileSafeguards): BodyFileReader =>
  async (location) => {
    const placement = await placeInStore(location);
    if (placement.kind === "unresolvable") return fail({ kind: "body-file-unreadable", location });
    if (placement.kind === "inside-store") {
      return fail({ kind: "body-file-refused", location, reason: "inside-credential-store" });
    }
    const bodyText = await readTextFile(placement.canonicalPath);
    if (bodyText.kind === "failure") return fail({ kind: "body-file-unreadable", location });
    if (containsPrivateKey(bodyText.outcome)) {
      return fail({ kind: "body-file-refused", location, reason: "contains-private-key" });
    }
    return succeed(bodyText.outcome);
  };

export { createBodyFileReader, type BodyFileFailure, type BodyFileReader };
