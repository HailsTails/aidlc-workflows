import { createUserAuthoriser } from "./application/authorise-user.ts";
import { createStorePlacementCheck } from "./application/credential-store-boundary.ts";
import { createTokenMinter } from "./application/mint-installation-token.ts";
import { createBodyFileReader } from "./application/read-body-file.ts";
import { createCommandRunner } from "./infrastructure/command-runner.ts";
import { createExclusiveFileLock } from "./infrastructure/exclusive-file-lock.ts";
import {
  createFileCredentialStore,
  locateUserStore,
} from "./infrastructure/file-credential-store.ts";
import { createFileUserGrantStore } from "./infrastructure/file-user-grant-store.ts";
import {
  credentialHelperCommandFor,
  createGitCliWorktree,
} from "./infrastructure/git-cli-worktree.ts";
import { createGitHubAppApi } from "./infrastructure/github-app-api.ts";
import { createGitHubCli } from "./infrastructure/github-cli.ts";
import { createDefaultGitHubHttp } from "./infrastructure/github-http.ts";
import { createDefaultGitHubUserAuthorisation } from "./infrastructure/github-user-authorisation.ts";
import { loadIdentityConfiguration } from "./infrastructure/identity-configuration.ts";
import { runProcess } from "./infrastructure/process-runner.ts";
import { createRs256Signer } from "./infrastructure/rs256-signer.ts";
import { createSystemClock } from "./infrastructure/system-clock.ts";
import { createSystemPause } from "./infrastructure/system-pause.ts";
import {
  createPrivateFile,
  readTextFile,
  removeFile,
  replacePrivateFile,
  resolveCanonicalPath,
} from "./infrastructure/local-file-system.ts";
import { createProcessUserEnvironment } from "./infrastructure/user-environment.ts";
import type { CliDependencies } from "./interface/cli/cli-command.ts";
import { createProcessTerminal } from "./interface/cli/terminal.ts";

const CONSUMER_IDENTITY_CONFIGURATION = new URL(
  "../../../aidlc/github-identity.json",
  import.meta.url,
);

const CLI_ENTRY_PATH = `${import.meta.dirname}/cli-main.ts`;

const createCliDependencies = (): CliDependencies => {
  const locateCredentialStore = locateUserStore({ environment: createProcessUserEnvironment() });
  const placeInStore = createStorePlacementCheck({ resolveCanonicalPath, locateCredentialStore });
  const credentialStore = createFileCredentialStore({
    locateStoreDirectory: locateCredentialStore,
    readTextFile,
  });
  const clock = createSystemClock();
  const pause = createSystemPause();
  const lock = createExclusiveFileLock({ createPrivateFile, readTextFile, removeFile, clock, pause });
  return {
    terminal: createProcessTerminal(),
    loadConfiguration: () =>
      loadIdentityConfiguration({ readTextFile, location: CONSUMER_IDENTITY_CONFIGURATION }),
    tokenMinter: createTokenMinter({
      credentialStore,
      appApi: createGitHubAppApi({ http: createDefaultGitHubHttp() }),
      clock,
      signer: createRs256Signer(),
    }),
    connectGitHubCli: ({ token, repository }) =>
      createGitHubCli({ runProcess, credential: token, repository }),
    worktree: createGitCliWorktree({ runCommand: createCommandRunner(runProcess) }),
    readBodyFile: createBodyFileReader({ readTextFile, placeInStore }),
    placeInStore,
    credentialHelperCommand: credentialHelperCommandFor({ cliEntryPath: CLI_ENTRY_PATH }),
    userAuthoriser: createUserAuthoriser({
      authorisationSettings: credentialStore,
      userAuthorisation: createDefaultGitHubUserAuthorisation(),
      userGrantStore: createFileUserGrantStore({
        locateStoreDirectory: locateCredentialStore,
        readTextFile,
        replacePrivateFile,
        lock,
      }),
      clock,
      pause,
    }),
  };
};

export { createCliDependencies };
