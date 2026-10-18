import { describe, expect, it } from "vitest";
import { requiredEntry } from "./required-entry.ts";

const TABLE: Readonly<Record<string, string>> = { "/package": "/package/README.md" };

describe("requiredEntry", () => {
  it("returns the entry the table holds for the key", () => {
    expect(requiredEntry({ table: TABLE, key: "/package" })).toBe("/package/README.md");
  });

  it("fails naming the key when the table holds no entry for it", () => {
    expect(() => requiredEntry({ table: TABLE, key: "/scratch" })).toThrow("the fake table holds no entry for /scratch");
  });
});
