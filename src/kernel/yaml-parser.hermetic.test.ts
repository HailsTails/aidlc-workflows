import { describe, expect, test } from "bun:test";
import { createBunYamlParser } from "./yaml-parser.ts";

const parser = createBunYamlParser();

describe("createBunYamlParser on the real runtime's YAML", () => {
  test("parses a stage frontmatter header", () => {
    expect(parser.parse({ text: "slug: requirements-analysis\nsensors:\n  - linter\nreviewer_max_iterations: 2" }))
      .toEqual({ ok: true, value: { slug: "requirements-analysis", sensors: ["linter"], ["reviewer_max_iterations"]: 2 } });
  });

  test("refuses text that is not YAML", () => {
    expect(parser.parse({ text: "slug: [unclosed" })).toMatchObject({ ok: false, refusal: { kind: "invalid-yaml" } });
  });
});
