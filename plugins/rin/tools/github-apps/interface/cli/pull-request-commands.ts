import { z } from "zod";
import { changeReadiness } from "../../application/change-readiness.ts";
import { openPullRequest } from "../../application/open-pull-request.ts";
import { revisePullRequest } from "../../application/revise-pull-request.ts";
import type { PullRequestReadiness } from "../../domain/pull-request.ts";
import { succeed } from "../../domain/result.ts";
import { readOptionalBody, readRequiredBody } from "./authored-body.ts";
import type { RepositoryCommand, RepositoryCommandContext } from "./cli-command.ts";
import {
  attachFlag,
  bodyFlags,
  issueOrPullNumberFlag,
  labelsFlag,
  sessionFlag,
} from "./command-flag-schemas.ts";
import { validateFlags } from "./command-flags.ts";
import { reportLabelled, reportLine } from "./command-report.ts";

const openFlagsSchema = z.strictObject({
  title: z.string().min(1),
  ...bodyFlags,
  base: z.string().min(1).optional(),
  head: z.string().min(1).optional(),
  draft: z.literal(true).optional(),
  label: labelsFlag,
  attach: attachFlag,
  session: sessionFlag.optional(),
});

const reviseFlagsSchema = z.strictObject({
  pr: issueOrPullNumberFlag,
  title: z.string().min(1).optional(),
  ...bodyFlags,
  "add-label": labelsFlag,
  "remove-label": labelsFlag,
  attach: attachFlag,
  session: sessionFlag.optional(),
});

const readinessFlagsSchema = z.strictObject({ pr: issueOrPullNumberFlag });

const openCommand: RepositoryCommand = {
  access: "repository",
  role: "author",
  repeatableFlags: ["label", "attach"],
  execute: async ({ flags, configuration, dependencies, role, repositoryApi, githubCli }) => {
    const openFlags = validateFlags({ flags, schema: openFlagsSchema });
    if (openFlags.kind === "failure") return openFlags;
    const { title, body: inlineBody, base, head, draft, label, attach, session } = openFlags.outcome;
    const authoredBody = await readRequiredBody({
      inlineBody,
      bodyFile: openFlags.outcome["body-file"],
      readBodyFile: dependencies.readBodyFile,
    });
    if (authoredBody.kind === "failure") return authoredBody;
    const opened = await openPullRequest({
      repositoryApi,
      githubCli,
      worktree: dependencies.worktree,
      role,
      title,
      authoredBody: authoredBody.outcome,
      base: base ?? configuration.baseBranch,
      head,
      readiness: draft === undefined ? "ready-for-review" : "draft",
      labels: label,
      attachments: attach,
      session,
    });
    if (opened.kind === "failure") return opened;
    return succeed(reportLine(opened.outcome.url));
  },
};

const reviseCommand: RepositoryCommand = {
  access: "repository",
  role: "author",
  repeatableFlags: ["add-label", "remove-label", "attach"],
  execute: async ({ flags, dependencies, role, repositoryApi, githubCli }) => {
    const reviseFlags = validateFlags({ flags, schema: reviseFlagsSchema });
    if (reviseFlags.kind === "failure") return reviseFlags;
    const { pr, title, body: inlineBody, attach, session } = reviseFlags.outcome;
    const authoredBody = await readOptionalBody({
      inlineBody,
      bodyFile: reviseFlags.outcome["body-file"],
      readBodyFile: dependencies.readBodyFile,
    });
    if (authoredBody.kind === "failure") return authoredBody;
    const revised = await revisePullRequest({
      repositoryApi,
      githubCli,
      role,
      pullNumber: pr,
      title,
      authoredBody: authoredBody.outcome,
      labels: { add: reviseFlags.outcome["add-label"], remove: reviseFlags.outcome["remove-label"] },
      attachments: attach,
      session,
    });
    if (revised.kind === "failure") return revised;
    return succeed(
      reportLabelled({
        line: `Revised ${revised.outcome.url}`,
        missingLabels: revised.outcome.missingLabels,
      }),
    );
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
