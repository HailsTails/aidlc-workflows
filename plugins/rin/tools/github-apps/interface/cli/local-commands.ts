import { z } from "zod";
import { adoptWorktreeGitIdentity } from "../../application/adopt-worktree-git-identity.ts";
import { issueGitCredential } from "../../application/issue-git-credential.ts";
import type { TokenFailure } from "../../application/mint-installation-token.ts";
import { provenanceMarker } from "../../domain/provenance.ts";
import { formatRepositorySlug } from "../../domain/repository-slug.ts";
import { succeed, type Result } from "../../domain/result.ts";
import type { Secret } from "../../domain/secret.ts";
import type { CommandContext, CommandOutcome, CommandReport, LocalCommand } from "./cli-command.ts";
import { sessionFlag } from "./command-flag-schemas.ts";
import { validateFlags } from "./command-flags.ts";
import { reportLine } from "./command-report.ts";
import { parseCredentialQuery } from "./git-credential-query.ts";

const roleFlag = z.enum(["author", "reviewer"]);

const tokenFlagsSchema = z.strictObject({ role: roleFlag });

const markerFlagsSchema = z.strictObject({ role: roleFlag, session: sessionFlag });

const noFlagsSchema = z.strictObject({});

const credentialFlagsSchema = z.strictObject({ operation: z.enum(["get", "store", "erase"]) });

const SILENT_REPORT: CommandReport = { standardOutput: "", standardError: "" };

const tokenCommand: LocalCommand = {
  access: "local",
  outputOnFailure: "",
  execute: async ({ flags, configuration, dependencies }) => {
    const tokenFlags = validateFlags({ flags, schema: tokenFlagsSchema });
    if (tokenFlags.kind === "failure") return tokenFlags;
    const { role } = tokenFlags.outcome;
    const minted = await dependencies.tokenMinter.mintInstallationToken({
      role,
      appSlug: configuration.roles[role].appSlug,
      repository: configuration.repository,
    });
    if (minted.kind === "failure") return minted;
    return succeed({
      standardOutput: `${minted.outcome.reveal()}\n`,
      standardError: `Minted a ${role} installation token for ${formatRepositorySlug(configuration.repository)}; it expires within an hour.\n`,
    });
  },
};

const markerCommand: LocalCommand = {
  access: "local",
  outputOnFailure: "",
  execute: ({ flags }) => {
    const markerFlags = validateFlags({ flags, schema: markerFlagsSchema });
    if (markerFlags.kind === "failure") return Promise.resolve(markerFlags);
    return Promise.resolve(succeed(reportLine(provenanceMarker(markerFlags.outcome))));
  },
};

const mintAuthorToken = ({
  configuration,
  dependencies,
}: Pick<CommandContext, "configuration" | "dependencies">): Promise<Result<Secret, TokenFailure>> =>
  dependencies.tokenMinter.mintInstallationToken({
    role: "author",
    appSlug: configuration.roles.author.appSlug,
    repository: configuration.repository,
  });

const adoptGitCommand: LocalCommand = {
  access: "local",
  outputOnFailure: "",
  execute: async ({ flags, configuration, dependencies }) => {
    const adoptFlags = validateFlags({ flags, schema: noFlagsSchema });
    if (adoptFlags.kind === "failure") return adoptFlags;
    const adopted = await adoptWorktreeGitIdentity({
      worktree: dependencies.worktree,
      appSlug: configuration.roles.author.appSlug,
      credentialHelperCommand: dependencies.credentialHelperCommand,
      mintAuthorToken: () => mintAuthorToken({ configuration, dependencies }),
    });
    if (adopted.kind === "failure") return adopted;
    if (adopted.outcome.kind === "primary-checkout-left-unchanged") {
      return succeed(
        reportLine("Left the primary checkout alone: it keeps its owner's git identity."),
      );
    }
    return succeed(
      reportLine(
        `This worktree now commits and pushes as ${adopted.outcome.login}; plain git commit and git push use the bot.`,
      ),
    );
  },
};

const issueCredential = async ({ configuration, dependencies }: CommandContext): CommandOutcome => {
  const query = parseCredentialQuery(await dependencies.terminal.readInput());
  if (query.kind === "failure") return query;
  const credential = await issueGitCredential({
    query: query.outcome,
    repository: configuration.repository,
    mintAuthorToken: () => mintAuthorToken({ configuration, dependencies }),
  });
  if (credential.kind === "failure") return credential;
  return succeed({
    standardOutput: `username=x-access-token\npassword=${credential.outcome.reveal()}\n`,
    standardError: "",
  });
};

const gitCredentialCommand: LocalCommand = {
  access: "local",
  outputOnFailure: "quit=true\n",
  execute: async (context) => {
    const credentialFlags = validateFlags({ flags: context.flags, schema: credentialFlagsSchema });
    if (credentialFlags.kind === "failure") return credentialFlags;
    if (credentialFlags.outcome.operation !== "get") return succeed(SILENT_REPORT);
    return issueCredential(context);
  },
};

const localCommands = {
  token: tokenCommand,
  marker: markerCommand,
  "adopt-git": adoptGitCommand,
  "git-credential": gitCredentialCommand,
};

export { localCommands };
