import type { LabelChange } from "../domain/label-change.ts";
import type { Result } from "../domain/result.ts";
import type {
  IssueComment,
  IssueProposal,
  PublishedLink,
  PullRequestProposal,
} from "./github-repository-port.ts";

type Attached<Write> = Write & { readonly attachments: readonly string[] };

type PullRequestEdit = {
  readonly pullNumber: number;
  readonly title: string | undefined;
  readonly body: string | undefined;
  readonly labels: LabelChange;
};

type IssueEdit = {
  readonly issueNumber: number;
  readonly title: string | undefined;
  readonly body: string | undefined;
  readonly labels: LabelChange;
};

type GitHubCliFailure = {
  readonly kind: "gh-command-failed";
  readonly command: string;
  readonly detail: string;
  readonly publishedUrl: string | undefined;
};

type GitHubCliWrite = Promise<Result<PublishedLink, GitHubCliFailure>>;

type GitHubCliPort = {
  readonly openPullRequest: (proposal: Attached<PullRequestProposal>) => GitHubCliWrite;
  readonly revisePullRequest: (edit: Attached<PullRequestEdit>) => GitHubCliWrite;
  readonly commentOnIssue: (comment: Attached<IssueComment>) => GitHubCliWrite;
  readonly openIssue: (proposal: Attached<IssueProposal>) => GitHubCliWrite;
  readonly reviseIssue: (edit: Attached<IssueEdit>) => GitHubCliWrite;
};

export type { Attached, GitHubCliFailure, GitHubCliPort, IssueEdit, PullRequestEdit };
