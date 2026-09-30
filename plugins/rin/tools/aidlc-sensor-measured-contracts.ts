import { factRowsOfDocument } from "./rin-gates/rin-gates-fact-rows.ts";
import {
  LOCK_FILE,
  measuredPremiseFindings,
} from "./rin-gates/rin-gates-measured-contracts.ts";
import { parseOptionsLedger } from "./rin-gates/rin-gates-options-ledger.ts";
import {
  FACTS_FILE,
  factsPathFor,
  GATE_THREE_STAGE,
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

type MeasuredContractsInputs = {
  readonly commandLineArguments: readonly string[];
  readonly projectDirectory: string;
  readonly fileReader: SensorFileReader;
};

const MEASURED_CONTRACTS_SENSOR = "measured-contracts";

const unmeasuredSensorReport = ({
  reason,
  cause,
}: {
  readonly reason: string;
  readonly cause: UnmeasuredCause;
}): SensorReport =>
  unmeasuredReport({
    sensor: MEASURED_CONTRACTS_SENSOR,
    findings: [
      unmeasuredFinding({
        check: MEASURED_CONTRACTS_SENSOR,
        artefact: LOCK_FILE,
        reason,
        cause,
      }),
    ],
    scanned: LOCK_FILE,
  });

const evaluateMeasuredContracts = ({
  commandLineArguments,
  projectDirectory,
  fileReader,
}: MeasuredContractsInputs): SensorReport => {
  const invocation = sensorInvocationFrom({ commandLineArguments });
  if (invocation.kind === "incomplete") {
    return unmeasuredSensorReport({
      reason: `missing ${invocation.missingFlags.join(", ")}`,
      cause: "incomplete-invocation",
    });
  }
  if (invocation.stage !== GATE_THREE_STAGE) {
    return unmeasuredSensorReport({
      reason: `measured-contracts judges Gate 3 (${GATE_THREE_STAGE}) only, and was invoked at ${invocation.stage}`,
      cause: "wrong-gate",
    });
  }
  const location = recordLocationFor({
    outputPath: invocation.outputPath,
    projectDirectory,
  });
  if (location.kind === "not-a-record") {
    return judgedReport({
      sensor: MEASURED_CONTRACTS_SENSOR,
      findings: [],
      scanned: "(not an intent record)",
    });
  }
  const lockRead = fileReader.readText({ path: invocation.outputPath });
  if (lockRead.kind === "unreadable") {
    return unmeasuredSensorReport({
      reason: `${LOCK_FILE} is unreadable (${lockRead.reason})`,
      cause: "input-unavailable",
    });
  }
  if (lockRead.kind === "absent") {
    return unmeasuredSensorReport({
      reason: `${LOCK_FILE} is absent`,
      cause: "input-unavailable",
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
  if (ledgerRead.kind === "absent") {
    return judgedReport({
      sensor: MEASURED_CONTRACTS_SENSOR,
      findings: [],
      scanned: `${LOCK_FILE} of record ${location.recordName}: no Gate-2 ${OPTIONS_LEDGER_FILE}, so the premises the design rests on are the board's to judge`,
    });
  }
  const factsRead = fileReader.readText({
    path: factsPathFor({ recordDirectory: location.recordDirectory }),
  });
  if (factsRead.kind === "unreadable") {
    return unmeasuredSensorReport({
      reason: `${FACTS_FILE} is unreadable (${factsRead.reason})`,
      cause: "input-unavailable",
    });
  }
  return judgedReport({
    sensor: MEASURED_CONTRACTS_SENSOR,
    findings: measuredPremiseFindings({
      ledger: parseOptionsLedger({ markdownText: ledgerRead.text }),
      lockText: lockRead.text,
      factRows: factRowsOfDocument({ factsDocument: factsRead }),
    }),
    scanned: `${LOCK_FILE} of record ${location.recordName}`,
  });
};

const runMeasuredContracts = ({
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
      report: evaluateMeasuredContracts({
        commandLineArguments,
        projectDirectory: runtime.projectDirectory(),
        fileReader,
      }),
    }),
  });
};

const main = (commandLineArguments: string[]): void => {
  runMeasuredContracts({
    commandLineArguments,
    fileReader: defaultSensorFileReader(),
    runtime: defaultSensorRuntime(),
  });
};

if (import.meta.main) {
  const runtime = defaultSensorRuntime();
  runMeasuredContracts({
    commandLineArguments: runtime.commandLineArguments(),
    fileReader: defaultSensorFileReader(),
    runtime,
  });
}

export {
  evaluateMeasuredContracts,
  type MeasuredContractsInputs,
  main,
  runMeasuredContracts,
};
