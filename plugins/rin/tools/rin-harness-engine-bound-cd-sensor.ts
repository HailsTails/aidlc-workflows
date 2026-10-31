import { type CdSensorResult, cdSensorWireLineOf, runCdSensor } from "./rin-harness-cd-enforcement.ts";
import { resolveConstitutionEngine } from "./rin-harness-config.ts";
import { defaultReviewProcessPort } from "./rin-gates/review-process-port.ts";

const DELEGATED_SCANNED_TEXT = "(constitution.engine is discipline-core: the disciplines sensor applies)";

const delegatedCdSensorResultOf = ({ cdId }: { readonly cdId: string }): CdSensorResult => ({
  evaluation: "not-evaluated",
  cd: cdId,
  violations: [],
  scanned: DELEGATED_SCANNED_TEXT,
  staleAuthorisedPaths: [],
  staleCarvedPaths: [],
  doublyHeldPaths: [],
});

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

const runEngineBoundCdSensor = ({ cdId }: { readonly cdId: string }): never => {
  const processPort = defaultReviewProcessPort();
  const resolution = resolveConstitutionEngine({
    projectDir: projectDirOf({ argumentList: processPort.arguments, environment: processPort.environment }),
  });
  if (resolution.outcome === "resolved" && resolution.constitutionEngine.engine === "discipline-core") {
    processPort.publish(cdSensorWireLineOf({ sensorResult: delegatedCdSensorResultOf({ cdId }) }));
    return processPort.exit(0);
  }
  return runCdSensor({ cdId });
};

export { DELEGATED_SCANNED_TEXT, delegatedCdSensorResultOf, projectDirOf, runEngineBoundCdSensor };
