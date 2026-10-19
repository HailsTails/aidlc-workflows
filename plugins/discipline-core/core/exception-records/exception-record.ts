import type { ClauseAddress } from "../values/clause-address.ts";
import type { MechanismId } from "../values/identifiers.ts";
import type { RepoPath } from "../values/repo-path.ts";
import type { WhyChain } from "../values/why-chain.ts";

export type ExceptionRecord =
  | {
      readonly kind: "authorised-location";
      readonly clause: ClauseAddress;
      readonly mechanism: MechanismId;
      readonly file: RepoPath;
      readonly reason: string;
    }
  | {
      readonly kind: "file-carve-out";
      readonly clause: ClauseAddress;
      readonly mechanism: MechanismId;
      readonly file: RepoPath;
      readonly reason: string;
      readonly whyChain: WhyChain;
    }
  | {
      readonly kind: "clause-wide-carve-out";
      readonly clause: ClauseAddress;
      readonly mechanism: MechanismId;
      readonly reason: string;
      readonly whyChain: WhyChain;
    };

export type InvalidRecord = {
  readonly index: number;
  readonly problem:
    | { readonly kind: "clause-unparseable"; readonly detail: string }
    | { readonly kind: "clause-not-selected"; readonly clause: ClauseAddress }
    | { readonly kind: "file-not-repo-path"; readonly file: string }
    | { readonly kind: "why-chain-refused"; readonly detail: string }
    | { readonly kind: "duplicate"; readonly ofIndex: number };
};
