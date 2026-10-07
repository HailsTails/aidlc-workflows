import { existsSync } from "node:fs";
import { basename, join, resolve, sep } from "node:path";
import { configR7OptIn } from "./rin-harness-config.ts";
import {
  type DocRule,
  type Finding,
  inspectRecordDirectory,
} from "./rin-harness-doc-discipline.ts";

const STAGE_GRAPH_RELATIVE = join(
  ".claude",
  "tools",
  "data",
  "stage-graph.json",
);
const INTENTS_SEGMENT = `${sep}intents${sep}`;

const UPSTREAM_FINDINGS_COUNT_KEY = "findings_count";

type DdSensorResult = {
  readonly pass: boolean;
  readonly dd: string;
  readonly findingsCount: number;
  readonly findings: readonly Finding[];
  readonly scanned: string;
};

const emit = ({ result }: { readonly result: DdSensorResult }): void => {
  process.stdout.write(
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
}: {
  readonly outputPath: string;
}): string | undefined => {
  const absolute = resolve(outputPath);
  const marker = absolute.indexOf(INTENTS_SEGMENT);
  if (marker === -1) {
    return undefined;
  }
  const afterIntents = absolute.slice(marker + INTENTS_SEGMENT.length);
  const [recordName] = afterIntents.split(sep);
  return recordName === undefined
    ? undefined
    : join(absolute.slice(0, marker + INTENTS_SEGMENT.length), recordName);
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
}: {
  readonly ddIds: readonly DocRule[];
  readonly label: string;
  readonly projectDir: string;
}): DdSensorResult | undefined => {
  if (!ddIds.includes("DD-7")) return undefined;
  const optIn = configR7OptIn({ projectDir });
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
}: {
  readonly ddIds: readonly DocRule[];
}): void => {
  const flags = parseFlags({ argv: process.argv.slice(2) });
  const label = ddIds.join("+");
  const r7Result = r7SensorGate({
    ddIds,
    label,
    projectDir: flags.projectDir ?? process.cwd(),
  });
  if (r7Result !== undefined) {
    emit({ result: r7Result });
    return;
  }
  const recordDir =
    flags.outputPath === undefined
      ? undefined
      : recordDirectoryFor({ outputPath: flags.outputPath });

  if (recordDir === undefined || !existsSync(recordDir)) {
    emit({
      result: cleanResult({ ddId: label, scanned: "(not an intent record)" }),
    });
    return;
  }

  const inspection = inspectRecordDirectory({
    recordDir,
    stageGraphPath: join(
      flags.projectDir ?? process.cwd(),
      STAGE_GRAPH_RELATIVE,
    ),
  });

  if (inspection.kind === "unmeasurable") {
    emit({
      result: {
        pass: false,
        dd: label,
        findingsCount: 0,
        findings: [],
        scanned: `UNMEASURED — ${inspection.reason}: ${STAGE_GRAPH_RELATIVE} is absent, so the official-artefact set (DD-4) could not be resolved`,
      },
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
      scanned: `record ${basename(recordDir)}, official artefacts only (DD-4)`,
    },
  });
};

export { type DdSensorResult, recordDirectoryFor, runDdSensor };
