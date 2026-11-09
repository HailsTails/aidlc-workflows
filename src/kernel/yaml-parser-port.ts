import type { Result } from "./result.ts";

export type ParseYamlArgs = { readonly text: string };

export type YamlRefusal = { readonly kind: "invalid-yaml"; readonly reason: string };

export type YamlParser = {
  parse(parseYamlArgs: ParseYamlArgs): Result<unknown, YamlRefusal>;
};
