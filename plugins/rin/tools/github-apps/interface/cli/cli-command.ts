import type { GitHubRepositoryPort } from "../../application/github-repository-port.ts";
import type { GitWorktreePort } from "../../application/git-worktree-port.ts";
import type { TokenMinter } from "../../application/mint-installation-token.ts";
import type { AgentRole } from "../../domain/agent-role.ts";
import type { RepositorySlug } from "../../domain/repository-slug.ts";
import type { Result } from "../../domain/result.ts";
import type { Secret } from "../../domain/secret.ts";
import type {
  ConfigurationFailure,
  IdentityConfiguration,
} from "../../infrastructure/identity-configuration.ts";
import type { TextFileReader } from "../../infrastructure/text-file-reader.ts";
import type { CliFailure } from "./cli-failure.ts";
import type { CommandFlags } from "./command-flags.ts";
import type { Terminal } from "./terminal.ts";

type RepositoryAccess = { readonly token: Secret; readonly repository: RepositorySlug };

type CliDependencies = {
  readonly terminal: Terminal;
  readonly loadConfiguration: () => Promise<Result<IdentityConfiguration, ConfigurationFailure>>;
  readonly tokenMinter: TokenMinter;
  readonly connectRepository: (access: RepositoryAccess) => GitHubRepositoryPort;
  readonly worktree: GitWorktreePort;
  readonly readTextFile: TextFileReader;
  readonly credentialHelperCommand: string;
};

type CommandReport = { readonly standardOutput: string; readonly standardError: string };

type CommandOutcome = Promise<Result<CommandReport, CliFailure>>;

type CommandContext = {
  readonly flags: CommandFlags;
  readonly configuration: IdentityConfiguration;
  readonly dependencies: CliDependencies;
};

type RepositoryCommandContext = CommandContext & {
  readonly role: AgentRole;
  readonly repositoryApi: GitHubRepositoryPort;
};

type RepositoryCommand = {
  readonly access: "repository";
  readonly role: AgentRole;
  readonly execute: (context: RepositoryCommandContext) => CommandOutcome;
};

type LocalCommand = {
  readonly access: "local";
  readonly outputOnFailure: string;
  readonly execute: (context: CommandContext) => CommandOutcome;
};

type CliCommand = RepositoryCommand | LocalCommand;

export type {
  CliCommand,
  CliDependencies,
  CommandContext,
  CommandOutcome,
  CommandReport,
  LocalCommand,
  RepositoryAccess,
  RepositoryCommand,
  RepositoryCommandContext,
};
