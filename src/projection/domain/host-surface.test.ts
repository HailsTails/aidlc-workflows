import { describe, expect, test } from "bun:test";
import { source } from "../../kernel/fixtures/values.fixture.ts";
import { accepted, refused } from "../../kernel/result.ts";
import { authoredSourcePaths } from "./host-surface.ts";

describe("authoredSourcePaths", () => {
  test("accepts every portable path in order", () => {
    expect(authoredSourcePaths(["a/b.md", "c.md"])).toEqual(accepted([source("a/b.md"), source("c.md")]));
  });

  test("accepts an empty list", () => {
    expect(authoredSourcePaths([])).toEqual(accepted([]));
  });

  test("refuses with the first unportable path", () => {
    expect(authoredSourcePaths(["a.md", "bad:name", "c?.md"]))
      .toEqual(refused({ kind: "invalid-path", base: "source", raw: "bad:name" }));
  });
});
