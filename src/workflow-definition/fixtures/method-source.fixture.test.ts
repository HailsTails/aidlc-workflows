import { describe, expect, test } from "bun:test";
import { methodSource } from "./method-source.fixture.ts";

describe("methodSource", () => {
  test("returns the path of a source under the folder for its kind", () => {
    expect(methodSource({ kind: "scope", within: "aidlc-feature.md" })).toBe<string>(
      "scopes/aidlc-feature.md",
    );
  });

  test("throws for a location that climbs out of its folder", () => {
    expect(() => methodSource({ kind: "rule", within: "../org.md" })).toThrow(
      'Fixture value refused: {"kind":"invalid-method-source-location","raw":"memory/../org.md"}',
    );
  });
});
