import { assert, describe, expect, it } from "vitest";
import { createCliDependencies } from "./composition-root.ts";

const consumerProjectRoot = new URL("../../../", import.meta.url);

describe("createCliDependencies", () => {
  it("reads the identity configuration from the consumer's aidlc directory beside its harness directory", async () => {
    const configuration = await createCliDependencies().loadConfiguration();

    assert(configuration.kind === "failure");
    expect(configuration.reason).toEqual({
      kind: "configuration-unreadable",
      location: new URL("aidlc/github-identity.json", consumerProjectRoot).href,
    });
  });

  it("points git's credential helper at this tool's CLI entry, run through bun", () => {
    expect(createCliDependencies().credentialHelperCommand).toMatch(
      /^!bun ".+\/tools\/github-apps\/cli-main\.ts" git-credential --operation$/,
    );
  });
});
