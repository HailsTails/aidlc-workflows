import { describe, expect, it } from "vitest";
import { isEmbeddedExceptionPathEqual, isEmbeddedKeySetEqual } from "./embedded-runner-module-schema.ts";

describe("the embedded runner's ties to its module schema", () => {
  it("holds the same key set as the module schema", () => {
    expect(isEmbeddedKeySetEqual).toBe(true);
  });

  it("holds the same exception path as the module schema", () => {
    expect(isEmbeddedExceptionPathEqual).toBe(true);
  });
});
