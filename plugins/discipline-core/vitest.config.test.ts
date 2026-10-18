import { describe, expect, it } from "vitest";
import config from "./vitest.config.ts";

describe("discipline-core Vitest configuration", () => {
  it("collects every test file under the plugin", () => {
    expect(config.test?.include).toEqual(["**/*.test.ts"]);
  });
});
