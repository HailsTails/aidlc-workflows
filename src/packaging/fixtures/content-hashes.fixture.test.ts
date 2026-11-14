import { describe, expect, test } from "bun:test";
import { hashOf } from "./content-hashes.fixture.ts";

describe("hashOf", () => {
  test("returns the fixed sha256 of a known text", () => {
    expect(hashOf({ kind: "text", text: "# Code Generation Guide\n" })).toBe<string>(
      "sha256:6109428b0c94525fae102ff4175965ba17e5ae27a2c847bf4cbbfbe9638a4eb3",
    );
  });

  test("returns the fixed sha256 of the gitignore block body", () => {
    expect(hashOf({ kind: "text", text: "aidlc/**/.aidlc-*\n" })).toBe<string>(
      "sha256:84fcf62c2fd7a35c8e662a7d2f5318399fd5163a98bc0b283d4227b3b571f687",
    );
  });

  test("throws for a text the fixtures hold no hash for", () => {
    expect(() => hashOf({ kind: "text", text: "# Unknown\n" })).toThrow(
      "The fixtures hold no fixed hash for this content",
    );
  });

  test("throws for byte content", () => {
    expect(() => hashOf({ kind: "bytes", bytes: new Uint8Array([35, 10]) })).toThrow(
      "The fixtures hold no fixed hash for this content",
    );
  });
});
