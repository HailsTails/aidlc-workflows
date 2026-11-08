import { z } from "zod";

export type WorkflowConditions = {
  readonly pullRequestTypes: readonly string[];
  readonly jobNames: readonly string[];
  readonly jobs: readonly { readonly name: string; readonly condition: string }[];
  readonly byName: ReadonlyMap<string, string>;
};

const workflowSchema = z.object({
  on: z.record(z.string(), z.unknown()),
  jobs: z.record(z.string(), z.object({ if: z.string() })),
});
const pullRequestSchema = z.object({ types: z.array(z.string()) });

// Validate the YAML boundary without claiming that unrelated workflow fields were checked.
export function readWorkflowConditions(document: unknown): WorkflowConditions {
  const workflow = workflowSchema.parse(document);
  const pullRequest = pullRequestSchema.parse(workflow.on["pull_request"]);
  const jobs = Object.entries(workflow.jobs).map(([name, job]) => ({ name, condition: job.if }));
  return { pullRequestTypes: pullRequest.types, jobNames: jobs.map(job => job.name), jobs, byName: new Map(jobs.map(job => [job.name, job.condition])) };
}

export type PullRequestState = "draft" | "ready";
export type WorkflowRunState = "active" | "cancelled";

// These are external GitHub wire keys, not internal identifiers. Non-PR events have no PR payload.
export function githubEventContext({ eventName, headBranch, pullRequestState }: { readonly eventName: string; readonly headBranch: string; readonly pullRequestState: PullRequestState }): Readonly<Record<string, unknown>> {
  const pullRequest = Object.fromEntries([["pull_request", { draft: pullRequestState === "draft" }]]);
  return Object.fromEntries([
    ["event_name", eventName],
    ["head_ref", eventName === "pull_request" ? headBranch : ""],
    ["event", eventName === "pull_request" ? pullRequest : {}],
  ]);
}

// This executes only the JS-compatible subset used by trusted checked-in conditions.
// It is not a general Actions interpreter or a sandbox for untrusted expressions.
export function evaluateWorkflowCondition({ condition, github, runState }: { readonly condition: unknown; readonly github: Readonly<Record<string, unknown>>; readonly runState: WorkflowRunState }): unknown {
  const expression = z.string().parse(condition).trim().replace(/^\$\{\{\s*([\s\S]*?)\s*\}\}$/, "$1");
  const evaluate = new Function("github", "cancelled", "contains", "fromJSON", `return (${expression});`);
  const contains = (entries: readonly string[], entry: string) => entries.includes(entry);
  return evaluate(github, () => runState === "cancelled", contains, JSON.parse);
}
