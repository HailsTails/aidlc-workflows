import { expect, test } from "bun:test";
import { createAuthoredYaml, canonicalYamlMappingText } from "./authored-yaml.ts";

test.each([
  "tools: [read]\ntools: [agent]",
  'tools: [read]\n"tools": [agent]',
  "permissions:\n  rules: []\n  rules: []",
  "permissions: [",
])("YAML codec rejects ambiguous or malformed mappings: %s", (text) => {
  expect(createAuthoredYaml().decode({ text })).toEqual({
    status: "invalid",
    findings: [
      {
        code: "invalid-input",
        subject: "frontmatter",
        detail: "expected valid YAML with unique mapping keys",
      },
    ],
  });
});
test("YAML codec preserves nested native permissions and scalar types", () => {
  expect(
    createAuthoredYaml().decode({ text: "  enabled: true\n  rules:\n    - command: deny" }),
  ).toEqual({ status: "ok", value: { enabled: true, rules: [{ command: "deny" }] } });
});
test.each([
  {
    text: " name: worker\n examples:\n   - method.md",
    expected: "name: worker\nexamples:\n  - method.md",
  },
  {
    text: "name: worker\nexamples:\n  - method.md",
    expected: "name: worker\nexamples:\n  - method.md",
  },
  { text: "\n  name: worker\n\n", expected: "\nname: worker\n\n" },
])("canonical indentation preserves relative structure", ({ text, expected }) => {
  expect(canonicalYamlMappingText({ text })).toBe(expected);
});
