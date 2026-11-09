import type { AuthoredMethodLoading } from "./application/use-cases.ts";
import { createMethodContentDecoder } from "./adapters/method-content-decoder.ts";
import { createMethodCompiler } from "./application/create-method-compiler.ts";
import { loadCoreMethod, loadPluginMethod } from "./application/load-authored-method.ts";
import type { AuthoredTreeReader, FrontmatterParser, MarkdownOutliner } from "./application/ports.ts";

export const createAuthoredMethodLoading = (request: {
  readonly reader: AuthoredTreeReader;
  readonly parser: FrontmatterParser;
  readonly outliner: MarkdownOutliner;
}): AuthoredMethodLoading => {
  const outliner = request.outliner;
  const decoder = createMethodContentDecoder({ parser: request.parser, outliner });
  const compiler = createMethodCompiler(outliner);
  return {
    loadCore: (coreRoot: URL) => loadCoreMethod({ coreRoot, reader: request.reader, decoder }),
    loadPlugins: (plugin) =>
      loadPluginMethod({ ...plugin, reader: request.reader, decoder, compiler }),
  };
};
