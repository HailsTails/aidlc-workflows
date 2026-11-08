import type { Owner, ScopeName, StageSlug } from "./identities.ts";
import type { CeremonyDefaults, Depth, GuardPolicy, ReviewClass } from "./vocabulary.ts";

export type Scope = {
  readonly name: ScopeName;
  readonly owner: Owner;
  readonly description: string;
  readonly keywords: readonly string[];
  readonly depth: Depth;
  readonly testStrategy: string | null;
  readonly runner: boolean;
  readonly skeleton: boolean;
  readonly existingCode: boolean;
  readonly freeformDefault: boolean;
  readonly guardPolicy: GuardPolicy;
  readonly ceremony: CeremonyDefaults;
  readonly reviewCap: ReviewClass | null;
  readonly includedStages: readonly StageSlug[];
  readonly guidance: string;
};
