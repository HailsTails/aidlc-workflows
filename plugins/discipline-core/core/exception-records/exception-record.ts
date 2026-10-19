import type { ClauseAddress } from "../values/clause-address.ts";
import type { MechanismId } from "../values/identifiers.ts";
import type { RepoPath } from "../values/repo-path.ts";
import type { WhyChain } from "../values/why-chain.ts";

export type ExistingAuthorisationProvenance = {
  readonly kind: "existing-authorisation";
  readonly source: string;
  readonly decision?: string;
};

export type InheritedDebtProvenance = {
  readonly kind: "inherited-debt";
  readonly source: string;
  readonly decision: string;
};

export type AuthorisationEvidence =
  | { readonly whyChain: WhyChain; readonly provenance?: ExistingAuthorisationProvenance }
  | { readonly whyChain?: never; readonly provenance: ExistingAuthorisationProvenance };

export type FileDebtEvidence =
  | { readonly whyChain: WhyChain; readonly provenance?: InheritedDebtProvenance }
  | { readonly whyChain?: never; readonly provenance: InheritedDebtProvenance };

export type AuthorisedLocationEntry = AuthorisationEvidence & {
  readonly kind: "authorised-location";
  readonly clause: string;
  readonly file: string;
  readonly reason: string;
};

export type FileCarveOutEntry = FileDebtEvidence & {
  readonly kind: "file-carve-out";
  readonly clause: string;
  readonly file: string;
  readonly reason: string;
};

export type ClauseWideCarveOutEntry = {
  readonly kind: "clause-wide-carve-out";
  readonly clause: string;
  readonly reason: string;
  readonly whyChain: WhyChain;
};

export type ExceptionEntry = AuthorisedLocationEntry | FileCarveOutEntry | ClauseWideCarveOutEntry;

export type ExceptionsFile = {
  readonly version: 1;
  readonly exceptions: readonly ExceptionEntry[];
};

export type ExceptionRecord =
  | (AuthorisationEvidence & {
      readonly kind: "authorised-location";
      readonly clause: ClauseAddress;
      readonly mechanism: MechanismId;
      readonly file: RepoPath;
      readonly reason: string;
    })
  | (FileDebtEvidence & {
      readonly kind: "file-carve-out";
      readonly clause: ClauseAddress;
      readonly mechanism: MechanismId;
      readonly file: RepoPath;
      readonly reason: string;
    })
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
    | { readonly kind: "evidence-refused"; readonly detail: string }
    | { readonly kind: "import-unverified"; readonly detail: string }
    | { readonly kind: "non-exemptible-clause"; readonly clause: ClauseAddress }
    | { readonly kind: "duplicate"; readonly ofIndex: number };
};
