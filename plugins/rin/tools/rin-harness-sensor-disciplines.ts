import { nearestCheckoutRootOf } from "./rin-checkout-root.ts";
import { runDisciplinesCheck } from "./rin-disciplines-check.ts";
import { type DisciplinesSensorWire, disciplinesSensorWireOf, notEvaluatedWire, unverifiedWireOf } from "./rin-disciplines-sensor.ts";
import { resolveConstitutionEngine } from "./rin-harness-config.ts";
import { projectDirOf } from "./rin-harness-engine-bound-cd-sensor.ts";
import { defaultReviewProcessPort } from "./rin-gates/review-process-port.ts";
import { defaultPathOperations } from "./rin-harness-path-operations.ts";
import { defaultFileKindPort } from "./rin-harness-sidecar-file-reader.ts";

const DISCIPLINES_CHECK_TIMEOUT_MILLISECONDS = 170_000;

const processPort = defaultReviewProcessPort();
const pathOperations = defaultPathOperations();
const fileKind = defaultFileKindPort();

const flagValueOf = ({ flag }: { readonly flag: string }): string | undefined => {
  const flagIndex = processPort.arguments.indexOf(flag);
  return flagIndex >= 0 ? processPort.arguments[flagIndex + 1] : undefined;
};

const publish = (wire: DisciplinesSensorWire): never => {
  processPort.publish(`${JSON.stringify(wire)}\n`);
  return processPort.exit(0);
};

const projectDir = pathOperations.resolve({
  segments: [projectDirOf({ argumentList: processPort.arguments, environment: processPort.environment })],
});
const target = flagValueOf({ flag: "--file-path" }) ?? flagValueOf({ flag: "--output-path" });
const targetPath = target === undefined ? undefined : pathOperations.resolve({ segments: [projectDir, target] });
const checkoutRoot =
  (targetPath === undefined
    ? undefined
    : nearestCheckoutRootOf({ directory: pathOperations.dirname({ path: targetPath }), ports: { pathOperations, fileKind } })) ??
  projectDir;
const resolution = resolveConstitutionEngine({ projectDir: checkoutRoot });

if (resolution.outcome === "failed") {
  publish(unverifiedWireOf({ reason: resolution.reason }));
}
if (resolution.outcome === "resolved" && resolution.constitutionEngine.engine === "discipline-core") {
  const targetFile =
    targetPath === undefined
      ? "(project)"
      : pathOperations.relative({ from: checkoutRoot, to: targetPath }).replaceAll("\\", "/");
  publish(
    disciplinesSensorWireOf({
      outcome: runDisciplinesCheck({
        request: { checkoutRoot, baseRevision: resolution.constitutionEngine.baseRevision },
        ports: {
          runSync: processPort.runSync,
          pathOperations,
          fileKind,
          timeoutMilliseconds: DISCIPLINES_CHECK_TIMEOUT_MILLISECONDS,
        },
      }),
      targetFile,
    }),
  );
}
publish(notEvaluatedWire);
