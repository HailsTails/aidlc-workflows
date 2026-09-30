import { parseOptionsLedger } from "./rin-gates/rin-gates-options-ledger.ts";
import {
  GATE_TWO_STAGE,
  OPTIONS_LEDGER_FILE,
  optionsLedgerPathFor,
} from "./rin-gates/rin-gates-record-paths.ts";
import { defaultSensorFileReader } from "./rin-gates/rin-gates-sensor-file-reader.ts";
import {
  recordLocationFor,
  sensorInvocationFrom,
} from "./rin-gates/rin-gates-sensor-invocation.ts";
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
import {
  ABSENT_LEDGER_FINDINGS,
  ledgerShapeFindings,
} from "./rin-gates/rin-gates-solution-options.ts";

type SolutionOptionsInputs = {
  readonly commandLineArguments: readonly string[];
  readonly projectDirectory: string;
  readonly fileReader: SensorFileReader;
};

const SOLUTION_OPTIONS_SENSOR = "solution-options";

const unmeasuredSensorReport = ({
  reason,
  cause,
}: {
  readonly reason: string;
  readonly cause: UnmeasuredCause;
}): SensorReport =>
  unmeasuredReport({
    sensor: SOLUTION_OPTIONS_SENSOR,
    findings: [
      unmeasuredFinding({
        check: SOLUTION_OPTIONS_SENSOR,
        artefact: OPTIONS_LEDGER_FILE,
        reason,
        cause,
      }),
    ],
    scanned: OPTIONS_LEDGER_FILE,
  });

const evaluateSolutionOptions = ({
  commandLineArguments,
  projectDirectory,
  fileReader,
}: SolutionOptionsInputs): SensorReport => {
  const invocation = sensorInvocationFrom({ commandLineArguments });
  if (invocation.kind === "incomplete") {
    return unmeasuredSensorReport({
      reason: `missing ${invocation.missingFlags.join(", ")}`,
      cause: "incomplete-invocation",
    });
  }
  if (invocation.stage !== GATE_TWO_STAGE) {
    return unmeasuredSensorReport({
      reason: `solution-options judges Gate 2 (${GATE_TWO_STAGE}) only, and was invoked at ${invocation.stage}`,
      cause: "wrong-gate",
    });
  }
  const location = recordLocationFor({
    outputPath: invocation.outputPath,
    projectDirectory,
  });
  if (location.kind === "not-a-record") {
    return judgedReport({
      sensor: SOLUTION_OPTIONS_SENSOR,
      findings: [],
      scanned: "(not an intent record)",
    });
  }
  const ledgerRead = fileReader.readText({
    path: optionsLedgerPathFor({ recordDirectory: location.recordDirectory }),
  });
  if (ledgerRead.kind === "unreadable") {
    return unmeasuredSensorReport({
      reason: `${OPTIONS_LEDGER_FILE} is unreadable (${ledgerRead.reason})`,
      cause: "input-unavailable",
    });
  }
  const scannedDescription = `record ${location.recordName} at ${invocation.stage}`;
  if (ledgerRead.kind === "absent") {
    return judgedReport({
      sensor: SOLUTION_OPTIONS_SENSOR,
      findings: ABSENT_LEDGER_FINDINGS,
      scanned: scannedDescription,
    });
  }
  return judgedReport({
    sensor: SOLUTION_OPTIONS_SENSOR,
    findings: ledgerShapeFindings({
      ledger: parseOptionsLedger({ markdownText: ledgerRead.text }),
    }),
    scanned: scannedDescription,
  });
};

const runSolutionOptions = ({
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
      report: evaluateSolutionOptions({
        commandLineArguments,
        projectDirectory: runtime.projectDirectory(),
        fileReader,
      }),
    }),
  });
};

const main = (commandLineArguments: string[]): void => {
  runSolutionOptions({
    commandLineArguments,
    fileReader: defaultSensorFileReader(),
    runtime: defaultSensorRuntime(),
  });
};

if (import.meta.main) {
  const runtime = defaultSensorRuntime();
  runSolutionOptions({
    commandLineArguments: runtime.commandLineArguments(),
    fileReader: defaultSensorFileReader(),
    runtime,
  });
}

export {
  evaluateSolutionOptions,
  main,
  runSolutionOptions,
  type SolutionOptionsInputs,
};
