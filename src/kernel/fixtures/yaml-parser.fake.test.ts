import { describe, expect, test } from "bun:test";
import { createInMemoryYamlParser, failingYamlLib, UNKNOWN_DOCUMENT } from "./yaml-parser.fake.ts";

const parser = createInMemoryYamlParser({ documents: { "slug: intent-capture": { slug: "intent-capture" } } });

describe("createInMemoryYamlParser", () => {
  test("returns the document it holds for the text", () => {
    expect(parser.parse({ text: "slug: intent-capture" })).toEqual({ ok: true, value: { slug: "intent-capture" } });
  });

  test("refuses text it holds no document for", () => {
    expect(parser.parse({ text: "slug: other" }))
      .toEqual({ ok: false, refusal: { kind: "invalid-yaml", reason: UNKNOWN_DOCUMENT } });
  });
});

describe("failingYamlLib", () => {
  test("throws its reason on every parse", () => {
    expect(() => failingYamlLib({ reason: "bad indentation" }).parse("slug: [")).toThrow("bad indentation");
  });
});
