import type { StorePlacementCheck } from "../../application/credential-store-boundary.ts";
import type { GhRun, GitHubCliPort } from "../../application/github-cli-port.ts";
import type { GitWorktreePort } from "../../application/git-worktree-port.ts";
import type {
  IdentityConfiguration,
  IdentityConfigurationLoader,
} from "../../application/identity-configuration-port.ts";
import type { TokenMinter } from "../../application/mint-installation-token.ts";
import type { BodyFileReader } from "../../application/read-body-file.ts";
import type { GitHubCliAccess } from "../../application/run-gh-as-bot.ts";
import type { Result } from "../../domain/result.ts";
import type { CliFailure } from "./cli-failure.ts";
import type { CommandFlags } from "./command-flags.ts";
import type { Terminal } from "./terminal.ts";

type CliDependencies = {
  readonly terminal: Terminal;
  readonly loadConfiguration: IdentityConfigurationLoader;
  readonly tokenMinter: TokenMinter;
  readonly connectGitHubCli: (access: GitHubCliAccess) => GitHubCliPort;
  readonly worktree: GitWorktreePort;
  readonly readBodyFile: BodyFileReader;
  readonly placeInStore: StorePlacementCheck;
  readonly credentialHelperCommand: string;
};

type CommandReport = { readonly standardOutput: string; readonly standardError: string };

type CommandOutcome = Promise<Result<CommandReport, CliFailure>>;

type StandaloneContext = {
  readonly flags: CommandFlags;
  readonly dependencies: CliDependencies;
};

type CommandContext = StandaloneContext & { readonly configuration: IdentityConfiguration };

type PassThroughContext = {
  readonly commandArguments: readonly string[];
  readonly configuration: IdentityConfiguration;
  readonly dependencies: CliDependencies;
};

type PassThroughCommand = {
  readonly access: "pass-through";
  readonly execute: (context: PassThroughContext) => Promise<Result<GhRun, CliFailure>>;
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

type CliCommand = PassThroughCommand | LocalCommand | StandaloneCommand;

export type {
  CliCommand,
  CliDependencies,
  CommandContext,
  CommandOutcome,
  CommandReport,
  LocalCommand,
  PassThroughCommand,
  PassThroughContext,
  StandaloneCommand,
  StandaloneContext,
};
