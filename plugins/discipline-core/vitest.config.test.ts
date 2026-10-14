import { describe, expect, it } from "vitest";
import config from "./vitest.config.ts";

describe("discipline-core Vitest configuration", () => {
  it("roots the run at the plugin directory", () => {
    expect(config.root).toBe(import.meta.dirname);
  });

  it("collects every test file under the plugin", () => {
    expect(config.test?.include).toEqual(["**/*.test.ts"]);
  });

  it("skips installed packages", () => {
    expect(config.test?.exclude).toContain("**/node_modules/**");
  });

  it("skips test fixtures", () => {
    expect(config.test?.exclude).toContain("**/test-fixtures/**");
  });
});
