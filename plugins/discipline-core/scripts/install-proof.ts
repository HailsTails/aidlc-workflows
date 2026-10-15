import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import type { Result } from "../core/values/result.ts";
import {
  consumerRootManifest,
  type ExclusionRule,
  environmentWithoutGit,
  exclusionRules,
  type InstallList,
  installPaths,
  entryDisposition,
  judgedStep,
  PROOF_CASES,
  PROOF_DISCIPLINE_ID,
  type ProofAction,
  type ProofCase,
  parsedInstallList,
  type StepRun,
} from "./install-proof-plan.ts";

type Step = () => Result<null, string>;

type Launch = "direct" | "shell";

const SUCCEEDED: Result<null, string> = { outcome: "ok", value: null };
const COMMONJS_MANIFEST = '{ "type": "commonjs" }\n';
const INSTALL_DIRECTORY = [".rin", "dc"];
const GIT_IDENTITY = ["-c", "user.name=proof", "-c", "user.email=proof@invalid", "-c", "commit.gpgsign=false"];
const NPM_INSTALL = ["install", "--no-audit", "--no-fund", "--ignore-scripts"];
const npmLaunch: Launch = process.platform === "win32" ? "shell" : "direct";

const packageRoot = resolve(import.meta.dirname, "..");
const childEnvironment = environmentWithoutGit({ environment: process.env });

const attempted = <T>(request: { readonly label: string; readonly action: () => T }): Result<T, string> => {
  try {
    return { outcome: "ok", value: request.action() };
  } catch (thrown) {
    return { outcome: "failed", error: `FAIL: ${request.label}: ${thrown instanceof Error ? thrown.message : String(thrown)}` };
  }
};

const inOrder = (request: { readonly steps: readonly Step[] }): Result<null, string> =>
  request.steps.reduce<Result<null, string>>((sofar, step) => (sofar.outcome === "failed" ? sofar : step()), SUCCEEDED);

const spawnedRun = (request: {
  readonly command: string;
  readonly arguments: readonly string[];
  readonly directory: string;
  readonly launch: Launch;
}): StepRun => {
  const spawned = spawnSync(request.command, request.arguments, {
    cwd: request.directory,
    env: childEnvironment,
    encoding: "utf8",
    shell: request.launch === "shell",
  });
  if (spawned.error !== undefined) {
    return { outcome: "not-exited", detail: spawned.error.message };
  }
  return spawned.status === null
    ? { outcome: "not-exited", detail: `signal ${spawned.signal ?? "unknown"}` }
    : { outcome: "exited", exitCode: spawned.status, output: `${spawned.stdout}${spawned.stderr}` };
};

const succeededRun = (request: { readonly label: string; readonly run: StepRun }): Result<null, string> => {
  if (request.run.outcome === "not-exited") {
    return { outcome: "failed", error: `FAIL: ${request.label}: did not exit: ${request.run.detail}` };
  }
  return request.run.exitCode === 0
    ? SUCCEEDED
    : { outcome: "failed", error: `FAIL: ${request.label}: exit ${request.run.exitCode}\n${request.run.output}` };
};

const git = (request: { readonly repo: string; readonly arguments: readonly string[] }): Result<null, string> =>
  succeededRun({
    label: `git ${request.arguments.join(" ")} in ${basename(request.repo)}`,
    run: spawnedRun({
      command: "git",
      arguments: [...GIT_IDENTITY, ...request.arguments],
      directory: request.repo,
      launch: "direct",
    }),
  });

const commitAll = (request: { readonly repo: string; readonly message: string }): Result<null, string> =>
  inOrder({
    steps: [
      () => git({ repo: request.repo, arguments: ["add", "-A"] }),
      () => git({ repo: request.repo, arguments: ["commit", "-q", "-m", request.message] }),
    ],
  });

const installedCommand = (request: {
  readonly repo: string;
  readonly label: string;
  readonly script: string;
  readonly arguments: readonly string[];
  readonly action: Extract<ProofAction, { readonly kind: "check" | "project" }>;
}): Result<null, string> => {
  const judged = judgedStep({
    label: request.label,
    expectation: request.action.expectation,
    run: spawnedRun({
      command: process.execPath,
      arguments: [join(request.repo, ...INSTALL_DIRECTORY, "core", "check", request.script), "--repo", request.repo, ...request.arguments],
      directory: request.repo,
      launch: "direct",
    }),
  });
  if (judged.outcome === "failed") {
    return judged;
  }
  console.log(judged.value);
  return SUCCEEDED;
};

const performedAction = (request: { readonly repo: string; readonly consumer: string; readonly action: ProofAction }): Result<null, string> => {
  const action = request.action;
  switch (action.kind) {
    case "check":
      return installedCommand({
        repo: request.repo,
        label: `${request.consumer} check`,
        script: "check-command.ts",
        arguments: ["--base-revision", "HEAD"],
        action,
      });
    case "project":
      return installedCommand({
        repo: request.repo,
        label: `${request.consumer} project`,
        script: "project-command.ts",
        arguments: [],
        action,
      });
    case "remove": {
      const removed = attempted({
        label: `remove ${action.path} in ${request.consumer}`,
        action: () => rmSync(join(request.repo, action.path)),
      });
      return removed.outcome === "failed" ? removed : SUCCEEDED;
    }
    case "commit":
      return commitAll({ repo: request.repo, message: action.message });
  }
};

const copiedInstall = (request: {
  readonly installDirectory: string;
  readonly paths: readonly string[];
  readonly rules: readonly ExclusionRule[];
}): Result<null, string> =>
  inOrder({
    steps: request.paths.map(
      (path): Step =>
        () => {
          const copied = attempted({
            label: `copy ${path} into the install`,
            action: () =>
              cpSync(join(packageRoot, path), join(request.installDirectory, path), {
                recursive: true,
                filter: (source) =>
                  entryDisposition({
                    rules: request.rules,
                    name: basename(source),
                    entryKind: statSync(source).isDirectory() ? "folder" : "file",
                  }) === "kept",
              }),
          });
          return copied.outcome === "failed" ? copied : SUCCEEDED;
        },
    ),
  });

const provenCase = (request: {
  readonly temporaryRoot: string;
  readonly installList: InstallList;
  readonly rules: readonly ExclusionRule[];
  readonly proofCase: ProofCase;
}): Result<null, string> => {
  const paths = installPaths({
    installList: request.installList,
    disciplineId: PROOF_DISCIPLINE_ID,
    mechanism: request.proofCase.mechanism,
  });
  if (paths.outcome === "failed") {
    return { outcome: "failed", error: `FAIL: install path ${paths.error.path} keeps a placeholder` };
  }
  const repo = join(request.temporaryRoot, request.proofCase.consumer);
  const installDirectory = join(repo, ...INSTALL_DIRECTORY);
  const fixture = join(packageRoot, "tests", "test-fixtures", "consumer-proof", request.proofCase.mechanism);
  const prepared = attempted({
    label: `prepare the ${request.proofCase.consumer} consumer`,
    action: () => {
      cpSync(fixture, repo, { recursive: true });
      writeFileSync(join(repo, "package.json"), COMMONJS_MANIFEST);
    },
  });
  if (prepared.outcome === "failed") {
    return prepared;
  }
  return inOrder({
    steps: [
      () => copiedInstall({ installDirectory, paths: paths.value, rules: request.rules }),
      () => git({ repo, arguments: ["init", "-q"] }),
      () => commitAll({ repo, message: "consumer" }),
      () => {
        if (request.proofCase.installedManifest === "kept") {
          return SUCCEEDED;
        }
        const removed = attempted({
          label: `remove the installed package.json in ${request.proofCase.consumer}`,
          action: () => rmSync(join(installDirectory, "package.json")),
        });
        return removed.outcome === "failed" ? removed : SUCCEEDED;
      },
      ...request.proofCase.actions.map(
        (action): Step =>
          () =>
            performedAction({ repo, consumer: request.proofCase.consumer, action }),
      ),
    ],
  });
};

const provenInside = (request: {
  readonly temporaryRoot: string;
  readonly rootManifest: string;
  readonly installList: InstallList;
}): Result<null, string> => {
  const rules = exclusionRules({ leftOut: request.installList.leftOut });
  return inOrder({
    steps: [
      () => {
        const written = attempted({
          label: "write the consumer root package.json",
          action: () => writeFileSync(join(request.temporaryRoot, "package.json"), request.rootManifest),
        });
        return written.outcome === "failed" ? written : SUCCEEDED;
      },
      () =>
        succeededRun({
          label: "npm install at the consumer root",
          run: spawnedRun({
            command: "npm",
            arguments: NPM_INSTALL,
            directory: request.temporaryRoot,
            launch: npmLaunch,
          }),
        }),
      ...PROOF_CASES.map(
        (proofCase): Step =>
          () =>
            provenCase({ temporaryRoot: request.temporaryRoot, installList: request.installList, rules, proofCase }),
      ),
    ],
  });
};

const proof = (): Result<null, string> => {
  const readme = attempted({ label: "read README.md", action: () => readFileSync(join(packageRoot, "README.md"), "utf8") });
  if (readme.outcome === "failed") {
    return readme;
  }
  const installList = parsedInstallList({ readme: readme.value });
  if (installList.outcome === "failed") {
    return { outcome: "failed", error: `FAIL: README.md install list: ${JSON.stringify(installList.error)}` };
  }
  const packageManifest = attempted({
    label: "read package.json",
    action: () => readFileSync(join(packageRoot, "package.json"), "utf8"),
  });
  if (packageManifest.outcome === "failed") {
    return packageManifest;
  }
  const rootManifest = consumerRootManifest({ packageManifest: packageManifest.value });
  if (rootManifest.outcome === "failed") {
    return { outcome: "failed", error: `FAIL: package.json: ${rootManifest.error.detail}` };
  }
  const temporaryRoot = attempted({
    label: "create the temporary consumer root",
    action: () => realpathSync(mkdtempSync(join(tmpdir(), "discipline-core-install-proof-"))),
  });
  if (temporaryRoot.outcome === "failed") {
    return temporaryRoot;
  }
  try {
    return provenInside({ temporaryRoot: temporaryRoot.value, rootManifest: rootManifest.value, installList: installList.value });
  } finally {
    rmSync(temporaryRoot.value, { recursive: true, force: true });
  }
};

const outcome = proof();
if (outcome.outcome === "failed") {
  console.error(outcome.error);
  process.exit(1);
}
console.log("install proof: pass");
