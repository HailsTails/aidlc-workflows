import type {
  CheckoutKind,
  GitFailure,
  GitWorktreePort,
  WorktreeGitSettings,
} from "../application/git-worktree-port.ts";
import { fail, succeed, type Result } from "../domain/result.ts";
import type { CommandRunner } from "./command-runner.ts";

type GitCliDependencies = { readonly runCommand: CommandRunner };

type GitInvocation = GitCliDependencies & { readonly gitArguments: readonly string[] };

type CredentialHelperEntry = { readonly cliEntryPath: string };

type ConfigurationLookup = GitCliDependencies & { readonly keys: readonly string[] };

const DEFAULT_PUSH_REMOTE = "origin";

const runGit = async ({
  runCommand,
  gitArguments,
}: GitInvocation): Promise<Result<string, GitFailure>> => {
  const ran = await runCommand({ command: "git", commandArguments: gitArguments });
  if (ran.kind === "failure") {
    return fail({
      kind: "git-command-failed",
      command: ran.reason.command,
      detail: ran.reason.detail,
    });
  }
  return succeed(ran.outcome.trim());
};

const readCurrentBranch = async ({
  runCommand,
}: GitCliDependencies): Promise<Result<string, GitFailure>> => {
  const branch = await runGit({ runCommand, gitArguments: ["rev-parse", "--abbrev-ref", "HEAD"] });
  if (branch.kind === "failure") return branch;
  if (branch.outcome === "HEAD") return fail({ kind: "branch-detached" });
  return branch;
};

const readCheckoutKind = async ({
  runCommand,
}: GitCliDependencies): Promise<Result<CheckoutKind, GitFailure>> => {
  const commonDirectory = await runGit({
    runCommand,
    gitArguments: ["rev-parse", "--path-format=absolute", "--git-common-dir"],
  });
  if (commonDirectory.kind === "failure") return commonDirectory;
  const ownDirectory = await runGit({
    runCommand,
    gitArguments: ["rev-parse", "--path-format=absolute", "--git-dir"],
  });
  if (ownDirectory.kind === "failure") return ownDirectory;
  return succeed(
    commonDirectory.outcome === ownDirectory.outcome ? "primary-checkout" : "linked-worktree",
  );
};

const firstConfiguredValue = async ({
  runCommand,
  keys,
}: ConfigurationLookup): Promise<Result<string | undefined, GitFailure>> => {
  const [key, ...remainingKeys] = keys;
  if (key === undefined) return succeed(undefined);
  const value = await runGit({ runCommand, gitArguments: ["config", "--default", "", "--get", key] });
  if (value.kind === "failure") return value;
  if (value.outcome !== "") return succeed(value.outcome);
  return firstConfiguredValue({ runCommand, keys: remainingKeys });
};

const pushRemoteKeys = async ({
  runCommand,
}: GitCliDependencies): Promise<Result<readonly string[], GitFailure>> => {
  const branch = await readCurrentBranch({ runCommand });
  if (branch.kind === "success") {
    return succeed([
      `branch.${branch.outcome}.pushRemote`,
      "remote.pushDefault",
      `branch.${branch.outcome}.remote`,
    ]);
  }
  if (branch.reason.kind === "branch-detached") return succeed(["remote.pushDefault"]);
  return branch;
};

const readPushRemote = async ({
  runCommand,
}: GitCliDependencies): Promise<Result<string, GitFailure>> => {
  const keys = await pushRemoteKeys({ runCommand });
  if (keys.kind === "failure") return keys;
  const remoteName = await firstConfiguredValue({ runCommand, keys: keys.outcome });
  if (remoteName.kind === "failure") return remoteName;
  return runGit({
    runCommand,
    gitArguments: ["remote", "get-url", "--push", remoteName.outcome ?? DEFAULT_PUSH_REMOTE],
  });
};

const worktreeConfiguration = ({
  credentialHelperCommand,
  committerName,
  committerEmail,
}: WorktreeGitSettings): readonly (readonly string[])[] => [
  ["config", "extensions.worktreeConfig", "true"],
  ["config", "--worktree", "--replace-all", "credential.helper", ""],
  ["config", "--worktree", "--add", "credential.helper", credentialHelperCommand],
  ["config", "--worktree", "credential.useHttpPath", "true"],
  ["config", "--worktree", "credential.interactive", "false"],
  ["config", "--worktree", "user.name", committerName],
  ["config", "--worktree", "user.email", committerEmail],
];

const configureWorktree = ({
  runCommand,
  settings,
}: GitCliDependencies & { readonly settings: WorktreeGitSettings }): Promise<
  Result<void, GitFailure>
> =>
  worktreeConfiguration(settings).reduce<Promise<Result<void, GitFailure>>>(
    async (previousStep, gitArguments) => {
      const settled = await previousStep;
      if (settled.kind === "failure") return settled;
      const configured = await runGit({ runCommand, gitArguments });
      if (configured.kind === "failure") return configured;
      return succeed(undefined);
    },
    Promise.resolve(succeed(undefined)),
  );

const credentialHelperCommandFor = ({ cliEntryPath }: CredentialHelperEntry): string =>
  `!bun "${cliEntryPath.replaceAll("\\", "/")}" git-credential --operation`;

const createGitCliWorktree = ({ runCommand }: GitCliDependencies): GitWorktreePort => ({
  readCurrentBranch: () => readCurrentBranch({ runCommand }),
  readCheckoutKind: () => readCheckoutKind({ runCommand }),
  readPushRemote: () => readPushRemote({ runCommand }),
  configureWorktree: (settings) => configureWorktree({ runCommand, settings }),
});

export { createGitCliWorktree, credentialHelperCommandFor };
