import {
  defaultReviewProcessPort,
  defaultWorkingDirectory,
  type ReviewProcessPort,
} from "./rin-gates/review-process-port.ts";
import {
  configR7OptIn,
  configStageGraphPath,
  type R7OptIn,
} from "./rin-harness-config.ts";
import {
  type DocRule,
  defaultRecordPorts,
  describeUnmeasurable,
  type Finding,
  inspectRecordDirectory,
  type RecordPorts,
} from "./rin-harness-doc-discipline.ts";
import {
  defaultPathOperations,
  type PathFlavour,
  type PathOperations,
} from "./rin-harness-path-operations.ts";

const SEPARATORS: Readonly<Record<PathFlavour, string>> = {
  win32: "\\",
  posix: "/",
};

const UPSTREAM_FINDINGS_COUNT_KEY = "findings_count";

type DdSensorResult = {
  readonly pass: boolean;
  readonly dd: string;
  readonly findingsCount: number;
  readonly findings: readonly Finding[];
  readonly scanned: string;
};

type SensorProcess = Pick<ReviewProcessPort, "arguments" | "publish"> & {
  readonly workingDirectory: () => string;
};

type SensorConfig = {
  readonly r7OptIn: (input: { readonly projectDir: string }) => R7OptIn;
  readonly stageGraphPath: (input: { readonly projectDir: string }) => string;
};

const defaultSensorProcess = (): SensorProcess => {
  const reviewProcess = defaultReviewProcessPort();
  return {
    arguments: reviewProcess.arguments,
    publish: reviewProcess.publish,
    workingDirectory: defaultWorkingDirectory,
  };
};

const defaultSensorConfig = (): SensorConfig => ({
  r7OptIn: configR7OptIn,
  stageGraphPath: configStageGraphPath,
});

const emit = ({
  result,
  publish,
}: {
  readonly result: DdSensorResult;
  readonly publish: (text: string) => void;
}): void => {
  publish(
    `${JSON.stringify({
      pass: result.pass,
      dd: result.dd,
      [UPSTREAM_FINDINGS_COUNT_KEY]: result.findingsCount,
      findings: result.findings,
      scanned: result.scanned,
    })}\n`,
  );
};

type Flags = {
  readonly outputPath?: string;
  readonly projectDir?: string;
};

const parseFlags = ({ argv }: { readonly argv: readonly string[] }): Flags => {
  const valueAfter = (flag: string): string | undefined => {
    const index = argv.indexOf(flag);
    return index === -1 ? undefined : argv[index + 1];
  };
  return {
    outputPath: valueAfter("--output-path"),
    projectDir: valueAfter("--project-dir"),
  };
};

const recordDirectoryFor = ({
  outputPath,
  paths = defaultPathOperations(),
}: {
  readonly outputPath: string;
  readonly paths?: PathOperations;
}): string | undefined => {
  const separator = SEPARATORS[paths.flavour];
  const intentsSegment = `${separator}intents${separator}`;
  const absolute = paths.resolve({ segments: [outputPath] });
  const marker = absolute.indexOf(intentsSegment);
  if (marker === -1) {
    return undefined;
  }
  const afterIntents = absolute.slice(marker + intentsSegment.length);
  const [recordName] = afterIntents.split(separator);
  return recordName === undefined
    ? undefined
    : paths.join({
        segments: [
          absolute.slice(0, marker + intentsSegment.length),
          recordName,
        ],
      });
};

const cleanResult = ({
  ddId,
  scanned,
}: {
  readonly ddId: string;
  readonly scanned: string;
}): DdSensorResult => ({
  pass: true,
  dd: ddId,
  findingsCount: 0,
  findings: [],
  scanned,
});

const r7SensorGate = ({
  ddIds,
  label,
  projectDir,
  config,
}: {
  readonly ddIds: readonly DocRule[];
  readonly label: string;
  readonly projectDir: string;
  readonly config: SensorConfig;
}): DdSensorResult | undefined => {
  if (!ddIds.includes("DD-7")) return undefined;
  const optIn = config.r7OptIn({ projectDir });
  switch (optIn.kind) {
    case "invalid":
      return {
        pass: false,
        dd: label,
        findingsCount: 0,
        findings: [],
        scanned: `UNMEASURED — harness.config.json is invalid: ${optIn.reason}`,
      };
    case "disabled":
      return cleanResult({ ddId: label, scanned: "(DD-7 not adopted)" });
    case "enabled":
      return undefined;
  }
};

const runDdSensor = ({
  ddIds,
  ports = defaultRecordPorts(),
  config = defaultSensorConfig(),
  process: runtime = defaultSensorProcess(),
}: {
  readonly ddIds: readonly DocRule[];
  readonly ports?: RecordPorts;
  readonly config?: SensorConfig;
  readonly process?: SensorProcess;
}): void => {
  const flags = parseFlags({ argv: runtime.arguments.slice(2) });
  const label = ddIds.join("+");
  const projectDir = flags.projectDir ?? runtime.workingDirectory();
  const r7Result = r7SensorGate({ ddIds, label, projectDir, config });
  if (r7Result !== undefined) {
    emit({ result: r7Result, publish: runtime.publish });
    return;
  }
  const recordDir =
    flags.outputPath === undefined
      ? undefined
      : recordDirectoryFor({
          outputPath: flags.outputPath,
          paths: ports.paths,
        });

  if (recordDir === undefined || !ports.reader.fileExists(recordDir)) {
    emit({
      result: cleanResult({ ddId: label, scanned: "(not an intent record)" }),
      publish: runtime.publish,
    });
    return;
  }

  const configuredStageGraph = config.stageGraphPath({ projectDir });
  const inspection = inspectRecordDirectory({
    recordDir,
    stageGraphPath: ports.paths.resolve({
      segments: [projectDir, configuredStageGraph],
    }),
    ports,
  });
  if (inspection.kind === "unmeasurable") {
    emit({
      result: {
        pass: false,
        dd: label,
        findingsCount: 0,
        findings: [],
        scanned: `UNMEASURED — ${describeUnmeasurable(inspection)}`,
      },
      publish: runtime.publish,
    });
    return;
  }

  const findings = inspection.findings.filter((finding) =>
    ddIds.includes(finding.rule),
  );

  emit({
    result: {
      pass: findings.length === 0,
      dd: label,
      findingsCount: findings.length,
      findings,
      scanned: `record ${ports.paths.basename({ path: recordDir })}, official artefacts only (DD-4)`,
    },
    publish: runtime.publish,
  });
};

export { type DdSensorResult, recordDirectoryFor, runDdSensor };
