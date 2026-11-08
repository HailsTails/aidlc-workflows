import { globMatcher } from "./glob.ts";
import type { DeletionGrant, HotFileGrant, Lane, LanePlan } from "./lane-plan.ts";
import type { Finding } from "./outcome.ts";

export type Claim =
  | { readonly kind: "owned" }
  | { readonly kind: "shared-record" }
  | { readonly kind: "deletion"; readonly grant: DeletionGrant }
  | { readonly kind: "hot-grant"; readonly grant: HotFileGrant }
  | { readonly kind: "caller-move" }
  | { readonly kind: "hot-refused" }
  | { readonly kind: "contract-refused" }
  | { readonly kind: "foreign" };

export type ClaimRequest = {
  readonly plan: LanePlan;
  readonly lane: Lane;
  readonly path: string;
};

export type SharedPaths = {
  readonly records: readonly string[];
};

const SRC_ROOT = "src/";

const ownsByGlob = (lane: Lane, path: string): boolean =>
  globMatcher([...lane.owns, ...lane.territory])(path) && !globMatcher(lane.notOwned)(path);

const isForeignContract = (request: ClaimRequest): boolean =>
  request.plan.contracts.some(
    (contract) =>
      contract.writer !== request.lane.id && globMatcher(contract.files)(request.path),
  );

export const isTerritory = (lane: Lane, path: string): boolean =>
  globMatcher(lane.territory)(path);

const hotGrantClaim = (request: ClaimRequest): Claim | undefined => {
  const { lane, path } = request;
  if (lane.owns.includes(path)) {
    return { kind: "owned" };
  }
  const grant = lane.hotFileGrants.find((candidate) => candidate.path === path);
  return grant === undefined ? undefined : { kind: "hot-grant", grant };
};

const deletionClaim = (request: ClaimRequest): Claim | undefined => {
  const grant = request.lane.deletions.find((candidate) =>
    globMatcher([candidate.pattern])(request.path),
  );
  return grant === undefined ? undefined : { kind: "deletion", grant };
};

const hotFileClaim = (request: ClaimRequest): Claim =>
  hotGrantClaim(request) ?? deletionClaim(request) ?? { kind: "hot-refused" };

const unownedClaim = (request: ClaimRequest, shared: SharedPaths): Claim => {
  if (globMatcher(shared.records)(request.path)) {
    return { kind: "shared-record" };
  }
  return request.path.startsWith(SRC_ROOT) ? { kind: "foreign" } : { kind: "caller-move" };
};

const ordinaryClaim = (request: ClaimRequest, shared: SharedPaths): Claim => {
  if (isForeignContract(request)) {
    return { kind: "contract-refused" };
  }
  if (ownsByGlob(request.lane, request.path)) {
    return { kind: "owned" };
  }
  return deletionClaim(request) ?? unownedClaim(request, shared);
};

export const claimFor = (request: ClaimRequest, shared: SharedPaths): Claim =>
  globMatcher(request.plan.hotFiles)(request.path)
    ? hotFileClaim(request)
    : ordinaryClaim(request, shared);

const hotRefusal = (request: ClaimRequest): Finding => ({
  subject: request.path,
  violation: `is a hot file, and lane ${request.lane.id} has no deletion or grant for it`,
  fix:
    "Revert this edit. Put the new code in your context under src/ and point callers " +
    "at it; a hot file only loses the declarations lanes.json lists for your lane.",
});

const contractRefusal = (request: ClaimRequest): Finding => ({
  subject: request.path,
  violation: "is a published contract, which only the contract lane writes",
  fix:
    "Revert it and adapt inside your own context: translate at your boundary, or request " +
    "the cross-arrow change by naming the design move it needs.",
});

export const foreignRefusal = (request: ClaimRequest): Finding => ({
  subject: request.path,
  violation: `is outside lane ${request.lane.id} (${request.lane.name}) and its territory`,
  fix:
    "Revert it and make the change inside your own context: depend on the other " +
    "context's published domain types or a port, never edit its files.",
});

export const refusalFor = (request: ClaimRequest, claim: Claim): Finding | undefined => {
  const refusals: Partial<Record<Claim["kind"], (r: ClaimRequest) => Finding>> = {
    "hot-refused": hotRefusal,
    "contract-refused": contractRefusal,
    foreign: foreignRefusal,
  };
  return refusals[claim.kind]?.(request);
};
