import { accepted, refused } from "../result.ts";
import type { YamlParser } from "../yaml-parser-port.ts";
import type { BunYamlLib } from "../yaml-parser.ts";

export type InMemoryYamlParserArgs = {
  readonly documents: Readonly<Record<string, unknown>>;
};

export const UNKNOWN_DOCUMENT = "The fake holds no document for this text.";

export const createInMemoryYamlParser = ({ documents }: InMemoryYamlParserArgs): YamlParser => ({
  parse: ({ text }) => text in documents
    ? accepted(documents[text])
    : refused({ kind: "invalid-yaml", reason: UNKNOWN_DOCUMENT }),
});

export const failingYamlLib = ({ reason }: { readonly reason: string }): BunYamlLib => ({
  parse: () => {
    throw new Error(reason);
  },
});
