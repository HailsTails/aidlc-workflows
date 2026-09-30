import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  type HermeticGitEnvironment,
  hermeticGitEnvironment,
} from "./hermetic-git-environment.ts";

type HermeticGitRepository = {
  readonly path: string;
  readonly environment: HermeticGitEnvironment;
  readonly run: (gitArguments: readonly string[]) => string;
  readonly writeFile: (input: {
    readonly relativePath: string;
    readonly body: string;
  }) => void;
  readonly commitAll: (input: { readonly message: string }) => void;
  readonly dispose: () => void;
};

const INITIAL_BRANCH = "main";

const createHermeticGitRepository = ({
  namePrefix = "rin-hermetic-",
}: {
  readonly namePrefix?: string;
} = {}): HermeticGitRepository => {
  const enclosure = mkdtempSync(join(tmpdir(), namePrefix));
  const repositoryPath = join(enclosure, "repository");
  const configHome = join(enclosure, "home");
  const environment = hermeticGitEnvironment({ configHome });

  const run = (gitArguments: readonly string[]): string =>
    execFileSync("git", [...gitArguments], {
      cwd: repositoryPath,
      encoding: "utf8",
      env: { ...environment },
      stdio: ["ignore", "pipe", "pipe"],
    });

  execFileSync(
    "git",
    ["init", "-q", "-b", INITIAL_BRANCH, "--", repositoryPath],
    {
      cwd: enclosure,
      encoding: "utf8",
      env: { ...environment, HOME: configHome },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  const writeFile = ({
    relativePath,
    body,
  }: {
    readonly relativePath: string;
    readonly body: string;
  }): void => {
    writeFileSync(join(repositoryPath, relativePath), body);
  };

  const commitAll = ({ message }: { readonly message: string }): void => {
    run(["add", "-A"]);
    run(["commit", "-q", "-m", message]);
  };

  const dispose = (): void => {
    rmSync(enclosure, { recursive: true, force: true });
  };

  return {
    path: repositoryPath,
    environment,
    run,
    writeFile,
    commitAll,
    dispose,
  };
};

export { createHermeticGitRepository, type HermeticGitRepository };
