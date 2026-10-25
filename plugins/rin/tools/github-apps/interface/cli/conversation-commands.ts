import { z } from "zod";
import { commentOnIssue } from "../../application/comment-on-issue.ts";
import { submitReview } from "../../application/submit-review.ts";
import { succeed } from "../../domain/result.ts";
import { readRequiredBody } from "./authored-body.ts";
import type { RepositoryCommand } from "./cli-command.ts";
import { bodyFlags, pullNumberFlag, sessionFlag } from "./command-flag-schemas.ts";
import { validateFlags } from "./command-flags.ts";
import { reportLine } from "./command-report.ts";

const reviewFlagsSchema = z.strictObject({
  pr: pullNumberFlag,
  event: z.enum(["approve", "request-changes", "comment"]),
  "commit-sha": z
    .string()
    .regex(/^[0-9a-f]{40}$/)
    .optional(),
  ...bodyFlags,
  session: sessionFlag.optional(),
});

const commentFlagsSchema = z.strictObject({
  target: pullNumberFlag,
  ...bodyFlags,
  session: sessionFlag.optional(),
});

const reviewCommand: RepositoryCommand = {
  access: "repository",
  role: "reviewer",
  execute: async ({ flags, dependencies, role, repositoryApi }) => {
    const reviewFlags = validateFlags({ flags, schema: reviewFlagsSchema });
    if (reviewFlags.kind === "failure") return reviewFlags;
    const { pr, event, body: inlineBody, session } = reviewFlags.outcome;
    const authoredBody = await readRequiredBody({
      inlineBody,
      bodyFile: reviewFlags.outcome["body-file"],
      readBodyFile: dependencies.readBodyFile,
    });
    if (authoredBody.kind === "failure") return authoredBody;
    const reviewed = await submitReview({
      repositoryApi,
      role,
      pullNumber: pr,
      event,
      reviewedSha: reviewFlags.outcome["commit-sha"],
      authoredBody: authoredBody.outcome,
      session,
    });
    if (reviewed.kind === "failure") return reviewed;
    return succeed(reportLine(`Reviewed #${String(pr)} (${event}): ${reviewed.outcome.url}`));
  },
};

const commentCommand: RepositoryCommand = {
  access: "repository",
  role: "author",
  execute: async ({ flags, dependencies, role, repositoryApi }) => {
    const commentFlags = validateFlags({ flags, schema: commentFlagsSchema });
    if (commentFlags.kind === "failure") return commentFlags;
    const { target, body: inlineBody, session } = commentFlags.outcome;
    const authoredBody = await readRequiredBody({
      inlineBody,
      bodyFile: commentFlags.outcome["body-file"],
      readBodyFile: dependencies.readBodyFile,
    });
    if (authoredBody.kind === "failure") return authoredBody;
    const commented = await commentOnIssue({
      repositoryApi,
      role,
      issueNumber: target,
      authoredBody: authoredBody.outcome,
      session,
    });
    if (commented.kind === "failure") return commented;
    return succeed(reportLine(commented.outcome.url));
  },
};

const conversationCommands = { review: reviewCommand, comment: commentCommand };

export { conversationCommands };
