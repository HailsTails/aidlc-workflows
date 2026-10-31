import { type CdSensorResult, cdSensorWireLineOf, cdSensorWireOf, runCdSensor } from "./rin-harness-cd-enforcement.ts";
import { type ConstitutionEngineResolution, resolveConstitutionEngine } from "./rin-harness-config.ts";
import { defaultReviewProcessPort } from "./rin-gates/review-process-port.ts";

const DELEGATED_SCANNED_TEXT = "(constitution.engine is discipline-core: the disciplines sensor applies)";

const delegatedCdSensorResultOf = ({ cdId, scanned }: { readonly cdId: string; readonly scanned: string }): CdSensorResult => ({
  evaluation: "not-evaluated",
  cd: cdId,
  violations: [],
  scanned,
  staleAuthorisedPaths: [],
  staleCarvedPaths: [],
  doublyHeldPaths: [],
});

const unreadableEngineTextOf = ({ reason }: { readonly reason: string }): string =>
  `(constitution.engine could not be read, so no engine was run: ${reason})`;

const projectDirOf = ({
  argumentList,
  environment,
}: {
  readonly argumentList: readonly string[];
  readonly environment: Readonly<Record<string, string | undefined>>;
}): string => {
  const flagIndex = argumentList.indexOf("--project-dir");
  return (flagIndex >= 0 ? argumentList[flagIndex + 1] : undefined) ?? environment["CLAUDE_PROJECT_DIR"] ?? ".";
};

const sensorEngineResolutionOf = ({
  argumentList,
  environment,
}: {
  readonly argumentList: readonly string[];
  readonly environment: Readonly<Record<string, string | undefined>>;
}): ConstitutionEngineResolution =>
  resolveConstitutionEngine({ projectDir: projectDirOf({ argumentList, environment }) });

const unreadableEngineCdWireLineOf = ({ cdId, reason }: { readonly cdId: string; readonly reason: string }): string =>
  `${JSON.stringify({
    ...cdSensorWireOf({ result: delegatedCdSensorResultOf({ cdId, scanned: unreadableEngineTextOf({ reason }) }) }),
    pass: false,
  })}\n`;

const runEngineBoundCdSensor = ({ cdId }: { readonly cdId: string }): never => {
  const processPort = defaultReviewProcessPort();
  const resolution = sensorEngineResolutionOf({
    argumentList: processPort.arguments,
    environment: processPort.environment,
  });
  if (resolution.outcome === "failed") {
    processPort.publish(unreadableEngineCdWireLineOf({ cdId, reason: resolution.reason }));
    return processPort.exit(0);
  }
  if (resolution.constitutionEngine.engine === "discipline-core") {
    processPort.publish(
      cdSensorWireLineOf({ sensorResult: delegatedCdSensorResultOf({ cdId, scanned: DELEGATED_SCANNED_TEXT }) }),
    );
    return processPort.exit(0);
  }
  return runCdSensor({ cdId });
};

export {
  DELEGATED_SCANNED_TEXT,
  delegatedCdSensorResultOf,
  projectDirOf,
  runEngineBoundCdSensor,
  sensorEngineResolutionOf,
  unreadableEngineCdWireLineOf,
  unreadableEngineTextOf,
};
