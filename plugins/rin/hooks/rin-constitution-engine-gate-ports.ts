import { nearestCheckoutRootOf } from "../tools/rin-checkout-root.ts";
import { runDisciplinesCheck } from "../tools/rin-disciplines-check.ts";
import { defaultReviewProcessPort, type ReviewProcessPort } from "../tools/rin-gates/review-process-port.ts";
import { defaultPathOperations, type PathOperations } from "../tools/rin-harness-path-operations.ts";
import { defaultFileKindPort, type FileKindPort } from "../tools/rin-harness-sidecar-file-reader.ts";
import {
  type ConstitutionGatePorts,
  checkoutPluginPathOf,
  engineReadingOf,
  type EngineReading,
  type WalkerGateOutcome,
  walkerGateOutcomeOf,
} from "./rin-constitution-engine-gate-decision.ts";

type GateRuntime = {
  readonly process: ReviewProcessPort;
  readonly pathOperations: PathOperations;
  readonly fileKind: FileKindPort;
  readonly hookDirectory: string;
};

type AppendGateRun = typeof import("../tools/rin-harness-gate-runs.ts").appendGateRun;

const ENGINE_READ_TIMEOUT_MILLISECONDS = 60_000;

const WALKER_GATE_TIMEOUT_MILLISECONDS = 400_000;

const DISCIPLINES_CHECK_TIMEOUT_MILLISECONDS = 180_000;

const checkoutRootOf =
  (runtime: GateRuntime): ConstitutionGatePorts["checkoutRootOf"] =>
  ({ commandCwd }) =>
    commandCwd === undefined || commandCwd === ""
      ? undefined
      : nearestCheckoutRootOf({
          directory: runtime.pathOperations.resolve({ segments: [commandCwd] }),
          ports: { pathOperations: runtime.pathOperations, fileKind: runtime.fileKind },
        });

const checkoutPluginFileOf = ({
  runtime,
  checkoutRoot,
  pluginPath,
}: {
  readonly runtime: GateRuntime;
  readonly checkoutRoot: string;
  readonly pluginPath: readonly string[];
}): string =>
  checkoutPluginPathOf({
    hookDirectory: runtime.hookDirectory,
    checkoutRoot,
    pluginPath,
    pathOperations: runtime.pathOperations,
  });

const missingPluginFileReasonOf = ({ path }: { readonly path: string }): string =>
  `${path} does not exist; sync the rin plugin into this checkout and install its packages there`;

const readEngine =
  (runtime: GateRuntime): ConstitutionGatePorts["readEngine"] =>
  ({ checkoutRoot }): EngineReading => {
    const configToolPath = checkoutPluginFileOf({ runtime, checkoutRoot, pluginPath: ["tools", "rin-harness-config.ts"] });
    if (!runtime.fileKind.isFile(configToolPath)) {
      return { kind: "unavailable", reason: missingPluginFileReasonOf({ path: configToolPath }) };
    }
    const output = runtime.process.runSync({
      program: "bun",
      args: [configToolPath, "constitution-engine"],
      cwd: checkoutRoot,
      environment: { ...runtime.process.environment, CLAUDE_PROJECT_DIR: checkoutRoot },
      timeoutMilliseconds: ENGINE_READ_TIMEOUT_MILLISECONDS,
    });
    return engineReadingOf({ configToolPath, output });
  };

const runWalkerGate =
  (runtime: GateRuntime): ConstitutionGatePorts["runWalkerGate"] =>
  ({ checkoutRoot, hookInput }): WalkerGateOutcome => {
    const walkerGatePath = checkoutPluginFileOf({ runtime, checkoutRoot, pluginPath: ["hooks", "rin-constitution-gate.ts"] });
    if (!runtime.fileKind.isFile(walkerGatePath)) {
      return { kind: "unverified", reason: missingPluginFileReasonOf({ path: walkerGatePath }) };
    }
    const output = runtime.process.runSync({
      program: "bun",
      args: [walkerGatePath],
      cwd: checkoutRoot,
      input: hookInput,
      environment: { ...runtime.process.environment, CLAUDE_PROJECT_DIR: checkoutRoot },
      timeoutMilliseconds: WALKER_GATE_TIMEOUT_MILLISECONDS,
    });
    return walkerGateOutcomeOf({ walkerGatePath, output });
  };

const stageOf = ({ command }: { readonly command: string }): string =>
  command.match(/--stage\s+([A-Za-z0-9._-]+)/)?.[1] ?? "ungrouped";

const stageResultOf = ({ command }: { readonly command: string }): string =>
  command.match(/--result\s+(approved|completed)/)?.[1] ?? "unknown";

const checkoutAppendGateRunOf = async ({
  runtime,
  checkoutRoot,
}: {
  readonly runtime: GateRuntime;
  readonly checkoutRoot: string;
}): Promise<AppendGateRun> => {
  const gateRunsModule: { readonly appendGateRun: AppendGateRun } = await import(
    checkoutPluginFileOf({ runtime, checkoutRoot, pluginPath: ["tools", "rin-harness-gate-runs.ts"] })
  );
  return gateRunsModule.appendGateRun;
};

const recordGateRun =
  (runtime: GateRuntime): ConstitutionGatePorts["recordGateRun"] =>
  async ({ command, checkoutRoot, verdict }) => {
    try {
      const appendGateRun = await checkoutAppendGateRunOf({ runtime, checkoutRoot });
      appendGateRun({
        projectDir: checkoutRoot,
        stage: stageOf({ command }),
        result: stageResultOf({ command }),
        command,
        verdict,
        timestamp: runtime.process.timestamp(),
      });
    } catch {
      return;
    }
  };

const defaultConstitutionGatePorts = ({ hookModuleUrl }: { readonly hookModuleUrl: string }): ConstitutionGatePorts => {
  const pathOperations = defaultPathOperations();
  const runtime: GateRuntime = {
    process: defaultReviewProcessPort(),
    pathOperations,
    fileKind: defaultFileKindPort(),
    hookDirectory: pathOperations.dirname({ path: pathOperations.fromFileUrl({ url: hookModuleUrl }) }),
  };
  return {
    checkoutRootOf: checkoutRootOf(runtime),
    readEngine: readEngine(runtime),
    runWalkerGate: runWalkerGate(runtime),
    runDisciplinesCheck: (request) =>
      runDisciplinesCheck({
        request,
        ports: {
          runSync: runtime.process.runSync,
          pathOperations,
          fileKind: runtime.fileKind,
          timeoutMilliseconds: DISCIPLINES_CHECK_TIMEOUT_MILLISECONDS,
        },
      }),
    recordGateRun: recordGateRun(runtime),
  };
};

export { defaultConstitutionGatePorts };
