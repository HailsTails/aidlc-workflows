import { describe, expect, it } from "vitest";
import type { Anchor, AnchorKind } from "./anchor.ts";
import type { Equal } from "./type-equality.ts";

const anchorKindIsTheLockedUnion: Equal<
  AnchorKind,
  | { readonly kind: "keyword"; readonly keyword: string }
  | { readonly kind: "file" }
  | { readonly kind: "source" }
> = true;

const anchorIsLineAndColumn: Equal<
  Anchor,
  { readonly line: number; readonly column: number }
> = true;

describe("anchor types", () => {
  it("defines AnchorKind as the keyword, file or source union", () => {
    expect(anchorKindIsTheLockedUnion).toBe(true);
  });

  it("defines Anchor as a line and a column", () => {
    expect(anchorIsLineAndColumn).toBe(true);
  });
});
