import type { Anchor, AnchorKind } from "../../../core/values/anchor.ts";
import type { RepoPath } from "../../../core/values/repo-path.ts";

export type AnchoredSnippet = { readonly anchor: Anchor; readonly snippet: string };

export type PathVerdict = "violates" | "conforms";

export type WalkerCheck<Api, Tree, Node> =
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
