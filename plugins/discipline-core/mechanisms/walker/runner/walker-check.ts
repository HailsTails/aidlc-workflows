import type { Anchor, AnchorKind } from "../../../core/values/anchor.ts";
import type { RepoPath } from "../../../core/values/repo-path.ts";
import type { Result } from "../../../core/values/result.ts";
import type { RunnerFailure } from "../../../core/mechanism-port/runner-failure.ts";

export type AnchoredSnippet = { readonly anchor: Anchor; readonly snippet: string };

export type PathVerdict = "violates" | "conforms";

export type LocatedSnippet = AnchoredSnippet & { readonly file: RepoPath };

export type ParsedSource<Tree, Node> = {
  readonly source: string;
  readonly tree: Tree;
  readonly nodes: readonly Node[];
};

export type WalkerRepository<Api, Tree, Node> = {
  readonly syntaxApi: Api;
  readonly files: readonly RepoPath[];
  readonly trackedPaths: readonly RepoPath[];
  readonly readText: (request: { readonly file: RepoPath }) => Result<string, RunnerFailure>;
  readonly parseFile: (request: { readonly file: RepoPath }) => Result<ParsedSource<Tree, Node>, RunnerFailure>;
};

export type WalkerCheck<Api, Tree, Node> =
  | {
      readonly kind: "repository";
      readonly inspect: (request: {
        readonly repository: WalkerRepository<Api, Tree, Node>;
      }) => Result<readonly LocatedSnippet[], RunnerFailure>;
    }
  | {
      readonly kind: "syntax";
      readonly inspect: (request: {
        readonly node: Node;
        readonly tree: Tree;
        readonly syntaxApi: Api;
        readonly anchorKind: AnchorKind;
        readonly anchorAt: (request: { readonly position: number }) => AnchoredSnippet;
      }) => readonly AnchoredSnippet[];
    }
  | {
      readonly kind: "path";
      readonly inspect: (request: { readonly file: RepoPath }) => PathVerdict;
    };

export type ParsePort<Api, Tree, Node> = {
  readonly syntaxApi: Api;
  readonly parse: (request: { readonly fileName: string; readonly source: string }) => Tree;
  readonly children: (request: { readonly node: Tree | Node }) => readonly Node[];
};
