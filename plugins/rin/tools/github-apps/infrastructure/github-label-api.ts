import { z } from "zod";
import type { GitHubFailure } from "../application/github-failure.ts";
import type { LabelChange } from "../domain/label-change.ts";
import { fail, succeed, type Failure, type Result } from "../domain/result.ts";
import { executeGraphql } from "./github-graphql.ts";
import { missingSubject, type Located } from "./github-repository-scope.ts";

const LABEL_MUTATIONS = {
  add: { operation: "add labels", field: "addLabelsToLabelable" },
  remove: { operation: "remove labels", field: "removeLabelsFromLabelable" },
} as const;

type LabelMutation = keyof typeof LABEL_MUTATIONS;

type LabelLookup = { readonly name: string; readonly id: string | undefined };

type LabelNames = { readonly names: readonly string[] };

type ResolvedLabels = {
  readonly addIds: readonly string[];
  readonly removeIds: readonly string[];
  readonly missingLabels: readonly string[];
};

type AppliedLabels = {
  readonly labelableId: string;
  readonly labelIds: readonly string[];
  readonly mutation: LabelMutation;
};

type RelabelledSubject = {
  readonly labelableId: string;
  readonly resolved: ResolvedLabels;
};

const findLabel = async ({
  connection,
  name,
}: Located<{ readonly name: string }>): Promise<Result<LabelLookup, GitHubFailure>> => {
  const found = await executeGraphql({
    ...connection,
    operation: "find label",
    query: `query FindLabel($owner: String!, $name: String!, $labelName: String!) {
      repository(owner: $owner, name: $name) { label(name: $labelName) { id } }
    }`,
    variables: { ...connection.repository, labelName: name },
    dataSchema: z.object({
      repository: z.object({ label: z.object({ id: z.string() }).nullable() }),
    }),
  });
  if (found.kind === "failure") return found;
  return succeed({ name, id: found.outcome.repository.label?.id });
};

const isFailure = <Outcome>(
  result: Result<Outcome, GitHubFailure>,
): result is Failure<GitHubFailure> => result.kind === "failure";

const knownIds = (lookups: readonly LabelLookup[]): readonly string[] =>
  lookups.flatMap(({ id }) => (id === undefined ? [] : [id]));

const lookUpLabels = async ({
  connection,
  names,
}: Located<LabelNames>): Promise<Result<readonly LabelLookup[], GitHubFailure>> => {
  const lookups = await Promise.all(names.map((name) => findLabel({ connection, name })));
  const failed = lookups.find(isFailure);
  if (failed !== undefined) return failed;
  return succeed(lookups.flatMap((lookup) => (lookup.kind === "success" ? [lookup.outcome] : [])));
};

const requireLabelIds = async ({
  connection,
  names,
}: Located<LabelNames>): Promise<Result<readonly string[], GitHubFailure>> => {
  const lookups = await lookUpLabels({ connection, names });
  if (lookups.kind === "failure") return lookups;
  const missing = lookups.outcome.find(({ id }) => id === undefined);
  if (missing !== undefined) {
    return fail(
      missingSubject({ connection, operation: "find label", subject: `label "${missing.name}"` }),
    );
  }
  return succeed(knownIds(lookups.outcome));
};

const missingNames = (lookups: readonly LabelLookup[]): readonly string[] =>
  lookups.flatMap(({ name, id }) => (id === undefined ? [name] : []));

const resolveLabelChange = async ({
  connection,
  labels,
}: Located<{ readonly labels: LabelChange }>): Promise<Result<ResolvedLabels, GitHubFailure>> => {
  const addIds = await requireLabelIds({ connection, names: labels.add });
  if (addIds.kind === "failure") return addIds;
  const removals = await lookUpLabels({ connection, names: labels.remove });
  if (removals.kind === "failure") return removals;
  return succeed({
    addIds: addIds.outcome,
    removeIds: knownIds(removals.outcome),
    missingLabels: missingNames(removals.outcome),
  });
};

const applyLabels = async ({
  connection,
  labelableId,
  labelIds,
  mutation,
}: Located<AppliedLabels>): Promise<Result<void, GitHubFailure>> => {
  if (labelIds.length === 0) return succeed(undefined);
  const { operation, field } = LABEL_MUTATIONS[mutation];
  const applied = await executeGraphql({
    ...connection,
    operation,
    query: `mutation ChangeLabels($labelableId: ID!, $labelIds: [ID!]!) {
      ${field}(input: { labelableId: $labelableId, labelIds: $labelIds }) { clientMutationId }
    }`,
    variables: { labelableId, labelIds },
    dataSchema: z.object({ [field]: z.object({ clientMutationId: z.string().nullable() }) }),
  });
  if (applied.kind === "failure") return applied;
  return succeed(undefined);
};

const relabel = async ({
  connection,
  labelableId,
  resolved,
}: Located<RelabelledSubject>): Promise<Result<void, GitHubFailure>> => {
  const added = await applyLabels({
    connection,
    labelableId,
    labelIds: resolved.addIds,
    mutation: "add",
  });
  if (added.kind === "failure") return added;
  return applyLabels({ connection, labelableId, labelIds: resolved.removeIds, mutation: "remove" });
};

export { applyLabels, relabel, requireLabelIds, resolveLabelChange };
