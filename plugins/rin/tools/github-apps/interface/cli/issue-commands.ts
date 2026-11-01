import { z } from "zod";
import type { RevisedIssue } from "../../application/github-repository-port.ts";
import { openIssue } from "../../application/open-issue.ts";
import { reviseIssue } from "../../application/revise-issue.ts";
import { succeed } from "../../domain/result.ts";
import { readOptionalBody, readRequiredBody } from "./authored-body.ts";
import type { CommandReport, RepositoryCommand } from "./cli-command.ts";
import { bodyFlags, labelsFlag, issueOrPullNumberFlag, sessionFlag } from "./command-flag-schemas.ts";
import { validateFlags } from "./command-flags.ts";
import { reportLine } from "./command-report.ts";

const openFlagsSchema = z.strictObject({
  title: z.string().min(1),
  ...bodyFlags,
  label: labelsFlag,
  session: sessionFlag.optional(),
});

const reviseFlagsSchema = z.strictObject({
  issue: issueOrPullNumberFlag,
  title: z.string().min(1).optional(),
  ...bodyFlags,
  state: z.enum(["open", "closed"]).optional(),
  "add-label": labelsFlag,
  "remove-label": labelsFlag,
  session: sessionFlag.optional(),
});

const ISSUES_ONLY = { issues: "write" } as const;

const missingLabelWarnings = (missingLabels: readonly string[]): string =>
  missingLabels.map((name) => `label "${name}" does not exist; nothing removed
`).join("");

const revisionReport = ({ url, missingLabels }: RevisedIssue): CommandReport => ({
  ...reportLine(url),
  standardError: missingLabelWarnings(missingLabels),
});

const openCommand: RepositoryCommand = {
  access: "repository",
  role: "author",
  repeatableFlags: ["label"],
  permissions: ISSUES_ONLY,
  execute: async ({ flags, dependencies, role, repositoryApi }) => {
    const openFlags = validateFlags({ flags, schema: openFlagsSchema });
    if (openFlags.kind === "failure") return openFlags;
    const { title, body: inlineBody, label, session } = openFlags.outcome;
    const authoredBody = await readRequiredBody({
      inlineBody,
      bodyFile: openFlags.outcome["body-file"],
      readBodyFile: dependencies.readBodyFile,
    });
    if (authoredBody.kind === "failure") return authoredBody;
    const opened = await openIssue({
      repositoryApi,
      role,
      title,
      authoredBody: authoredBody.outcome,
      labels: label,
      session,
    });
    if (opened.kind === "failure") return opened;
    return succeed(reportLine(opened.outcome.url));
  },
};

const reviseCommand: RepositoryCommand = {
  access: "repository",
  role: "author",
  repeatableFlags: ["add-label", "remove-label"],
  permissions: ISSUES_ONLY,
  execute: async ({ flags, dependencies, role, repositoryApi }) => {
    const reviseFlags = validateFlags({ flags, schema: reviseFlagsSchema });
    if (reviseFlags.kind === "failure") return reviseFlags;
    const { issue, title, body: inlineBody, state, session } = reviseFlags.outcome;
    const authoredBody = await readOptionalBody({
      inlineBody,
      bodyFile: reviseFlags.outcome["body-file"],
      readBodyFile: dependencies.readBodyFile,
    });
    if (authoredBody.kind === "failure") return authoredBody;
    const revised = await reviseIssue({
      repositoryApi,
      role,
      issueNumber: issue,
      title,
      authoredBody: authoredBody.outcome,
      state,
      labels: { add: reviseFlags.outcome["add-label"], remove: reviseFlags.outcome["remove-label"] },
      session,
    });
    if (revised.kind === "failure") return revised;
    return succeed(revisionReport(revised.outcome));
  },
};

const issueCommands = { issue: openCommand, "issue-edit": reviseCommand };

export { issueCommands };
