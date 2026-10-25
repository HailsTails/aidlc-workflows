import { z } from "zod";
import { closePullRequest } from "../../application/close-pull-request.ts";
import { mergePullRequest } from "../../application/merge-pull-request.ts";
import { succeed } from "../../domain/result.ts";
import type { RepositoryCommand } from "./cli-command.ts";
import { pullNumberFlag } from "./command-flag-schemas.ts";
import { validateFlags } from "./command-flags.ts";
import { reportLine } from "./command-report.ts";

const mergeFlagsSchema = z.strictObject({ pr: pullNumberFlag });

const closeFlagsSchema = z.strictObject({ pr: pullNumberFlag, reason: z.string().min(1) });

const mergeCommand: RepositoryCommand = {
  access: "repository",
  role: "author",
  execute: async ({ flags, repositoryApi }) => {
    const mergeFlags = validateFlags({ flags, schema: mergeFlagsSchema });
    if (mergeFlags.kind === "failure") return mergeFlags;
    const merged = await mergePullRequest({ repositoryApi, pullNumber: mergeFlags.outcome.pr });
    if (merged.kind === "failure") return merged;
    return succeed(
      reportLine(`Squash-merged #${String(mergeFlags.outcome.pr)} as ${merged.outcome.mergeSha}`),
    );
  },
};

const closeCommand: RepositoryCommand = {
  access: "repository",
  role: "author",
  execute: async ({ flags, role, repositoryApi }) => {
    const closeFlags = validateFlags({ flags, schema: closeFlagsSchema });
    if (closeFlags.kind === "failure") return closeFlags;
    const closed = await closePullRequest({
      repositoryApi,
      role,
      pullNumber: closeFlags.outcome.pr,
      reason: closeFlags.outcome.reason,
    });
    if (closed.kind === "failure") return closed;
    return succeed(reportLine(`Closed ${closed.outcome.url} as superseded`));
  },
};

const landingCommands = { merge: mergeCommand, close: closeCommand };

export { landingCommands };
