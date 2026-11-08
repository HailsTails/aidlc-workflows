import { globMatcher } from "./glob.ts";
import type { DeletionGrant, HotFileGrant, Lane, LanePlan } from "./lane-plan.ts";
import type { Finding } from "./outcome.ts";

export type Claim =
  | { readonly kind: "owned" }
  | { readonly kind: "shared-record" }
  | { readonly kind: "deletion"; readonly grant: DeletionGrant }
  | { readonly kind: "hot-grant"; readonly grant: HotFileGrant }
  | { readonly kind: "hot-refused" }
  | { readonly kind: "foreign" };

export type ClaimRequest = {
  readonly plan: LanePlan;
  readonly lane: Lane;
  readonly path: string;
};

export type SharedPaths = {
  readonly records: readonly string[];
};

const ownsByGlob = (lane: Lane, path: string): boolean =>
  globMatcher(lane.owns)(path) && !globMatcher(lane.notOwned)(path);

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

const ordinaryClaim = (request: ClaimRequest, shared: SharedPaths): Claim => {
  if (ownsByGlob(request.lane, request.path)) {
    return { kind: "owned" };
  }
  const isRecord = globMatcher(shared.records)(request.path);
  return deletionClaim(request) ?? (isRecord ? { kind: "shared-record" } : { kind: "foreign" });
};

export const claimFor = (request: ClaimRequest, shared: SharedPaths): Claim =>
  globMatcher(request.plan.hotFiles)(request.path)
    ? hotFileClaim(request)
    : ordinaryClaim(request, shared);

export const refusalFor = (request: ClaimRequest, claim: Claim): Finding | undefined => {
  const { lane, path } = request;
  if (claim.kind === "hot-refused") {
    return {
      subject: path,
      violation: `is a hot file, and lane ${lane.id} has no deletion or grant for it in lanes.json`,
      fix:
        "Hot files change only by deleting the declarations lanes.json lists for your lane. " +
        "Revert this edit and ask on the board for the integration lane to make it.",
    };
  }
  if (claim.kind === "foreign") {
    return {
      subject: path,
      violation: `is outside lane ${lane.id} (${lane.name}), which owns ${lane.owns.join(", ")}`,
      fix:
        "Keep the change inside your lane's paths. If the work belongs elsewhere, ask its " +
        "owning lane on the board; if a contract must change, ask Lane 0.",
    };
  }
  return undefined;
};
