import { z } from "zod";
import type { GitHubFailure } from "../application/github-failure.ts";
import type {
  IssueProposal,
  IssueRevision,
  PublishedLink,
  RevisedIssue,
} from "../application/github-repository-port.ts";
import type { IssueState } from "../domain/issue.ts";
import { fail, succeed, type Failure, type Result } from "../domain/result.ts";
import { executeGraphql } from "./github-graphql.ts";
import {
  linkSchema,
  missingSubject,
  readRepositoryId,
  type Located,
} from "./github-repository-scope.ts";

const GRAPHQL_ISSUE_STATES: { readonly [State in IssueState]: "OPEN" | "CLOSED" } = {
  open: "OPEN",
  closed: "CLOSED",
};

const LABEL_MUTATIONS = {
  add: { operation: "add labels", field: "addLabelsToLabelable" },
  remove: { operation: "remove labels", field: "removeLabelsFromLabelable" },
} as const;

type LabelMutation = keyof typeof LABEL_MUTATIONS;

type LabelLookup = { readonly name: string; readonly id: string | undefined };

type LabelNames = { readonly names: readonly string[] };

type IssueNode = { readonly id: string; readonly url: string };

type IssueFields = Pick<IssueRevision, "title" | "body" | "state"> & { readonly issueId: string };

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
}: Located<Pick<IssueRevision, "labels">>): Promise<Result<ResolvedLabels, GitHubFailure>> => {
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

const openIssue = async ({
  connection,
  title,
  body: issueBody,
  labels,
}: Located<IssueProposal>): Promise<Result<PublishedLink, GitHubFailure>> => {
  const repositoryId = await readRepositoryId({ connection });
  if (repositoryId.kind === "failure") return repositoryId;
  const labelIds = await requireLabelIds({ connection, names: labels });
  if (labelIds.kind === "failure") return labelIds;
  const opened = await executeGraphql({
    ...connection,
    operation: "open issue",
    query: `mutation OpenIssue($repositoryId: ID!, $title: String!, $body: String!, $labelIds: [ID!]) {
      createIssue(input: { repositoryId: $repositoryId, title: $title, body: $body, labelIds: $labelIds }) { issue { url } }
    }`,
    variables: { repositoryId: repositoryId.outcome, title, body: issueBody, labelIds: labelIds.outcome },
    dataSchema: z.object({ createIssue: z.object({ issue: linkSchema }) }),
  });
  if (opened.kind === "failure") return opened;
  return succeed(opened.outcome.createIssue.issue);
};

const readIssue = async ({
  connection,
  issueNumber,
}: Located<Pick<IssueRevision, "issueNumber">>): Promise<Result<IssueNode, GitHubFailure>> => {
  const found = await executeGraphql({
    ...connection,
    operation: "find issue",
    query: `query FindIssue($owner: String!, $name: String!, $number: Int!) {
      repository(owner: $owner, name: $name) { issue(number: $number) { id url } }
    }`,
    variables: { ...connection.repository, number: issueNumber },
    dataSchema: z.object({
      repository: z.object({ issue: z.object({ id: z.string(), url: z.string() }).nullable() }),
    }),
  });
  if (found.kind === "failure") return found;
  const { issue } = found.outcome.repository;
  if (issue === null) {
    return fail(
      missingSubject({ connection, operation: "find issue", subject: `#${String(issueNumber)}` }),
    );
  }
  return succeed(issue);
};

const updateIssueFields = async ({
  connection,
  issueId,
  title,
  body: issueBody,
  state,
}: Located<IssueFields>): Promise<Result<void, GitHubFailure>> => {
  if (title === undefined && issueBody === undefined && state === undefined) {
    return succeed(undefined);
  }
  const updated = await executeGraphql({
    ...connection,
    operation: "revise issue",
    query: `mutation ReviseIssue($issueId: ID!, $title: String, $body: String, $state: IssueState) {
      updateIssue(input: { id: $issueId, title: $title, body: $body, state: $state }) { issue { url } }
    }`,
    variables: {
      issueId,
      title,
      body: issueBody,
      state: state === undefined ? undefined : GRAPHQL_ISSUE_STATES[state],
    },
    dataSchema: z.object({ updateIssue: z.object({ issue: linkSchema }) }),
  });
  if (updated.kind === "failure") return updated;
  return succeed(undefined);
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

const reviseIssue = async ({
  connection,
  issueNumber,
  labels,
  ...fields
}: Located<IssueRevision>): Promise<Result<RevisedIssue, GitHubFailure>> => {
  const issue = await readIssue({ connection, issueNumber });
  if (issue.kind === "failure") return issue;
  const resolved = await resolveLabelChange({ connection, labels });
  if (resolved.kind === "failure") return resolved;
  const { id: issueId, url } = issue.outcome;
  const { addIds, removeIds, missingLabels } = resolved.outcome;
  const updated = await updateIssueFields({ connection, issueId, ...fields });
  if (updated.kind === "failure") return updated;
  const added = await applyLabels({ connection, labelableId: issueId, labelIds: addIds, mutation: "add" });
  if (added.kind === "failure") return added;
  const removed = await applyLabels({
    connection,
    labelableId: issueId,
    labelIds: removeIds,
    mutation: "remove",
  });
  if (removed.kind === "failure") return removed;
  return succeed({ url, missingLabels });
};

export { openIssue, reviseIssue };
