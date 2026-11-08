import type { Owner, ScopeName, StageSlug } from "./identities.ts";
import type { MethodSourcePath } from "./method-source.ts";
import type { CeremonyDefaults, Depth, GuardPolicy, ReviewClass } from "./vocabulary.ts";

export type Scope = {
  readonly name: ScopeName;
  readonly source: MethodSourcePath;
  readonly owner: Owner;
  readonly description: string;
  readonly keywords: readonly string[];
  readonly depth: Depth;
  readonly testStrategy: string | null;
  readonly runner: "generated" | "none";
  readonly skeleton: "walking-skeleton" | "none";
  readonly codebase: "existing" | "new";
  readonly guardPolicy: GuardPolicy;
  readonly ceremony: CeremonyDefaults;
  readonly reviewCap: ReviewClass | null;
  readonly guidance: string;
};

export type ScopeMembership = {
  readonly scope: ScopeName;
  readonly stage: StageSlug;
  readonly declaredBy: Owner;
};

export type FreeformDefaultClaim = {
  readonly scope: ScopeName;
  readonly declaredBy: Owner;
};

export type SavedScope = {
  readonly scope: Scope;
  readonly memberships: readonly ScopeMembership[];
};
