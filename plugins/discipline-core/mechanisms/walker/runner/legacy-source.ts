import type { RunnerFailure } from "../../../core/mechanism-port/runner-failure.ts";
import type { RepoPath } from "../../../core/values/repo-path.ts";
import type { Result } from "../../../core/values/result.ts";
import type { SyntaxApi, SyntaxNode, SyntaxTree } from "./typescript-parse.ts";
import type { LocatedSnippet, ParsedSource, WalkerRepository } from "./walker-check.ts";

export type TypeScriptRepository = WalkerRepository<SyntaxApi, SyntaxTree, SyntaxNode>;
export type ParsedFileRequest = {
  readonly file: RepoPath;
  readonly parsed: ParsedSource<SyntaxTree, SyntaxNode>;
  readonly syntaxApi: SyntaxApi;
};

const EXCLUDED_DIRECTORIES: readonly string[] = [
  "node_modules", "dist", "dist-release", "build", "coverage", ".git", ".claude", "aidlc", ".aidlc",
];
const EXCLUDED_ROOT_DIRECTORIES: readonly string[] = ["vendor", ".codex", ".opencode", ".agents"];

export const sourceCandidates = (request: {
  readonly repository: TypeScriptRepository;
}): readonly RepoPath[] => request.repository.files.filter((file) => {
  const segments = file.split("/");
  return /\.tsx?$/.test(file) &&
    !segments.slice(0, -1).some((segment) => EXCLUDED_DIRECTORIES.includes(segment)) &&
    !EXCLUDED_ROOT_DIRECTORIES.includes(segments[0]);
});

export const sourceSnippet = (request: {
  readonly file: RepoPath;
  readonly tree: SyntaxTree;
  readonly node: SyntaxNode;
}): LocatedSnippet => {
  const position = request.node.getStart(request.tree);
  const location = request.tree.getLineAndCharacterOfPosition(position);
  const snippet = request.tree.text.slice(position, position + 80).replace(/\n/g, " ");
  return {
    file: request.file,
    anchor: { line: location.line + 1, column: location.character },
    snippet: snippet.length === 80 ? `${snippet}…` : snippet,
  };
};

export const inspectParsedFiles = (request: {
  readonly repository: TypeScriptRepository;
  readonly inspect: (request: ParsedFileRequest) => readonly LocatedSnippet[];
}): Result<readonly LocatedSnippet[], RunnerFailure> =>
  sourceCandidates(request).reduce<Result<readonly LocatedSnippet[], RunnerFailure>>((collected, file) => {
    if (collected.outcome === "failed") {
      return collected;
    }
    const parsed = request.repository.parseFile({ file });
    return parsed.outcome === "failed"
      ? parsed
      : { outcome: "ok", value: [...collected.value, ...request.inspect({ file, parsed: parsed.value, syntaxApi: request.repository.syntaxApi })] };
  }, { outcome: "ok", value: [] });
