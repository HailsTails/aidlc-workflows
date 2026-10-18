import { describe, expect, it } from "vitest";
import type { Equal } from "./type-equality.ts";

describe("Equal", () => {
  it("is true for two identical object types", () => {
    const identical: Equal<
      { readonly name: string },
      { readonly name: string }
    > = true;
    expect(identical).toBe(true);
  });

  it("is false for a readonly array against a mutable one", () => {
    const readonlyArray: Equal<readonly string[], string[]> = false;
    expect(readonlyArray).toBe(false);
  });
});
