import { createTokenMinter } from "./application/mint-installation-token.ts";
import { runCommand } from "./infrastructure/command-runner.ts";
import {
  createFileCredentialStore,
  locateUserStore,
} from "./infrastructure/file-credential-store.ts";
import {
  credentialHelperCommandFor,
  createGitCliWorktree,
} from "./infrastructure/git-cli-worktree.ts";
import { createGitHubAppApi } from "./infrastructure/github-app-api.ts";
import { createDefaultGitHubHttp } from "./infrastructure/github-http.ts";
import { createGitHubRepositoryApi } from "./infrastructure/github-repository-api.ts";
import { loadIdentityConfiguration } from "./infrastructure/identity-configuration.ts";
import { createRs256Signer } from "./infrastructure/rs256-signer.ts";
import { createSystemClock } from "./infrastructure/system-clock.ts";
import { readTextFile } from "./infrastructure/text-file-reader.ts";
import { createProcessUserEnvironment } from "./infrastructure/user-environment.ts";
import type { CliDependencies } from "./interface/cli/cli-command.ts";
import { createProcessTerminal } from "./interface/cli/terminal.ts";

const CONSUMER_IDENTITY_CONFIGURATION = new URL(
  "../../../aidlc/github-identity.json",
  import.meta.url,
);

const CLI_ENTRY_PATH = `${import.meta.dirname}/cli-main.ts`;

const createCliDependencies = (): CliDependencies => {
  const worktree = createGitCliWorktree({ runCommand });
  const http = createDefaultGitHubHttp();
  return {
    terminal: createProcessTerminal(),
    loadConfiguration: () =>
      loadIdentityConfiguration({ readTextFile, location: CONSUMER_IDENTITY_CONFIGURATION }),
    tokenMinter: createTokenMinter({
      credentialStore: createFileCredentialStore({
        locateStoreDirectory: locateUserStore({ environment: createProcessUserEnvironment() }),
        readTextFile,
      }),
      appApi: createGitHubAppApi({ http }),
      clock: createSystemClock(),
      signer: createRs256Signer(),
    }),
    connectRepository: ({ token, repository }) =>
      createGitHubRepositoryApi({ http, credential: token, repository }),
    worktree,
    readTextFile,
    credentialHelperCommand: credentialHelperCommandFor({ cliEntryPath: CLI_ENTRY_PATH }),
  };
};

export { createCliDependencies };
