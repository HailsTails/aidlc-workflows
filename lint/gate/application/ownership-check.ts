import { judgeCallerMove, lineChanges } from "../domain/caller-move.ts";
import type { BaseRevision, ChangedFile } from "../domain/change.ts";
import { judgeDeletion, removedDeclarations } from "../domain/deletion.ts";
import { grantsWholeFile, judgeJsonGrant } from "../domain/json-grant.ts";
import type { DeletionGrant, HotFileGrant, Lane, LanePlan } from "../domain/lane-plan.ts";
import { judged, skipped, type Finding } from "../domain/outcome.ts";
import {
  claimFor,
  foreignRefusal,
  isTerritory,
  refusalFor,
  type Claim,
} from "../domain/ownership.ts";
import { scopeLaneId } from "./gate-scope.ts";
import type { GateCheck } from "./gate-check.ts";
import type { JsonReader, ModuleReader, Repository, Workspace } from "./ports.ts";

export type OwnershipDependencies = {
  readonly plan: LanePlan;
  readonly repository: Repository;
  readonly workspace: Workspace;
  readonly modules: ModuleReader;
  readonly json: JsonReader;
  readonly sharedRecords: readonly string[];
};

type Evidence = {
  readonly dependencies: OwnershipDependencies;
  readonly base: BaseRevision;
  readonly change: ChangedFile;
};

type ClaimedChange = {
  readonly evidence: Evidence;
  readonly claim: Claim;
};

type Versions = {
  readonly before: string | undefined;
  readonly after: string | undefined;
};

const TYPESCRIPT = /\.[cm]?tsx?$/;

const versions = (evidence: Evidence): Versions => {
  const { repository, workspace } = evidence.dependencies;
  const { path } = evidence.change;
  return {
    before: repository.readAt({ commit: evidence.base.commit, path }),
    after: evidence.change.kind === "deleted" ? undefined : workspace.read(path),
  };
};

const addedUnderDeletionGrant = (path: string): Finding => ({
  subject: path,
  violation: "is a new file where the lane may only delete declarations",
  fix: "Create new code in your context under src/, never next to the monolith it replaces.",
});

const deletionFindings = (evidence: Evidence, grant: DeletionGrant): readonly Finding[] => {
  const { before, after } = versions(evidence);
  const { path } = evidence.change;
  if (before === undefined) {
    return [addedUnderDeletionGrant(path)];
  }
  const { modules } = evidence.dependencies;
  const head = after === undefined ? undefined : modules.shapeOf({ path, text: after });
  return judgeDeletion({ path, grant, base: modules.shapeOf({ path, text: before }), head });
};

const unreadableJson = (path: string): Finding => ({
  subject: path,
  violation: "is not valid JSON, so the granted keys cannot be checked",
  fix: "Restore valid JSON; the grant names JSON keys, so the file must parse.",
});

const grantFindings = (evidence: Evidence, grant: HotFileGrant): readonly Finding[] => {
  if (grantsWholeFile(grant)) {
    return [];
  }
  const { before, after } = versions(evidence);
  const { json } = evidence.dependencies;
  const base = before === undefined ? {} : json.parse(before);
  const head = after === undefined ? {} : json.parse(after);
  return base === undefined || head === undefined
    ? [unreadableJson(evidence.change.path)]
    : judgeJsonGrant({ grant, base, head });
};

const deletesLegacy = (lane: Lane, claimed: ClaimedChange): boolean =>
  TYPESCRIPT.test(claimed.evidence.change.path) &&
  (claimed.claim.kind === "deletion" ||
    (claimed.claim.kind === "owned" && isTerritory(lane, claimed.evidence.change.path)));

const deletedNames = (claimed: ClaimedChange): readonly string[] => {
  const { before, after } = versions(claimed.evidence);
  if (before === undefined) {
    return [];
  }
  const { modules } = claimed.evidence.dependencies;
  const { path } = claimed.evidence.change;
  const head = modules.shapeOf({ path, text: after ?? "" });
  return removedDeclarations(modules.shapeOf({ path, text: before }), head);
};

const movedNamesOf = (lane: Lane, claims: readonly ClaimedChange[]): ReadonlySet<string> =>
  new Set(claims.filter((claimed) => deletesLegacy(lane, claimed)).flatMap(deletedNames));

type Judgement = {
  readonly claimed: ClaimedChange;
  readonly lane: Lane;
  readonly movedNames: ReadonlySet<string>;
};

const callerMoveFindings = (judgement: Judgement): readonly Finding[] => {
  const { evidence } = judgement.claimed;
  const { path } = evidence.change;
  if (judgement.movedNames.size === 0) {
    return [foreignRefusal({ plan: evidence.dependencies.plan, lane: judgement.lane, path })];
  }
  const lines = lineChanges(versions(evidence));
  return judgeCallerMove({ path, lines, movedNames: judgement.movedNames });
};

const findingsFor = (judgement: Judgement): readonly Finding[] => {
  const { evidence, claim } = judgement.claimed;
  if (claim.kind === "deletion") {
    return deletionFindings(evidence, claim.grant);
  }
  if (claim.kind === "hot-grant") {
    return grantFindings(evidence, claim.grant);
  }
  if (claim.kind === "caller-move") {
    return callerMoveFindings(judgement);
  }
  const claimRequest = {
    plan: evidence.dependencies.plan,
    lane: judgement.lane,
    path: evidence.change.path,
  };
  const refusal = refusalFor(claimRequest, claim);
  return refusal === undefined ? [] : [refusal];
};

export const ownershipCheck = (dependencies: OwnershipDependencies): GateCheck => ({
  id: "ownership",
  run: async (scope) => {
    const { lane, base } = scope;
    if (lane === undefined || base === undefined) {
      return skipped("ownership", "no lane named; pass --scope <lane-id> or --full --lane <id>");
    }
    const lanes = scope.lanes ?? [lane];
    const perLane = lanes.map((owner) => {
      const shared = { records: dependencies.sharedRecords };
      const claims = scope.changes.map((change) => ({
        evidence: { dependencies, base, change },
        claim: claimFor({ plan: dependencies.plan, lane: owner, path: change.path }, shared),
      }));
      const movedNames = movedNamesOf(owner, claims);
      return claims.map((claimed) => findingsFor({ claimed, lane: owner, movedNames }));
    });
    const findings = scope.changes.flatMap((_, index) => {
      const refusals = perLane.map((results) => results[index] ?? []);
      return refusals.some((result) => result.length === 0) ? [] : refusals.flat();
    });
    const identity = scopeLaneId(scope);
    const note = `${scope.changes.length} changed files against ${base.ref}, lane ${identity}`;
    return judged({ id: "ownership", findings, note });
  },
});
