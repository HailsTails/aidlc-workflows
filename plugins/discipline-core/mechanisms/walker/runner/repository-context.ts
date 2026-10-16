import type { RunnerFailure } from "../../../core/mechanism-port/runner-failure.ts";
import type { FileTextPort } from "../../../core/platform-ports/file-text-port.ts";
import type { PathPort } from "../../../core/platform-ports/path-port.ts";
import type { RepoPath } from "../../../core/values/repo-path.ts";
import type { Result } from "../../../core/values/result.ts";
import type { ParsePort, ParsedSource, WalkerRepository } from "./walker-check.ts";

export const cachedParsePort = <Api, Tree, Node>(parse: ParsePort<Api, Tree, Node>): ParsePort<Api, Tree, Node> => {
  const trees = new Map<string, { readonly tree: Tree }>();
  const children = new Map<Tree | Node, readonly Node[]>();
  return {
    syntaxApi: parse.syntaxApi,
    parse: (request) => {
      const existing = trees.get(request.fileName);
      if (existing !== undefined) {
        return existing.tree;
      }
      const tree = parse.parse(request);
      trees.set(request.fileName, { tree });
      return tree;
    },
    children: (request) => {
      const existing = children.get(request.node);
      if (existing !== undefined) {
        return existing;
      }
      const found = parse.children(request);
      children.set(request.node, found);
      return found;
    },
  };
};

const descendantsOf = <Api, Tree, Node>(request: {
  readonly node: Tree | Node;
  readonly parse: ParsePort<Api, Tree, Node>;
}): readonly Node[] => request.parse.children({ node: request.node }).flatMap(
  (node) => [node, ...descendantsOf({ node, parse: request.parse })],
);

export const createRepositoryContext = <Api, Tree, Node>(options: {
  readonly repoRoot: string;
  readonly files: readonly RepoPath[];
  readonly trackedPaths: readonly RepoPath[];
  readonly fileText: Pick<FileTextPort, "read" | "exists">;
  readonly path: PathPort;
  readonly parse: ParsePort<Api, Tree, Node>;
}): WalkerRepository<Api, Tree, Node> => {
  const texts = new Map<RepoPath, Result<string, RunnerFailure>>();
  const parsed = new Map<RepoPath, Result<ParsedSource<Tree, Node>, RunnerFailure>>();
  const readText: WalkerRepository<Api, Tree, Node>["readText"] = ({ file }) => {
    const existing = texts.get(file);
    if (existing !== undefined) {
      return existing;
    }
    const text = options.fileText.read({ path: options.path.join({ segments: [options.repoRoot, file] }) });
    const result: Result<string, RunnerFailure> = text.outcome === "ok" ? text : {
      outcome: "failed", error: { kind: "file-unreadable", file, detail: text.error.detail },
    };
    texts.set(file, result);
    return result;
  };
  return {
    syntaxApi: options.parse.syntaxApi,
    files: options.files,
    trackedPaths: options.trackedPaths,
    exists: ({ file }) => options.fileText.exists({ path: options.path.join({ segments: [options.repoRoot, file] }) }),
    readText,
    parseFile: ({ file }) => {
      const existing = parsed.get(file);
      if (existing !== undefined) {
        return existing;
      }
      const source = readText({ file });
      if (source.outcome === "failed") {
        return source;
      }
      try {
        const tree = options.parse.parse({ fileName: file, source: source.value });
        const result = { outcome: "ok", value: { source: source.value, tree, nodes: descendantsOf({ node: tree, parse: options.parse }) } } as const;
        parsed.set(file, result);
        return result;
      } catch (thrown) {
        const result = { outcome: "failed", error: { kind: "file-unparseable", file, detail: thrown instanceof Error ? thrown.message : String(thrown) } } as const;
        parsed.set(file, result);
        return result;
      }
    },
  };
};
