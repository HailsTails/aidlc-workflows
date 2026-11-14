import { expect, test } from "bun:test";
import { accepted } from "../../kernel/result.ts";
import { readBuildVersion } from "./legacy-channel.ts";

test("an explicit empty release environment retains the shipped stable version", () => {
  expect(readBuildVersion({})).toEqual(accepted("2.11.3"));
});

test("the legacy channel admits only the next patch's preview grammar", () => {
  expect(readBuildVersion({ ["AIDLC_BUILD_VERSION"]: "2.11.4-preview.20261109.1" }))
    .toEqual(accepted("2.11.4-preview.20261109.1"));
});
