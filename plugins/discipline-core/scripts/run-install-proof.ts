import type { FileTextPort } from "../core/platform-ports/file-text-port.ts";
import type { PathPort } from "../core/platform-ports/path-port.ts";
import type { ProcessPort } from "../core/platform-ports/process-port.ts";
import type { Result } from "../core/values/result.ts";
import {
  CONSUMER_MANIFEST,
  type ExclusionRule,
  entryDisposition,
  exclusionRules,
  type InstallList,
  type InstallPlacement,
  installPlacements,
  intoRootPlacements,
  judgedStep,
  type ProofAction,
  type ProofCase,
  type ProofToolchain,
  parsedInstallList,
  type StepRun,
  toolchainManifest,
} from "./install-proof-plan.ts";
import type { CommandRunPort, ProofCommand, ScratchFilesPort } from "./install-proof-ports.ts";

export type InstallProofRequest = {
  readonly process: ProcessPort;
  readonly path: PathPort;
  readonly fileText: FileTextPort;
  readonly scratch: ScratchFilesPort;
  readonly commands: CommandRunPort;
  readonly moduleUrl: string;
  readonly proofCases: readonly ProofCase[];
};

type Step = () => Result<null, string>;

type ProofContext = {
  readonly process: ProcessPort;
  readonly path: PathPort;
  readonly fileText: FileTextPort;
  readonly scratch: ScratchFilesPort;
  readonly commands: CommandRunPort;
  readonly packageRoot: string;
};

const SUCCEEDED: Result<null, string> = { outcome: "ok", value: null };
const IGNORED_INSTALLS = "node_modules/\n";
const INSTALL_DIRECTORY = ["tools", "discipline-core"];
const TEMPORARY_PREFIX = "discipline-core-install-proof-";
const GIT_IDENTITY = ["-c", "user.name=proof", "-c", "user.email=proof@invalid", "-c", "commit.gpgsign=false"];
const NPM_INSTALL = ["install", "--no-audit", "--no-fund", "--ignore-scripts"];
const NPM_CI = ["ci", "--ignore-scripts", "--no-audit", "--no-fund"];
const CORE_PACKAGES = "core-packages";
const NODE_MODULES = "node_modules";
const PASS_LINE = "install proof: pass\n";

const inOrder = (request: { readonly steps: readonly Step[] }): Result<null, string> =>
  request.steps.reduce<Result<null, string>>((sofar, step) => (sofar.outcome === "failed" ? sofar : step()), SUCCEEDED);

const labelled = <T>(request: {
  readonly label: string;
  readonly result: Result<T, { readonly detail: string }>;
}): Result<T, string> =>
  request.result.outcome === "failed"
    ? { outcome: "failed", error: `FAIL: ${request.label}: ${request.result.error.detail}` }
    : request.result;

const emptied = (request: { readonly result: Result<unknown, string> }): Result<null, string> =>
  request.result.outcome === "failed" ? request.result : SUCCEEDED;

const succeededRun = (request: { readonly label: string; readonly run: StepRun }): Result<null, string> => {
  if (request.run.outcome === "not-exited") {
    return { outcome: "failed", error: `FAIL: ${request.label}: did not exit: ${request.run.detail}` };
  }
  return request.run.exitCode === 0
    ? SUCCEEDED
    : { outcome: "failed", error: `FAIL: ${request.label}: exit ${request.run.exitCode}\n${request.run.output}` };
};

const ranCommand = (request: {
  readonly context: ProofContext;
  readonly label: string;
  readonly command: ProofCommand;
  readonly arguments: readonly string[];
  readonly directory: string;
}): Result<null, string> =>
  succeededRun({
    label: request.label,
    run: request.context.commands.run({
      command: request.command,
      arguments: request.arguments,
      directory: request.directory,
    }),
  });

const git = (request: {
  readonly context: ProofContext;
  readonly repo: string;
  readonly consumer: string;
  readonly arguments: readonly string[];
}): Result<null, string> =>
  ranCommand({
    context: request.context,
    label: `git ${request.arguments.join(" ")} in ${request.consumer}`,
    command: "git",
    arguments: [...GIT_IDENTITY, ...request.arguments],
    directory: request.repo,
  });

const commitAll = (request: {
  readonly context: ProofContext;
  readonly repo: string;
  readonly consumer: string;
  readonly message: string;
}): Result<null, string> =>
  inOrder({
    steps: [
      () => git({ ...request, arguments: ["add", "-A"] }),
      () => git({ ...request, arguments: ["commit", "-q", "-m", request.message] }),
    ],
  });

const installedCommand = (request: {
  readonly context: ProofContext;
  readonly repo: string;
  readonly label: string;
  readonly script: string;
  readonly arguments: readonly string[];
  readonly action: Extract<ProofAction, { readonly kind: "check" | "project" }>;
}): Result<null, string> => {
  const judged = judgedStep({
    label: request.label,
    expectation: request.action.expectation,
    run: request.context.commands.run({
      command: "node",
      arguments: [
        request.context.path.join({ segments: [request.repo, ...INSTALL_DIRECTORY, "core", "check", request.script] }),
        "--repo",
        request.repo,
        ...request.arguments,
      ],
      directory: request.repo,
    }),
  });
  if (judged.outcome === "failed") {
    return judged;
  }
  request.context.process.writeOut({ text: `${judged.value}\n` });
  return SUCCEEDED;
};

const removedPath = (request: {
  readonly context: ProofContext;
  readonly label: string;
  readonly path: string;
}): Result<null, string> =>
  labelled({ label: request.label, result: request.context.scratch.removeFile({ path: request.path }) });

const performedAction = (request: {
  readonly context: ProofContext;
  readonly repo: string;
  readonly consumer: string;
  readonly action: ProofAction;
}): Result<null, string> => {
  const action = request.action;
  switch (action.kind) {
    case "check":
      return installedCommand({
        context: request.context,
        repo: request.repo,
        label: `${request.consumer} check`,
        script: "check-command.ts",
        arguments: ["--base-revision", "HEAD"],
        action,
      });
    case "project":
      return installedCommand({
        context: request.context,
        repo: request.repo,
        label: `${request.consumer} project`,
        script: "project-command.ts",
        arguments: [],
        action,
      });
    case "remove":
      return removedPath({
        context: request.context,
        label: `remove ${action.path} in ${request.consumer}`,
        path: request.context.path.join({ segments: [request.repo, action.path] }),
      });
    case "commit":
      return commitAll({
        context: request.context,
        repo: request.repo,
        consumer: request.consumer,
        message: action.message,
      });
  }
};

const copiedPlacements = (request: {
  readonly context: ProofContext;
  readonly targetDirectory: string;
  readonly placements: readonly InstallPlacement[];
  readonly rules: readonly ExclusionRule[];
}): Result<null, string> =>
  inOrder({
    steps: request.placements.map(
      (placement): Step =>
        () =>
          labelled({
            label: `copy ${placement.from} into ${placement.to}`,
            result: request.context.scratch.copyTree({
              from: request.context.path.join({ segments: [request.context.packageRoot, placement.from] }),
              to: request.context.path.join({ segments: [request.targetDirectory, placement.to] }),
              disposition: (entry) => entryDisposition({ rules: request.rules, name: entry.name, entryKind: entry.entryKind }),
            }),
          }),
    ),
  });
const installLeavesOut = (request: {
  readonly context: ProofContext;
  readonly consumer: string;
  readonly installDirectory: string;
  readonly installList: InstallList;
  readonly rules: readonly ExclusionRule[];
}): Result<null, string> => {
  const label = `${request.consumer} install leaves out ${request.installList.leftOut.join(", ")}`;
  const listed = labelled({ label, result: request.context.scratch.listTree({ path: request.installDirectory }) });
  if (listed.outcome === "failed") {
    return listed;
  }
  const kept = listed.value.filter(
    (entry) => entryDisposition({ rules: request.rules, name: entry.name, entryKind: entry.entryKind }) === "left-out",
  );
  if (kept.length > 0) {
    return { outcome: "failed", error: `FAIL: ${label}: found ${kept.map((entry) => entry.path).join(", ")}` };
  }
  request.context.process.writeOut({ text: `ok: ${label}\n` });
  return SUCCEEDED;
};

const writtenFile = (request: {
  readonly context: ProofContext;
  readonly label: string;
  readonly path: string;
  readonly text: string;
}): Result<null, string> =>
  emptied({
    result: labelled({ label: request.label, result: request.context.fileText.write({ path: request.path, text: request.text }) }),
  });

const preparedConsumer = (request: {
  readonly context: ProofContext;
  readonly fixture: string;
  readonly repo: string;
}): Result<null, string> => {
  const label = `prepare the consumer ${request.repo}`;
  return inOrder({
    steps: [
      () =>
        labelled({
          label,
          result: request.context.scratch.copyTree({ from: request.fixture, to: request.repo, disposition: () => "kept" }),
        }),
      () =>
        writtenFile({
          context: request.context,
          label,
          path: request.context.path.join({ segments: [request.repo, "package.json"] }),
          text: CONSUMER_MANIFEST,
        }),
      () =>
        writtenFile({
          context: request.context,
          label,
          path: request.context.path.join({ segments: [request.repo, ".gitignore"] }),
          text: IGNORED_INSTALLS,
        }),
    ],
  });
};

const stagedCorePackages = (request: {
  readonly context: ProofContext;
  readonly temporaryRoot: string;
  readonly installList: InstallList;
}): Result<null, string> => {
  const directory = request.context.path.join({ segments: [request.temporaryRoot, CORE_PACKAGES] });
  return inOrder({
    steps: [
      () =>
        copiedPlacements({
          context: request.context,
          targetDirectory: directory,
          placements: intoRootPlacements({ installList: request.installList }),
          rules: [],
        }),
      () => ranCommand({ context: request.context, label: "npm ci core's own packages", command: "npm", arguments: NPM_CI, directory }),
    ],
  });
};

const installedToolchain = (request: {
  readonly context: ProofContext;
  readonly temporaryRoot: string;
  readonly packageManifest: string;
  readonly toolchain: ProofToolchain;
}): Result<null, string> => {
  const manifest = toolchainManifest({ developmentManifest: request.packageManifest, toolchain: request.toolchain });
  if (manifest.outcome === "failed") {
    return { outcome: "failed", error: `FAIL: package.json: ${manifest.error.detail}` };
  }
  const directory = request.context.path.join({ segments: [request.temporaryRoot, request.toolchain] });
  const label = `prepare the ${request.toolchain} toolchain`;
  return inOrder({
    steps: [
      () => emptied({ result: labelled({ label, result: request.context.scratch.makeDirectory({ path: directory }) }) }),
      () =>
        writtenFile({
          context: request.context,
          label,
          path: request.context.path.join({ segments: [directory, "package.json"] }),
          text: manifest.value,
        }),
      () =>
        ranCommand({
          context: request.context,
          label: `npm install the ${request.toolchain} toolchain`,
          command: "npm",
          arguments: NPM_INSTALL,
          directory,
        }),
    ],
  });
};

const provenCase = (request: {
  readonly context: ProofContext;
  readonly temporaryRoot: string;
  readonly installList: InstallList;
  readonly rules: readonly ExclusionRule[];
  readonly proofCase: ProofCase;
}): Result<null, string> => {
  const context = request.context;
  const consumer = request.proofCase.consumer;
  const placements = installPlacements({
    installList: request.installList,
    disciplineId: request.proofCase.disciplineId,
    mechanism: request.proofCase.mechanism,
  });
  if (placements.outcome === "failed") {
    return { outcome: "failed", error: `FAIL: install path ${placements.error.path} keeps a placeholder` };
  }
  const repo = context.path.join({ segments: [request.temporaryRoot, request.proofCase.toolchain, consumer] });
  const installDirectory = context.path.join({ segments: [repo, ...INSTALL_DIRECTORY] });
  const fixture = context.path.join({
    segments: [context.packageRoot, "tests", "test-fixtures", "consumer-proof", request.proofCase.mechanism],
  });
  return inOrder({
    steps: [
      () => preparedConsumer({ context, fixture, repo }),
      () => copiedPlacements({ context, targetDirectory: installDirectory, placements: placements.value, rules: request.rules }),
      () => installLeavesOut({ context, consumer, installDirectory, installList: request.installList, rules: request.rules }),
      () =>
        labelled({
          label: `copy core's own packages into the ${consumer} install`,
          result: context.scratch.copyTree({
            from: context.path.join({ segments: [request.temporaryRoot, CORE_PACKAGES, NODE_MODULES] }),
            to: context.path.join({ segments: [installDirectory, NODE_MODULES] }),
            disposition: () => "kept",
          }),
        }),
      () => git({ context, repo, consumer, arguments: ["init", "-q"] }),
      () => commitAll({ context, repo, consumer, message: "consumer" }),
      () =>
        request.proofCase.installedManifest === "kept"
          ? SUCCEEDED
          : removedPath({
              context,
              label: `remove the installed package.json in ${consumer}`,
              path: context.path.join({ segments: [installDirectory, "package.json"] }),
            }),
      ...request.proofCase.actions.map(
        (action): Step =>
          () =>
            performedAction({ context, repo, consumer, action }),
      ),
    ],
  });
};

const toolchainsOf = (request: { readonly proofCases: readonly ProofCase[] }): readonly ProofToolchain[] => [
  ...new Set(request.proofCases.map((proofCase) => proofCase.toolchain)),
];

const provenInside = (request: {
  readonly context: ProofContext;
  readonly temporaryRoot: string;
  readonly packageManifest: string;
  readonly installList: InstallList;
  readonly proofCases: readonly ProofCase[];
}): Result<null, string> => {
  const rules = exclusionRules({ leftOut: request.installList.leftOut });
  return inOrder({
    steps: [
      () => stagedCorePackages(request),
      ...toolchainsOf(request).map(
        (toolchain): Step =>
          () =>
            installedToolchain({ ...request, toolchain }),
      ),
      ...request.proofCases.map(
        (proofCase): Step =>
          () =>
            provenCase({
              context: request.context,
              temporaryRoot: request.temporaryRoot,
              installList: request.installList,
              rules,
              proofCase,
            }),
      ),
    ],
  });
};

const provenWithin = (request: {
  readonly context: ProofContext;
  readonly packageManifest: string;
  readonly installList: InstallList;
  readonly proofCases: readonly ProofCase[];
}): Result<null, string> => {
  const temporaryRoot = labelled({
    label: "create the temporary consumer root",
    result: request.context.scratch.createTemporaryDirectory({ prefix: TEMPORARY_PREFIX }),
  });
  if (temporaryRoot.outcome === "failed") {
    return temporaryRoot;
  }
  const proven = provenInside({ ...request, temporaryRoot: temporaryRoot.value });
  const removed = labelled({
    label: "remove the temporary consumer root",
    result: request.context.scratch.removeTree({ path: temporaryRoot.value }),
  });
  return proven.outcome === "failed" ? proven : removed;
};
const packageRootOf = (request: { readonly path: PathPort; readonly moduleUrl: string }): Result<string, string> => {
  const entryPath = request.path.fromFileUrl({ url: request.moduleUrl });
  if (entryPath.outcome === "failed") {
    return { outcome: "failed", error: `FAIL: locate the package root: ${entryPath.error.detail}` };
  }
  return {
    outcome: "ok",
    value: request.path.directoryOf({ path: request.path.directoryOf({ path: entryPath.value }) }),
  };
};

const readPackageFile = (request: { readonly context: ProofContext; readonly name: string }): Result<string, string> =>
  labelled({
    label: `read ${request.name}`,
    result: request.context.fileText.read({
      path: request.context.path.join({ segments: [request.context.packageRoot, request.name] }),
    }),
  });

const proof = (request: { readonly context: ProofContext; readonly proofCases: readonly ProofCase[] }): Result<null, string> => {
  const readme = readPackageFile({ context: request.context, name: "README.md" });
  if (readme.outcome === "failed") {
    return readme;
  }
  const installList = parsedInstallList({ readme: readme.value });
  if (installList.outcome === "failed") {
    return { outcome: "failed", error: `FAIL: README.md install list: ${JSON.stringify(installList.error)}` };
  }
  const packageManifest = readPackageFile({ context: request.context, name: "package.json" });
  if (packageManifest.outcome === "failed") {
    return packageManifest;
  }
  return provenWithin({
    context: request.context,
    packageManifest: packageManifest.value,
    installList: installList.value,
    proofCases: request.proofCases,
  });
};

const proofOutcome = (request: InstallProofRequest): Result<null, string> => {
  const packageRoot = packageRootOf({ path: request.path, moduleUrl: request.moduleUrl });
  if (packageRoot.outcome === "failed") {
    return packageRoot;
  }
  return proof({
    context: {
      process: request.process,
      path: request.path,
      fileText: request.fileText,
      scratch: request.scratch,
      commands: request.commands,
      packageRoot: packageRoot.value,
    },
    proofCases: request.proofCases,
  });
};

export const runInstallProof = (request: InstallProofRequest): Promise<void> => {
  const outcome = proofOutcome(request);
  if (outcome.outcome === "failed") {
    request.process.writeOut({ text: `${outcome.error}\n` });
    request.process.exitWith({ code: 1 });
    return Promise.resolve();
  }
  request.process.writeOut({ text: PASS_LINE });
  request.process.exitWith({ code: 0 });
  return Promise.resolve();
};
