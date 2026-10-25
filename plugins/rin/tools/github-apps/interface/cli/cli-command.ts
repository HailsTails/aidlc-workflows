import type { GitHubRepositoryPort } from "../../application/github-repository-port.ts";
import type { GitWorktreePort } from "../../application/git-worktree-port.ts";
import type {
  IdentityConfiguration,
  IdentityConfigurationLoader,
} from "../../application/identity-configuration-port.ts";
import type { TokenMinter } from "../../application/mint-installation-token.ts";
import type { BodyFileReader } from "../../application/read-body-file.ts";
import type { AgentRole } from "../../domain/agent-role.ts";
import type { RepositorySlug } from "../../domain/repository-slug.ts";
import type { Result } from "../../domain/result.ts";
import type { Secret } from "../../domain/secret.ts";
import type { CliFailure } from "./cli-failure.ts";
import type { CommandFlags } from "./command-flags.ts";
import type { Terminal } from "./terminal.ts";

type RepositoryAccess = { readonly token: Secret; readonly repository: RepositorySlug };

type CliDependencies = {
  readonly terminal: Terminal;
  readonly loadConfiguration: IdentityConfigurationLoader;
  readonly tokenMinter: TokenMinter;
  readonly connectRepository: (access: RepositoryAccess) => GitHubRepositoryPort;
  readonly worktree: GitWorktreePort;
  readonly readBodyFile: BodyFileReader;
  readonly credentialHelperCommand: string;
};

type CommandReport = { readonly standardOutput: string; readonly standardError: string };

type CommandOutcome = Promise<Result<CommandReport, CliFailure>>;

type StandaloneContext = {
  readonly flags: CommandFlags;
  readonly dependencies: CliDependencies;
};

type CommandContext = StandaloneContext & { readonly configuration: IdentityConfiguration };

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

type StandaloneCommand = {
  readonly access: "standalone";
  readonly outputOnFailure: string;
  readonly execute: (context: StandaloneContext) => CommandOutcome;
};

type CliCommand = RepositoryCommand | LocalCommand | StandaloneCommand;

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
  StandaloneCommand,
  StandaloneContext,
};
