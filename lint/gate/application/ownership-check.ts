import type { BaseRevision, ChangedFile } from "../domain/change.ts";
import { judgeDeletion } from "../domain/deletion.ts";
import { grantsWholeFile, judgeJsonGrant } from "../domain/json-grant.ts";
import type { DeletionGrant, HotFileGrant, Lane, LanePlan } from "../domain/lane-plan.ts";
import { judged, skipped, type Finding } from "../domain/outcome.ts";
import { claimFor, refusalFor, type Claim } from "../domain/ownership.ts";
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

type Versions = {
  readonly before: string | undefined;
  readonly after: string | undefined;
};

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

const findingsFor = (request: {
  readonly evidence: Evidence;
  readonly lane: Lane;
  readonly claim: Claim;
}): readonly Finding[] => {
  const { evidence, lane, claim } = request;
  if (claim.kind === "deletion") {
    return deletionFindings(evidence, claim.grant);
  }
  if (claim.kind === "hot-grant") {
    return grantFindings(evidence, claim.grant);
  }
  const claimRequest = { plan: evidence.dependencies.plan, lane, path: evidence.change.path };
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
    const shared = { records: dependencies.sharedRecords };
    const findings = scope.changes.flatMap((change) => {
      const claim = claimFor({ plan: dependencies.plan, lane, path: change.path }, shared);
      return findingsFor({ evidence: { dependencies, base, change }, lane, claim });
    });
    const note = `${scope.changes.length} changed files against ${base.ref}, lane ${lane.id}`;
    return judged({ id: "ownership", findings, note });
  },
});
