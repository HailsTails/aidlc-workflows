import { z } from "zod";
import type { GitHubFailure } from "../application/github-failure.ts";
import type {
  IssueProposal,
  IssueRevision,
  PublishedLink,
  RevisedLabelable,
} from "../application/github-repository-port.ts";
import type { IssueState } from "../domain/issue.ts";
import { fail, succeed, type Result } from "../domain/result.ts";
import { executeGraphql } from "./github-graphql.ts";
import { relabel, requireLabelIds, resolveLabelChange } from "./github-label-api.ts";
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

type IssueNode = { readonly id: string; readonly url: string };

type IssueFields = Pick<IssueRevision, "title" | "body" | "state"> & { readonly issueId: string };

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

const reviseIssue = async ({
  connection,
  issueNumber,
  labels,
  ...fields
}: Located<IssueRevision>): Promise<Result<RevisedLabelable, GitHubFailure>> => {
  const issue = await readIssue({ connection, issueNumber });
  if (issue.kind === "failure") return issue;
  const resolved = await resolveLabelChange({ connection, labels });
  if (resolved.kind === "failure") return resolved;
  const { id: issueId, url } = issue.outcome;
  const updated = await updateIssueFields({ connection, issueId, ...fields });
  if (updated.kind === "failure") return updated;
  const relabelled = await relabel({ connection, labelableId: issueId, resolved: resolved.outcome });
  if (relabelled.kind === "failure") return relabelled;
  return succeed({ url, missingLabels: resolved.outcome.missingLabels });
};

export { openIssue, reviseIssue };
