import { accepted, refused } from "./result.ts";
import type { YamlParser } from "./yaml-parser-port.ts";

export type BunYamlLib = { readonly parse: (text: string) => unknown };

export type CreateBunYamlParserArgs = { readonly yamlLib?: BunYamlLib };

export const createBunYamlParser = (
  { yamlLib = Bun.YAML }: CreateBunYamlParserArgs = {},
): YamlParser => ({
  parse: ({ text }) => {
    try {
      return accepted(yamlLib.parse(text));
    } catch (thrown) {
      return refused({ kind: "invalid-yaml", reason: thrown instanceof Error ? thrown.message : String(thrown) });
    }
  },
});
