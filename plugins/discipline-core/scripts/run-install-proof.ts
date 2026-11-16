import type { FileTextPort } from "../core/platform-ports/file-text-port.ts";
import type { PathPort } from "../core/platform-ports/path-port.ts";
import type { ProcessPort } from "../core/platform-ports/process-port.ts";
import type { Result } from "../core/values/result.ts";
import {
  type CommandScript,
  judgedStep,
  PACKAGED_CONSUMER_NPMRC,
  PACKAGED_SCRIPTS,
  packagedConsumerManifest,
  type ProofAction,
  type ProofCase,
  type ProofToolchain,
  type StepRun,
  toolchainManifest,
} from "./install-proof-plan.ts";
import type { CommandRunPort, ProofCommand, ScratchFilesPort } from "./install-proof-ports.ts";
import type { TarballPackerPort } from "./package-commands.ts";
import { PACKAGE_IDENTITY } from "./package-identity.ts";

export type InstallProofRequest = {
  readonly process: ProcessPort;
  readonly path: PathPort;
  readonly fileText: FileTextPort;
  readonly scratch: ScratchFilesPort;
  readonly commands: CommandRunPort;
  readonly packer: TarballPackerPort;
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
const TEMPORARY_PREFIX = "discipline-core-install-proof-";
const GIT_IDENTITY = ["-c", "user.name=proof", "-c", "user.email=proof@invalid", "-c", "commit.gpgsign=false"];
const NPM_INSTALL = ["install", "--no-audit", "--no-fund", "--ignore-scripts"];
const NODE_MODULES = "node_modules";
const PASS_LINE = "install proof: pass\n";
const NPM_INSTALL_TARBALL = ["install", "--offline", "--no-audit", "--no-fund", "--ignore-scripts", "--save-dev"];
const NPM_RUN_SILENT = ["run", "--silent"];
const SOURCE_MODULE_SUFFIX = ".ts";
const NPM_CONFIG = ".npmrc";
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

const commandRun = (request: {
  readonly context: ProofContext;
  readonly repo: string;
  readonly script: CommandScript;
  readonly arguments: readonly string[];
}): StepRun =>
  request.context.commands.run({
    command: "npm",
    arguments: [...NPM_RUN_SILENT, PACKAGED_SCRIPTS[request.script], ...(request.arguments.length === 0 ? [] : ["--", ...request.arguments])],
    directory: request.repo,
  });

const installedCommand = (request: {
  readonly context: ProofContext;
  readonly repo: string;
  readonly label: string;
  readonly script: CommandScript;
  readonly arguments: readonly string[];
  readonly action: Extract<ProofAction, { readonly kind: "check" | "project" }>;
}): Result<null, string> => {
  const judged = judgedStep({ label: request.label, expectation: request.action.expectation, run: commandRun(request) });
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

const readHolding = (request: {
  readonly context: ProofContext;
  readonly label: string;
  readonly path: string;
  readonly contains: string;
}): Result<null, string> => {
  const text = labelled({ label: request.label, result: request.context.fileText.read({ path: request.path }) });
  if (text.outcome === "failed") {
    return text;
  }
  if (!text.value.includes(request.contains)) {
    return { outcome: "failed", error: `FAIL: ${request.label}, but it reads\n${text.value}` };
  }
  request.context.process.writeOut({ text: `ok: ${request.label}\n` });
  return SUCCEEDED;
};

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
        ...request,
        label: `${request.consumer} check`,
        script: "check",
        arguments: ["--base-revision", "HEAD"],
        action,
      });
    case "project":
      return installedCommand({ ...request, label: `${request.consumer} project`, script: "project", arguments: [], action });
    case "remove":
      return removedPath({
        context: request.context,
        label: `remove ${action.path} in ${request.consumer}`,
        path: request.context.path.join({ segments: [request.repo, action.path] }),
      });
    case "commit":
      return commitAll({ context: request.context, repo: request.repo, consumer: request.consumer, message: action.message });
    case "read":
      return readHolding({
        context: request.context,
        label: `${request.consumer} ${action.path} holds ${action.contains}`,
        path: request.context.path.join({ segments: [request.repo, action.path] }),
        contains: action.contains,
      });
  }
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

type ConsumerFile = { readonly name: string; readonly text: string };

const CONSUMER_FILES: readonly ConsumerFile[] = [
  { name: "package.json", text: packagedConsumerManifest({ identity: PACKAGE_IDENTITY }) },
  { name: ".gitignore", text: IGNORED_INSTALLS },
  { name: NPM_CONFIG, text: PACKAGED_CONSUMER_NPMRC },
];
const preparedConsumer = (request: {
  readonly context: ProofContext;
  readonly fixture: string;
  readonly repo: string;
  readonly files: readonly ConsumerFile[];
}): Result<null, string> => {
  const label = `prepare the consumer ${request.repo}`;
  return inOrder({
    steps: [
      () =>
        labelled({
          label,
          result: request.context.scratch.copyTree({ from: request.fixture, to: request.repo, disposition: () => "kept" }),
        }),
      ...request.files.map(
        (file): Step =>
          () =>
            writtenFile({
              context: request.context,
              label,
              path: request.context.path.join({ segments: [request.repo, file.name] }),
              text: file.text,
            }),
      ),
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

type CaseRequest = {
  readonly context: ProofContext;
  readonly temporaryRoot: string;
  readonly tarball: string;
  readonly proofCase: ProofCase;
};

const consumerRepo = (request: CaseRequest): string =>
  request.context.path.join({ segments: [request.temporaryRoot, request.proofCase.toolchain, request.proofCase.consumer] });

const consumerFixture = (request: CaseRequest): string =>
  request.context.path.join({
    segments: [request.context.packageRoot, "tests", "test-fixtures", "consumer-proof", request.proofCase.mechanism],
  });
const packageShipsNoSource = (request: {
  readonly context: ProofContext;
  readonly consumer: string;
  readonly installedPackage: string;
}): Result<null, string> => {
  const label = `${request.consumer} installed package holds no TypeScript source to strip`;
  const listed = labelled({ label, result: request.context.scratch.listTree({ path: request.installedPackage }) });
  if (listed.outcome === "failed") {
    return listed;
  }
  const sources = listed.value.filter((entry) => entry.entryKind === "file" && entry.name.endsWith(SOURCE_MODULE_SUFFIX));
  const modules = listed.value.filter((entry) => entry.entryKind === "file" && entry.name.endsWith(".js"));
  if (sources.length > 0 || modules.length === 0) {
    return {
      outcome: "failed",
      error: `FAIL: ${label}: found ${sources.length} .ts and ${modules.length} .js files under ${request.installedPackage}`,
    };
  }
  request.context.process.writeOut({ text: `ok: ${label}\n` });
  return SUCCEEDED;
};

const provenCase = (request: CaseRequest): Result<null, string> => {
  const context = request.context;
  const consumer = request.proofCase.consumer;
  const repo = consumerRepo(request);
  return inOrder({
    steps: [
      () => preparedConsumer({ context, fixture: consumerFixture(request), repo, files: CONSUMER_FILES }),
      () =>
        ranCommand({
          context,
          label: `npm install the packed tarball into ${consumer}`,
          command: "npm",
          arguments: [...NPM_INSTALL_TARBALL, request.tarball],
          directory: repo,
        }),
      () =>
        packageShipsNoSource({
          context,
          consumer,
          installedPackage: context.path.join({ segments: [repo, NODE_MODULES, ...PACKAGE_IDENTITY.name.split("/")] }),
        }),
      () => git({ context, repo, consumer, arguments: ["init", "-q"] }),
      () => commitAll({ context, repo, consumer, message: "consumer" }),
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
  readonly tarball: string;
  readonly proofCases: readonly ProofCase[];
}): Result<null, string> =>
  inOrder({
    steps: [
      ...toolchainsOf(request).map(
        (toolchain): Step =>
          () =>
            installedToolchain({ ...request, toolchain }),
      ),
      ...request.proofCases.map(
        (proofCase): Step =>
          () =>
            provenCase({ ...request, proofCase }),
      ),
    ],
  });

const provenWithTarball = async (request: {
  readonly context: ProofContext;
  readonly packer: TarballPackerPort;
  readonly temporaryRoot: string;
  readonly packageManifest: string;
  readonly proofCases: readonly ProofCase[];
}): Promise<Result<null, string>> => {
  const tarball = await request.packer.pack({ packageRoot: request.context.packageRoot, workRoot: request.temporaryRoot });
  return tarball.outcome === "failed" ? tarball : provenInside({ ...request, tarball: tarball.value });
};

const provenWithin = async (request: {
  readonly context: ProofContext;
  readonly packer: TarballPackerPort;
  readonly packageManifest: string;
  readonly proofCases: readonly ProofCase[];
}): Promise<Result<null, string>> => {
  const temporaryRoot = labelled({
    label: "create the temporary consumer root",
    result: request.context.scratch.createTemporaryDirectory({ prefix: TEMPORARY_PREFIX }),
  });
  if (temporaryRoot.outcome === "failed") {
    return temporaryRoot;
  }
  const proven = await provenWithTarball({ ...request, temporaryRoot: temporaryRoot.value });
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

const proof = (request: {
  readonly context: ProofContext;
  readonly packer: TarballPackerPort;
  readonly proofCases: readonly ProofCase[];
}): Promise<Result<null, string>> => {
  const packageManifest = readPackageFile({ context: request.context, name: "package.json" });
  if (packageManifest.outcome === "failed") {
    return Promise.resolve(packageManifest);
  }
  return provenWithin({
    context: request.context,
    packer: request.packer,
    packageManifest: packageManifest.value,
    proofCases: request.proofCases,
  });
};
const proofOutcome = (request: InstallProofRequest): Promise<Result<null, string>> => {
  const packageRoot = packageRootOf({ path: request.path, moduleUrl: request.moduleUrl });
  if (packageRoot.outcome === "failed") {
    return Promise.resolve(packageRoot);
  }
  return proof({
    packer: request.packer,
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

export const runInstallProof = async (request: InstallProofRequest): Promise<void> => {
  const outcome = await proofOutcome(request);
  if (outcome.outcome === "failed") {
    request.process.writeOut({ text: `${outcome.error}\n` });
    request.process.exitWith({ code: 1 });
    return;
  }
  request.process.writeOut({ text: PASS_LINE });
  request.process.exitWith({ code: 0 });
};
