import { z } from "zod";
import { openIssue } from "../../application/open-issue.ts";
import { reviseIssue } from "../../application/revise-issue.ts";
import { succeed } from "../../domain/result.ts";
import { readOptionalBody, readRequiredBody } from "./authored-body.ts";
import type { RepositoryCommand } from "./cli-command.ts";
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
  label: labelsFlag,
  attach: attachFlag,
  session: sessionFlag.optional(),
});

const reviseFlagsSchema = z.strictObject({
  issue: issueOrPullNumberFlag,
  title: z.string().min(1).optional(),
  ...bodyFlags,
  state: z.enum(["open", "closed"]).optional(),
  "add-label": labelsFlag,
  "remove-label": labelsFlag,
  attach: attachFlag,
  session: sessionFlag.optional(),
});

const ISSUES_ONLY = { issues: "write" } as const;

const openCommand: RepositoryCommand = {
  access: "repository",
  role: "author",
  repeatableFlags: ["label", "attach"],
  permissions: ISSUES_ONLY,
  execute: async ({ flags, dependencies, role, repositoryApi, githubCli }) => {
    const openFlags = validateFlags({ flags, schema: openFlagsSchema });
    if (openFlags.kind === "failure") return openFlags;
    const { title, body: inlineBody, label, attach, session } = openFlags.outcome;
    const authoredBody = await readRequiredBody({
      inlineBody,
      bodyFile: openFlags.outcome["body-file"],
      readBodyFile: dependencies.readBodyFile,
    });
    if (authoredBody.kind === "failure") return authoredBody;
    const opened = await openIssue({
      repositoryApi,
      githubCli,
      role,
      title,
      authoredBody: authoredBody.outcome,
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
  permissions: ISSUES_ONLY,
  execute: async ({ flags, dependencies, role, repositoryApi, githubCli }) => {
    const reviseFlags = validateFlags({ flags, schema: reviseFlagsSchema });
    if (reviseFlags.kind === "failure") return reviseFlags;
    const { issue, title, body: inlineBody, state, attach, session } = reviseFlags.outcome;
    const authoredBody = await readOptionalBody({
      inlineBody,
      bodyFile: reviseFlags.outcome["body-file"],
      readBodyFile: dependencies.readBodyFile,
    });
    if (authoredBody.kind === "failure") return authoredBody;
    const revised = await reviseIssue({
      repositoryApi,
      githubCli,
      role,
      issueNumber: issue,
      title,
      authoredBody: authoredBody.outcome,
      state,
      labels: { add: reviseFlags.outcome["add-label"], remove: reviseFlags.outcome["remove-label"] },
      attachments: attach,
      session,
    });
    if (revised.kind === "failure") return revised;
    return succeed(
      reportLabelled({ line: revised.outcome.url, missingLabels: revised.outcome.missingLabels }),
    );
  },
};

const issueCommands = { issue: openCommand, "issue-edit": reviseCommand };

export { issueCommands };
