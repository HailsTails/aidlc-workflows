import { describe, expect, test } from "bun:test";
import { failingYamlLib } from "./fixtures/yaml-parser.fake.ts";
import { createBunYamlParser } from "./yaml-parser.ts";

describe("createBunYamlParser over its YAML library seam", () => {
  test("returns what the library parsed", () => {
    const parser = createBunYamlParser({ yamlLib: { parse: () => ({ slug: "requirements-analysis" }) } });

    expect(parser.parse({ text: "slug: requirements-analysis" }))
      .toEqual({ ok: true, value: { slug: "requirements-analysis" } });
  });

  test("returns a library failure as invalid YAML, with its reason", () => {
    const parser = createBunYamlParser({ yamlLib: failingYamlLib({ reason: "bad indentation" }) });

    expect(parser.parse({ text: "slug: [" }))
      .toEqual({ ok: false, refusal: { kind: "invalid-yaml", reason: "bad indentation" } });
  });
});
