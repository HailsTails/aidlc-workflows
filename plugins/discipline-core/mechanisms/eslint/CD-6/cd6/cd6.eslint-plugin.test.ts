import { describe, expect, it } from "vitest";
import type { SourceCase } from "../../../../core/rule-set-reader/rule-set-reader.ts";
import { absolutePathSchema } from "../../../../core/values/absolute-path.ts";
import { repoPathSchema } from "../../../../core/values/repo-path.ts";
import { createDefaultEslintPort } from "../../runner/eslint-instance.ts";
import { eslintPluginModuleSchema } from "../../runner/eslint-plugin-schema.ts";
import cd6Plugin from "./cd6.eslint-plugin.ts";

const PIECE_ROOT = absolutePathSchema.parse(`${import.meta.dirname}/..`);

const loadedPlugin = eslintPluginModuleSchema.parse({ default: cd6Plugin }).default;

const eslint = createDefaultEslintPort({});

const flagCases: readonly SourceCase[] = [
  {
    name: "a const with an interior underscore",
    fileName: repoPathSchema.parse("const-underscore.ts"),
    source: "export const Bad_Name = 1;\n",
    expectedLines: [1],
  },
  {
    name: "a function in snake case",
    fileName: repoPathSchema.parse("function-snake.ts"),
    source: "export function render_it(): void {}\n",
    expectedLines: [1],
  },
  {
    name: "a type alias in snake case",
    fileName: repoPathSchema.parse("type-snake.ts"),
    source: "export type snake_type = string;\n",
    expectedLines: [1],
  },
  {
    name: "an enum member in lower case",
    fileName: repoPathSchema.parse("enum-lower.ts"),
    source: "export enum Colour {\n  RED = 1,\n  green = 2,\n}\n",
    expectedLines: [3],
  },
  {
    name: "an object literal property in snake case",
    fileName: repoPathSchema.parse("property-snake.ts"),
    source: "export const record = {\n  first_name: 1,\n};\n",
    expectedLines: [2],
  },
  {
    name: "a default import with an interior underscore",
    fileName: repoPathSchema.parse("default-import.ts"),
    source: "import Foo_Bar from \"./foo-bar.ts\";\nexport { Foo_Bar };\n",
    expectedLines: [1],
  },
  {
    name: "a parameter in snake case",
    fileName: repoPathSchema.parse("parameter-snake.ts"),
    source: "export const double = (my_size: number): number => my_size * 2;\n",
    expectedLines: [1],
  },
];

const allowCases: readonly SourceCase[] = [
  {
    name: "an upper snake const",
    fileName: repoPathSchema.parse("const-upper.ts"),
    source: "export const MAX_RETRIES = 3;\n",
    expectedLines: [],
  },
  {
    name: "an unused variable with a leading underscore",
    fileName: repoPathSchema.parse("unused-underscore.ts"),
    source: "const _ignored = 1;\nexport {};\n",
    expectedLines: [],
  },
  {
    name: "a property that requires quotes",
    fileName: repoPathSchema.parse("quoted-property.ts"),
    source: "export const headers = {\n  \"content-type\": \"text/plain\",\n};\n",
    expectedLines: [],
  },
  {
    name: "a pascal case class and interface",
    fileName: repoPathSchema.parse("pascal-types.ts"),
    source: "export interface Reader {\n  readonly size: number;\n}\nexport class FileReader implements Reader {\n  readonly size = 1;\n}\n",
    expectedLines: [],
  },
  {
    name: "an upper snake enum member",
    fileName: repoPathSchema.parse("enum-upper.ts"),
    source: "export enum Colour {\n  RED = 1,\n  DARK_GREEN = 2,\n}\n",
    expectedLines: [],
  },
];

describe("CD-6 naming-convention rule through the ESLint runner's lintSourceCases", () => {
  it.each([...flagCases, ...allowCases])("flags exactly the expected lines of the case $name", async (sourceCase) => {
    expect(
      await eslint.lintSourceCases({
        cwd: PIECE_ROOT,
        plugin: loadedPlugin,
        pluginNamespace: "discipline-cd6",
        rule: "naming-convention",
        options: [
          {
            "selector": [
              "objectLiteralProperty",
              "objectLiteralMethod",
              "typeProperty",
              "typeMethod",
              "classProperty",
              "classMethod",
              "accessor",
              "enumMember"
            ],
            "modifiers": [
              "requiresQuotes"
            ],
            "format": null
          },
          {
            "selector": [
              "variable",
              "function",
              "parameter"
            ],
            "modifiers": [
              "unused"
            ],
            "format": null,
            "filter": {
              "regex": "^_",
              "match": true
            }
          },
          {
            "selector": [
              "variable",
              "parameter"
            ],
            "modifiers": [
              "destructured"
            ],
            "format": null
          },
          {
            "selector": "import",
            "format": null
          },
          {
            "selector": [
              "classProperty",
              "classMethod",
              "accessor",
              "parameterProperty"
            ],
            "modifiers": [
              "override"
            ],
            "format": null
          },
          {
            "selector": "variable",
            "modifiers": [
              "const"
            ],
            "format": null,
            "custom": {
              "regex": "^(?:[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*|[a-z0-9][A-Za-z0-9]*|[A-Z](?:[A-Za-z0-9]*[a-z][A-Za-z0-9]*|[0-9]*))$",
              "match": true
            }
          },
          {
            "selector": "variable",
            "format": null,
            "custom": {
              "regex": "^[_$]*(?:[a-z0-9][A-Za-z0-9]*|[A-Z](?:[A-Za-z0-9]*[a-z][A-Za-z0-9]*|[0-9]*))?[_$]*$",
              "match": true
            }
          },
          {
            "selector": "function",
            "format": null,
            "custom": {
              "regex": "^[_$]*(?:[a-z0-9][A-Za-z0-9]*|[A-Z](?:[A-Za-z0-9]*[a-z][A-Za-z0-9]*|[0-9]*))?[_$]*$",
              "match": true
            }
          },
          {
            "selector": "function",
            "modifiers": [
              "global"
            ],
            "format": null,
            "custom": {
              "regex": "^[_$]*(?:[a-z0-9][A-Za-z0-9]*|[A-Z](?:[A-Za-z0-9]*[a-z][A-Za-z0-9]*|[0-9]*)|[A-Z][A-Z0-9]*)?[_$]*$",
              "match": true
            }
          },
          {
            "selector": "parameter",
            "format": null,
            "custom": {
              "regex": "^[_$]*(?:[a-z0-9][A-Za-z0-9]*|[A-Z](?:[A-Za-z0-9]*[a-z][A-Za-z0-9]*|[0-9]*))?[_$]*$",
              "match": true
            }
          },
          {
            "selector": "typeLike",
            "format": null,
            "custom": {
              "regex": "^[_$]*(?:[A-Z](?:[A-Za-z0-9]*[a-z][A-Za-z0-9]*|[0-9]*))?[_$]*$",
              "match": true
            }
          },
          {
            "selector": "enumMember",
            "format": null,
            "custom": {
              "regex": "^(?:[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*)$",
              "match": true
            }
          },
          {
            "selector": [
              "classProperty",
              "classMethod",
              "accessor",
              "parameterProperty"
            ],
            "format": null,
            "custom": {
              "regex": "^[_$]*(?:[a-z0-9][A-Za-z0-9]*)?[_$]*$",
              "match": true
            }
          },
          {
            "selector": [
              "classProperty",
              "accessor"
            ],
            "modifiers": [
              "static"
            ],
            "format": null,
            "custom": {
              "regex": "^[_$]*(?:[a-z0-9][A-Za-z0-9]*|[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*)?[_$]*$",
              "match": true
            }
          },
          {
            "selector": "objectLiteralProperty",
            "format": null,
            "custom": {
              "regex": "^(?:[a-z0-9][A-Za-z0-9]*)$",
              "match": true
            }
          },
          {
            "selector": "objectLiteralMethod",
            "format": null,
            "custom": {
              "regex": "^[_$]*(?:[a-z0-9][A-Za-z0-9]*)?[_$]*$",
              "match": true
            }
          },
          {
            "selector": "typeProperty",
            "format": null,
            "custom": {
              "regex": "^(?:[a-z0-9][A-Za-z0-9]*|[A-Z](?:[A-Za-z0-9]*[a-z][A-Za-z0-9]*|[0-9]*))$",
              "match": true
            }
          },
          {
            "selector": "typeMethod",
            "format": null,
            "custom": {
              "regex": "^[_$]*(?:[a-z0-9][A-Za-z0-9]*)?[_$]*$",
              "match": true
            }
          },
          {
            "selector": "import",
            "modifiers": [
              "default"
            ],
            "format": null,
            "custom": {
              "regex": "^[_$]*(?:[a-z0-9][A-Za-z0-9]*|[A-Z](?:[A-Za-z0-9]*[a-z][A-Za-z0-9]*|[0-9]*)|[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*)?[_$]*$",
              "match": true
            }
          },
          {
            "selector": "import",
            "modifiers": [
              "namespace"
            ],
            "format": null,
            "custom": {
              "regex": "^[_$]*(?:[a-z0-9][A-Za-z0-9]*|[A-Z](?:[A-Za-z0-9]*[a-z][A-Za-z0-9]*|[0-9]*))?[_$]*$",
              "match": true
            }
          }
        ],
        cases: [sourceCase],
      }),
    ).toEqual({
      outcome: "ok",
      value: [{ caseName: sourceCase.name, flaggedLines: sourceCase.expectedLines }],
    });
  });
});
