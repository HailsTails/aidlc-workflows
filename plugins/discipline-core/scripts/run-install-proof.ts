import type { FileTextPort } from "../core/platform-ports/file-text-port.ts";
import type { PathPort } from "../core/platform-ports/path-port.ts";
import type { ProcessPort } from "../core/platform-ports/process-port.ts";
import type { Result } from "../core/values/result.ts";
import {
  type CommandScript,
  CONSUMER_MANIFEST,
  type ExclusionRule,
  entryDisposition,
  exclusionRules,
  type InstallList,
  type InstallPlacement,
  installPlacements,
  intoRootPlacements,
  judgedStep,
  PACKAGED_CONSUMER_NPMRC,
  PACKAGED_SCRIPTS,
  packagedConsumerManifest,
  type ProofAction,
  type InstallRoute,
  type ProofCase,
  type ProofToolchain,
  parsedInstallList,
  type ReportExpectation,
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

type PackageArtefact = { readonly packed: "yes"; readonly tarball: string } | { readonly packed: "no" };

type Step = () => Result<null, string>;

type Reports = readonly string[];

type RecordedReports = Readonly<Record<string, Reports>>;

type ExpectedReports =
  | { readonly kind: "recorded" }
  | { readonly kind: "same-as"; readonly consumer: string; readonly reports: Reports };

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
const NPM_INSTALL_TARBALL = ["install", "--offline", "--no-audit", "--no-fund", "--ignore-scripts", "--save-dev"];
const NPM_RUN_SILENT = ["run", "--silent"];
const SOURCE_MODULE_SUFFIX = ".ts";
const NPM_CONFIG = ".npmrc";
const COPIED_COMMANDS: Readonly<Record<CommandScript, string>> = {
  check: "check-command.ts",
  project: "project-command.ts",
};

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

const NO_REPORTS: Result<Reports, string> = { outcome: "ok", value: [] };

const emptiedReports = (request: { readonly result: Result<unknown, string> }): Result<Reports, string> =>
  request.result.outcome === "failed" ? request.result : NO_REPORTS;

const comparedReport = (request: {
  readonly label: string;
  readonly expected: ExpectedReports;
  readonly index: number;
  readonly output: string;
}): Result<string, string> => {
  if (request.expected.kind === "recorded") {
    return { outcome: "ok", value: "" };
  }
  const twin = request.expected.reports[request.index];
  return twin === request.output
    ? { outcome: "ok", value: `, and the same report as ${request.expected.consumer}` }
    : {
        outcome: "failed",
        error: `FAIL: ${request.label}: its report differs from ${request.expected.consumer}'s\n--- ${request.expected.consumer}\n${twin ?? "(no report)"}\n--- ${request.label}\n${request.output}`,
      };
};

const expectedReportsOf = (request: {
  readonly consumer: string;
  readonly reports: ReportExpectation;
  readonly recorded: RecordedReports;
}): Result<ExpectedReports, string> => {
  if (request.reports.kind === "recorded") {
    return { outcome: "ok", value: { kind: "recorded" } };
  }
  const twin = request.recorded[request.reports.consumer];
  return twin === undefined
    ? {
        outcome: "failed",
        error: `FAIL: ${request.consumer}: no report of ${request.reports.consumer} was recorded to compare with; prove ${request.reports.consumer} first`,
      }
    : { outcome: "ok", value: { kind: "same-as", consumer: request.reports.consumer, reports: twin } };
};

const commandRun = (request: {
  readonly context: ProofContext;
  readonly repo: string;
  readonly route: InstallRoute;
  readonly script: CommandScript;
  readonly arguments: readonly string[];
}): StepRun => {
  switch (request.route) {
    case "copy":
      return request.context.commands.run({
        command: "node",
        arguments: [
          request.context.path.join({
            segments: [request.repo, ...INSTALL_DIRECTORY, "core", "check", COPIED_COMMANDS[request.script]],
          }),
          "--repo",
          request.repo,
          ...request.arguments,
        ],
        directory: request.repo,
      });
    case "package":
      return request.context.commands.run({
        command: "npm",
        arguments: [...NPM_RUN_SILENT, PACKAGED_SCRIPTS[request.script], ...(request.arguments.length === 0 ? [] : ["--", ...request.arguments])],
        directory: request.repo,
      });
  }
};

const installedCommand = (request: {
  readonly context: ProofContext;
  readonly repo: string;
  readonly route: InstallRoute;
  readonly label: string;
  readonly script: CommandScript;
  readonly arguments: readonly string[];
  readonly action: Extract<ProofAction, { readonly kind: "check" | "project" }>;
  readonly expected: ExpectedReports;
  readonly index: number;
}): Result<Reports, string> => {
  const run = commandRun(request);
  const judged = judgedStep({ label: request.label, expectation: request.action.expectation, run });
  if (judged.outcome === "failed") {
    return judged;
  }
  const output = run.outcome === "exited" ? run.output : "";
  const compared = comparedReport({ label: request.label, expected: request.expected, index: request.index, output });
  if (compared.outcome === "failed") {
    return compared;
  }
  request.context.process.writeOut({ text: `${judged.value}${compared.value}\n` });
  return { outcome: "ok", value: [output] };
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
  readonly route: InstallRoute;
  readonly action: ProofAction;
  readonly expected: ExpectedReports;
  readonly index: number;
}): Result<Reports, string> => {
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
      return installedCommand({
        ...request,
        label: `${request.consumer} project`,
        script: "project",
        arguments: [],
        action,
      });
    case "remove":
      return emptiedReports({
        result: removedPath({
          context: request.context,
          label: `remove ${action.path} in ${request.consumer}`,
          path: request.context.path.join({ segments: [request.repo, action.path] }),
        }),
      });
    case "commit":
      return emptiedReports({
        result: commitAll({
          context: request.context,
          repo: request.repo,
          consumer: request.consumer,
          message: action.message,
        }),
      });
    case "read":
      return emptiedReports({
        result: readHolding({
          context: request.context,
          label: `${request.consumer} ${action.path} holds ${action.contains}`,
          path: request.context.path.join({ segments: [request.repo, action.path] }),
          contains: action.contains,
        }),
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

type ConsumerFile = { readonly name: string; readonly text: string };

const COPIED_CONSUMER_FILES: readonly ConsumerFile[] = [
  { name: "package.json", text: CONSUMER_MANIFEST },
  { name: ".gitignore", text: IGNORED_INSTALLS },
];

const PACKAGED_CONSUMER_FILES: readonly ConsumerFile[] = [
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

type CaseRequest = {
  readonly context: ProofContext;
  readonly temporaryRoot: string;
  readonly installList: InstallList;
  readonly rules: readonly ExclusionRule[];
  readonly artefact: PackageArtefact;
  readonly proofCase: ProofCase;
  readonly recorded: RecordedReports;
};

const consumerRepo = (request: CaseRequest): string =>
  request.context.path.join({ segments: [request.temporaryRoot, request.proofCase.toolchain, request.proofCase.consumer] });

const consumerFixture = (request: CaseRequest): string =>
  request.context.path.join({
    segments: [request.context.packageRoot, "tests", "test-fixtures", "consumer-proof", request.proofCase.mechanism],
  });

const ranActions = (request: CaseRequest & { readonly repo: string }): Result<Reports, string> => {
  const expected = expectedReportsOf({
    consumer: request.proofCase.consumer,
    reports: request.proofCase.reports,
    recorded: request.recorded,
  });
  if (expected.outcome === "failed") {
    return expected;
  }
  return request.proofCase.actions.reduce<Result<Reports, string>>((sofar, action) => {
    if (sofar.outcome === "failed") {
      return sofar;
    }
    const performed = performedAction({
      context: request.context,
      repo: request.repo,
      consumer: request.proofCase.consumer,
      route: request.proofCase.route,
      action,
      expected: expected.value,
      index: sofar.value.length,
    });
    return performed.outcome === "failed" ? performed : { outcome: "ok", value: [...sofar.value, ...performed.value] };
  }, NO_REPORTS);
};

const preparedThenRan = (request: CaseRequest & { readonly repo: string; readonly steps: readonly Step[] }): Result<Reports, string> => {
  const prepared = inOrder({ steps: request.steps });
  return prepared.outcome === "failed" ? prepared : ranActions(request);
};

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

const provenPackagedCase = (request: CaseRequest): Result<Reports, string> => {
  if (request.artefact.packed === "no") {
    return { outcome: "failed", error: `FAIL: ${request.proofCase.consumer}: no package was packed to install` };
  }
  const context = request.context;
  const consumer = request.proofCase.consumer;
  const repo = consumerRepo(request);
  const tarball = request.artefact.tarball;
  return preparedThenRan({
    ...request,
    repo,
    steps: [
      () => preparedConsumer({ context, fixture: consumerFixture(request), repo, files: PACKAGED_CONSUMER_FILES }),
      () =>
        ranCommand({
          context,
          label: `npm install the packed tarball into ${consumer}`,
          command: "npm",
          arguments: [...NPM_INSTALL_TARBALL, tarball],
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
    ],
  });
};

const provenCopiedCase = (request: CaseRequest): Result<Reports, string> => {
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
  const repo = consumerRepo(request);
  const installDirectory = context.path.join({ segments: [repo, ...INSTALL_DIRECTORY] });
  return preparedThenRan({
    ...request,
    repo,
    steps: [
      () => preparedConsumer({ context, fixture: consumerFixture(request), repo, files: COPIED_CONSUMER_FILES }),
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
    ],
  });
};

const provenCase = (request: CaseRequest): Result<Reports, string> => {
  switch (request.proofCase.route) {
    case "copy":
      return provenCopiedCase(request);
    case "package":
      return provenPackagedCase(request);
  }
};

const toolchainsOf = (request: { readonly proofCases: readonly ProofCase[] }): readonly ProofToolchain[] => [
  ...new Set(request.proofCases.map((proofCase) => proofCase.toolchain)),
];

const provenCases = (request: {
  readonly context: ProofContext;
  readonly temporaryRoot: string;
  readonly installList: InstallList;
  readonly artefact: PackageArtefact;
  readonly proofCases: readonly ProofCase[];
}): Result<RecordedReports, string> => {
  const rules = exclusionRules({ leftOut: request.installList.leftOut });
  return request.proofCases.reduce<Result<RecordedReports, string>>((sofar, proofCase) => {
    if (sofar.outcome === "failed") {
      return sofar;
    }
    const reports = provenCase({
      context: request.context,
      temporaryRoot: request.temporaryRoot,
      installList: request.installList,
      rules,
      artefact: request.artefact,
      proofCase,
      recorded: sofar.value,
    });
    return reports.outcome === "failed" ? reports : { outcome: "ok", value: { ...sofar.value, [proofCase.consumer]: reports.value } };
  }, { outcome: "ok", value: {} });
};

const provenInside = (request: {
  readonly context: ProofContext;
  readonly temporaryRoot: string;
  readonly packageManifest: string;
  readonly installList: InstallList;
  readonly artefact: PackageArtefact;
  readonly proofCases: readonly ProofCase[];
}): Result<null, string> =>
  inOrder({
    steps: [
      ...toolchainsOf(request).map(
        (toolchain): Step =>
          () =>
            installedToolchain({ ...request, toolchain }),
      ),
      () => emptied({ result: provenCases(request) }),
    ],
  });

const packedArtefact = (request: {
  readonly context: ProofContext;
  readonly packer: TarballPackerPort;
  readonly temporaryRoot: string;
  readonly proofCases: readonly ProofCase[];
}): Promise<Result<PackageArtefact, string>> =>
  request.proofCases.some((proofCase) => proofCase.route === "package")
    ? request.packer
        .pack({
          packageRoot: request.context.packageRoot,
          workRoot: request.temporaryRoot,
          dependencies: request.context.path.join({ segments: [request.temporaryRoot, CORE_PACKAGES, NODE_MODULES] }),
        })
        .then((tarball) => (tarball.outcome === "failed" ? tarball : { outcome: "ok", value: { packed: "yes", tarball: tarball.value } }))
    : Promise.resolve({ outcome: "ok", value: { packed: "no" } });

const provenWithArtefact = async (request: {
  readonly context: ProofContext;
  readonly packer: TarballPackerPort;
  readonly temporaryRoot: string;
  readonly packageManifest: string;
  readonly installList: InstallList;
  readonly proofCases: readonly ProofCase[];
}): Promise<Result<null, string>> => {
  const staged = stagedCorePackages(request);
  if (staged.outcome === "failed") {
    return staged;
  }
  const artefact = await packedArtefact(request);
  return artefact.outcome === "failed" ? artefact : provenInside({ ...request, artefact: artefact.value });
};

const provenWithin = async (request: {
  readonly context: ProofContext;
  readonly packer: TarballPackerPort;
  readonly packageManifest: string;
  readonly installList: InstallList;
  readonly proofCases: readonly ProofCase[];
}): Promise<Result<null, string>> => {
  const temporaryRoot = labelled({
    label: "create the temporary consumer root",
    result: request.context.scratch.createTemporaryDirectory({ prefix: TEMPORARY_PREFIX }),
  });
  if (temporaryRoot.outcome === "failed") {
    return temporaryRoot;
  }
  const proven = await provenWithArtefact({ ...request, temporaryRoot: temporaryRoot.value });
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
  const readme = readPackageFile({ context: request.context, name: "README.md" });
  if (readme.outcome === "failed") {
    return Promise.resolve(readme);
  }
  const installList = parsedInstallList({ readme: readme.value });
  if (installList.outcome === "failed") {
    return Promise.resolve({ outcome: "failed", error: `FAIL: README.md install list: ${JSON.stringify(installList.error)}` });
  }
  const packageManifest = readPackageFile({ context: request.context, name: "package.json" });
  if (packageManifest.outcome === "failed") {
    return Promise.resolve(packageManifest);
  }
  return provenWithin({
    context: request.context,
    packer: request.packer,
    packageManifest: packageManifest.value,
    installList: installList.value,
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
