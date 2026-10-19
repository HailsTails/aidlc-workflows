import type { RunnerFailure } from "../../../core/mechanism-port/runner-failure.ts";
import type { RunnerClause } from "../../../core/mechanism-port/runner-module-schema.ts";
import type { Hit } from "../../../core/mechanism-port/runner-result-schema.ts";
import type { Anchor } from "../../../core/values/anchor.ts";
import type { ClauseAddress } from "../../../core/values/clause-address.ts";
import type { RepoPath } from "../../../core/values/repo-path.ts";
import type { Result } from "../../../core/values/result.ts";
import type { CommentRange, SyntaxApi, SyntaxNode, SyntaxTree } from "./typescript-parse.ts";

export type PieceHit = {
  readonly clause: ClauseAddress;
  readonly anchor: Anchor;
  readonly snippet: string;
};

export type WalkerFile = {
  readonly file: RepoPath;
  readonly readText: () => Result<string, RunnerFailure>;
};

export type SourceObservers = {
  readonly enter?: (request: { readonly node: SyntaxNode }) => void;
  readonly leave?: (request: { readonly node: SyntaxNode }) => void;
  readonly comment?: (request: { readonly range: CommentRange }) => void;
  readonly finish: () => readonly PieceHit[];
};

export type PreparedFileCheck =
  | { readonly kind: "skipped" }
  | { readonly kind: "complete"; readonly hits: readonly PieceHit[] }
  | {
      readonly kind: "syntax";
      readonly begin: (request: {
        readonly sourceFile: SyntaxTree;
        readonly anchorAt: (request: { readonly position: number }) => Anchor;
      }) => SourceObservers;
    };

export type PreparedWalkerCheck = {
  readonly prepareFile: (request: WalkerFile) => Result<PreparedFileCheck, RunnerFailure>;
  readonly finish: () => Result<readonly Hit[], RunnerFailure>;
};

export type WalkerRepository = {
  readonly files: readonly RepoPath[];
  readonly exists: (request: { readonly file: RepoPath }) => "present" | "absent";
};

export type WalkerPiece = {
  readonly prepare: (request: {
    readonly clauses: readonly RunnerClause[];
    readonly repository: WalkerRepository;
    readonly syntaxApi: SyntaxApi;
  }) => Result<PreparedWalkerCheck, RunnerFailure>;
};
