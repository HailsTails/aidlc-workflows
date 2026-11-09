import type { FrontmatterParser, MarkdownOutliner, MethodContentDecoder } from "../application/ports.ts";
import { decodeAuthoredCore } from "./authored-core-reader.ts";
import { readContribution } from "./read-contribution.ts";

export const createMethodContentDecoder = (request: {
  readonly parser: FrontmatterParser;
  readonly outliner: MarkdownOutliner;
}): MethodContentDecoder => ({
  decodeCore: async (files) => decodeAuthoredCore({ ...request, files, hooks: [] }),
  decodeContribution: (capture) => readContribution({ ...request, capture }),
});
