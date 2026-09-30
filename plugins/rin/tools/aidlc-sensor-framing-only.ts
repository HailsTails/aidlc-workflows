import { programmingFenceFindings } from "./rin-gates/rin-gates-framing-only.ts";
import { GATE_TWO_STAGE } from "./rin-gates/rin-gates-record-paths.ts";
import { defaultSensorFileReader } from "./rin-gates/rin-gates-sensor-file-reader.ts";
import { sensorInvocationFrom } from "./rin-gates/rin-gates-sensor-invocation.ts";
import {
  judgedReport,
  renderSensorReport,
  type SensorFileReader,
  type SensorReport,
  type UnmeasuredCause,
  unmeasuredFinding,
  unmeasuredReport,
} from "./rin-gates/rin-gates-sensor-report.ts";
import {
  defaultSensorRuntime,
  type SensorRuntime,
} from "./rin-gates/rin-gates-sensor-runtime.ts";

type FramingOnlyInputs = {
  readonly commandLineArguments: readonly string[];
  readonly fileReader: SensorFileReader;
};

const FRAMING_ONLY_SENSOR = "framing-only";

const artefactNameOf = ({ path }: { readonly path: string }): string =>
  path.split(/[\\/]/).pop() ?? path;

const unmeasuredSensorReport = ({
  artefact,
  reason,
  cause,
}: {
  readonly artefact: string;
  readonly reason: string;
  readonly cause: UnmeasuredCause;
}): SensorReport =>
  unmeasuredReport({
    sensor: FRAMING_ONLY_SENSOR,
    findings: [
      unmeasuredFinding({
        check: FRAMING_ONLY_SENSOR,
        artefact,
        reason,
        cause,
      }),
    ],
    scanned: artefact,
  });

const evaluateFramingOnly = ({
  commandLineArguments,
  fileReader,
}: FramingOnlyInputs): SensorReport => {
  const invocation = sensorInvocationFrom({ commandLineArguments });
  if (invocation.kind === "incomplete") {
    return unmeasuredSensorReport({
      artefact: "(none)",
      reason: `missing ${invocation.missingFlags.join(", ")}`,
      cause: "incomplete-invocation",
    });
  }
  const artefact = artefactNameOf({ path: invocation.outputPath });
  if (invocation.stage !== GATE_TWO_STAGE) {
    return unmeasuredSensorReport({
      artefact,
      reason: `framing-only judges Gate 2 (${GATE_TWO_STAGE}) only, and was invoked at ${invocation.stage}`,
      cause: "wrong-gate",
    });
  }
  const artefactRead = fileReader.readText({ path: invocation.outputPath });
  if (artefactRead.kind === "unreadable") {
    return unmeasuredSensorReport({
      artefact,
      reason: `${artefact} is unreadable (${artefactRead.reason})`,
      cause: "input-unavailable",
    });
  }
  if (artefactRead.kind === "absent") {
    return unmeasuredSensorReport({
      artefact,
      reason: `${artefact} is absent`,
      cause: "input-unavailable",
    });
  }
  return judgedReport({
    sensor: FRAMING_ONLY_SENSOR,
    findings: programmingFenceFindings({
      artefact,
      markdownText: artefactRead.text,
    }),
    scanned: `${artefact} at ${invocation.stage}`,
  });
};

const runFramingOnly = ({
  commandLineArguments,
  fileReader,
  runtime,
}: {
  readonly commandLineArguments: readonly string[];
  readonly fileReader: SensorFileReader;
  readonly runtime: SensorRuntime;
}): void => {
  runtime.writeOutput({
    text: renderSensorReport({
      report: evaluateFramingOnly({ commandLineArguments, fileReader }),
    }),
  });
};

const main = (commandLineArguments: string[]): void => {
  runFramingOnly({
    commandLineArguments,
    fileReader: defaultSensorFileReader(),
    runtime: defaultSensorRuntime(),
  });
};

if (import.meta.main) {
  const runtime = defaultSensorRuntime();
  runFramingOnly({
    commandLineArguments: runtime.commandLineArguments(),
    fileReader: defaultSensorFileReader(),
    runtime,
  });
}

export { evaluateFramingOnly, type FramingOnlyInputs, main, runFramingOnly };
