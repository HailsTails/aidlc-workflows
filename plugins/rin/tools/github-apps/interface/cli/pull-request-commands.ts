import { z } from "zod";
import { changeReadiness } from "../../application/change-readiness.ts";
import { openPullRequest } from "../../application/open-pull-request.ts";
import { revisePullRequest } from "../../application/revise-pull-request.ts";
import type { PullRequestReadiness } from "../../domain/pull-request.ts";
import { succeed } from "../../domain/result.ts";
import { readOptionalBody, readRequiredBody } from "./authored-body.ts";
import type { RepositoryCommand, RepositoryCommandContext } from "./cli-command.ts";
import { bodyFlags, pullNumberFlag, sessionFlag } from "./command-flag-schemas.ts";
import { validateFlags } from "./command-flags.ts";
import { reportLine } from "./command-report.ts";

const openFlagsSchema = z.strictObject({
  title: z.string().min(1),
  ...bodyFlags,
  base: z.string().min(1).optional(),
  head: z.string().min(1).optional(),
  draft: z.literal(true).optional(),
  session: sessionFlag.optional(),
});

const reviseFlagsSchema = z.strictObject({
  pr: pullNumberFlag,
  title: z.string().min(1).optional(),
  ...bodyFlags,
  session: sessionFlag.optional(),
});

const readinessFlagsSchema = z.strictObject({ pr: pullNumberFlag });

const openCommand: RepositoryCommand = {
  access: "repository",
  role: "author",
  execute: async ({ flags, configuration, dependencies, role, repositoryApi }) => {
    const openFlags = validateFlags({ flags, schema: openFlagsSchema });
    if (openFlags.kind === "failure") return openFlags;
    const { title, body: inlineBody, base, head, draft, session } = openFlags.outcome;
    const authoredBody = await readRequiredBody({
      inlineBody,
      bodyFile: openFlags.outcome["body-file"],
      readBodyFile: dependencies.readBodyFile,
    });
    if (authoredBody.kind === "failure") return authoredBody;
    const opened = await openPullRequest({
      repositoryApi,
      worktree: dependencies.worktree,
      role,
      title,
      authoredBody: authoredBody.outcome,
      base: base ?? configuration.baseBranch,
      head,
      readiness: draft === undefined ? "ready-for-review" : "draft",
      session,
    });
    if (opened.kind === "failure") return opened;
    return succeed(reportLine(opened.outcome.url));
  },
};

const reviseCommand: RepositoryCommand = {
  access: "repository",
  role: "author",
  execute: async ({ flags, dependencies, role, repositoryApi }) => {
    const reviseFlags = validateFlags({ flags, schema: reviseFlagsSchema });
    if (reviseFlags.kind === "failure") return reviseFlags;
    const { pr, title, body: inlineBody, session } = reviseFlags.outcome;
    const authoredBody = await readOptionalBody({
      inlineBody,
      bodyFile: reviseFlags.outcome["body-file"],
      readBodyFile: dependencies.readBodyFile,
    });
    if (authoredBody.kind === "failure") return authoredBody;
    const revised = await revisePullRequest({
      repositoryApi,
      role,
      pullNumber: pr,
      title,
      authoredBody: authoredBody.outcome,
      session,
    });
    if (revised.kind === "failure") return revised;
    return succeed(reportLine(`Revised ${revised.outcome.url}`));
  },
};

const readinessCommand = (readiness: PullRequestReadiness): RepositoryCommand => ({
  access: "repository",
  role: "author",
  execute: async ({ flags, repositoryApi }: RepositoryCommandContext) => {
    const readinessFlags = validateFlags({ flags, schema: readinessFlagsSchema });
    if (readinessFlags.kind === "failure") return readinessFlags;
    const changed = await changeReadiness({
      repositoryApi,
      pullNumber: readinessFlags.outcome.pr,
      readiness,
    });
    if (changed.kind === "failure") return changed;
    return succeed(reportLine(`#${String(readinessFlags.outcome.pr)} is now ${changed.outcome}`));
  },
});

const pullRequestCommands = {
  pr: openCommand,
  "pr-edit": reviseCommand,
  draft: readinessCommand("draft"),
  ready: readinessCommand("ready-for-review"),
};

export { pullRequestCommands };
