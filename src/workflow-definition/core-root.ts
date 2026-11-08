import { accepted } from "../kernel/result.ts";
import { readAuthoredCore } from "./adapters/authored-core-reader.ts";
import { createMarkdownOutliner } from "./adapters/markdown-outliner.ts";
import { createSourceFiles } from "./adapters/source-files.ts";
import { compileCoreMethod } from "./domain/compile-core-method.ts";

export const loadAuthoredCoreMethod = async (request: {
  readonly coreRoot: string | URL;
  readonly markdownBlocks: Parameters<typeof createMarkdownOutliner>[0];
}) => {
  const authored = await readAuthoredCore({ sourceFiles: createSourceFiles(request.coreRoot),
    outliner: createMarkdownOutliner(request.markdownBlocks), hooks: [] });
  if (!authored.ok) return authored;
  const compiled = compileCoreMethod(authored.value.core);
  return compiled.ok ? accepted({ method: compiled.value, sources: authored.value.files }) : compiled;
};
