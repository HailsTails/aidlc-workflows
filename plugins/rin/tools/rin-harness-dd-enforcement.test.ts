import { describe, expect, test, vi } from "vitest";
import type { R7OptIn } from "./rin-harness-config.ts";
import { recordDirectoryFor, runDdSensor } from "./rin-harness-dd-enforcement.ts";
import type { Finding, RecordPorts } from "./rin-harness-doc-discipline.ts";
import {
  defaultPathOperations,
  type PathFlavour,
  pathOperationsFor,
} from "./rin-harness-path-operations.ts";
import { defaultReviewProcessPort } from "./rin-gates/review-process-port.ts";

const paths = defaultPathOperations();

const SEPARATOR: Readonly<Record<PathFlavour, string>> = {
  win32: "\\",
  posix: "/",
};

const INTENT_ARTEFACT = paths.join({
  segments: [
    "aidlc",
    "spaces",
    "default",
    "intents",
    "260906-example-record",
    "rin-requirements.md",
  ],
});

const EXAMPLE_RECORD = paths.resolve({
  segments: [
    paths.join({
      segments: ["aidlc", "spaces", "default", "intents", "260906-example-record"],
    }),
  ],
});

describe("record resolution — the paths that decide corpus-wide safety", () => {
  test("an artefact inside a record resolves to that record's directory", () => {
    const resolved = recordDirectoryFor({ outputPath: INTENT_ARTEFACT });
    expect(resolved).toBe(EXAMPLE_RECORD);
  });

  test("an artefact nested under a phase directory resolves to the RECORD, not the phase", () => {
    const nested = paths.join({
      segments: [
        "aidlc",
        "spaces",
        "default",
        "intents",
        "260906-example-record",
        "inception",
        "rin-gate-1-framing",
        "rin-requirements.md",
      ],
    });
    expect(recordDirectoryFor({ outputPath: nested })).toBe(EXAMPLE_RECORD);
  });

  test("a path outside any intent record resolves to nothing", () => {
    expect(
      recordDirectoryFor({
        outputPath: paths.join({ segments: ["packages", "kernel", "src", "index.ts"] }),
      }),
    ).toBeUndefined();
  });

  test("a path whose only 'intents' mention is a filename does not resolve", () => {
    expect(
      recordDirectoryFor({ outputPath: paths.join({ segments: ["docs", "intents.md"] }) }),
    ).toBeUndefined();
  });

  test("the resolved directory is the segment immediately after intents", () => {
    const resolved = recordDirectoryFor({ outputPath: INTENT_ARTEFACT });
    expect(resolved?.split(SEPARATOR[paths.flavour]).pop()).toBe("260906-example-record");
  });
});

const posixPaths = pathOperationsFor({ flavour: "posix" });

const WORK = "/work";
const ELSEWHERE = "/elsewhere";
const RECORD = "/work/aidlc/spaces/default/intents/260906-example-record";
const RECORD_ARTEFACT = `${RECORD}/rin-requirements.md`;
const CURSOR_GRAPH = ".cursor/tools/data/stage-graph.json";
const CLAUDE_GRAPH = ".claude/tools/data/stage-graph.json";

const fakeRecordPorts = (): RecordPorts => ({
  reader: {
    fileExists: (path) => path === RECORD,
    readFile: () => undefined,
    listDirectory: () => undefined,
  },
  kinds: {
    isFile: () => false,
    isDirectory: (path) => path === RECORD,
  },
  paths: posixPaths,
});

const fakeConfig = ({ optIn, stageGraph }: { readonly optIn: R7OptIn; readonly stageGraph: string }) => ({
  r7OptIn: ({ projectDir }: { readonly projectDir: string }): R7OptIn =>
    projectDir === WORK ? optIn : { kind: "invalid", reason: `config asked about ${projectDir}` },
  stageGraphPath: ({ projectDir }: { readonly projectDir: string }): string =>
    projectDir === WORK ? stageGraph : "config-asked-about-another-directory.json",
});

const fakeProcess = ({
  argv,
  publish,
  workingDirectory = ELSEWHERE,
}: {
  readonly argv: readonly string[];
  readonly publish: (text: string) => void;
  readonly workingDirectory?: string;
}) => ({
  arguments: ["bun", "rin-harness-sensor.ts", ...argv],
  publish,
  workingDirectory: () => workingDirectory,
});

const REQUESTED_FINDING: Finding = {
  rule: "DD-1",
  artefact: "rin-requirements.md",
  line: 3,
  subject: "O-9",
  remedy: "pinned DD-1 remedy",
};

const UNREQUESTED_FINDING: Finding = {
  rule: "DD-2",
  artefact: "rin-requirements.md",
  line: 5,
  subject: "a bare figure",
  remedy: "pinned DD-2 remedy",
};

describe("runDdSensor — in-process through its ports", () => {
  test("(a) DD-7 without the opt-in publishes one not-adopted line", () => {
    const publish = vi.fn();
    runDdSensor({
      ddIds: ["DD-7"],
      ports: fakeRecordPorts(),
      config: fakeConfig({ optIn: { kind: "disabled" }, stageGraph: CURSOR_GRAPH }),
      process: fakeProcess({ argv: ["--project-dir", WORK, "--output-path", RECORD_ARTEFACT], publish }),
    });
    expect(publish.mock.calls).toEqual([
      ['{"pass":true,"dd":"DD-7","findings_count":0,"findings":[],"scanned":"(DD-7 not adopted)"}\n'],
    ]);
  });

  test("(b) DD-7 opted in reports a path outside any intent record as not a record", () => {
    const publish = vi.fn();
    runDdSensor({
      ddIds: ["DD-7"],
      ports: fakeRecordPorts(),
      config: fakeConfig({ optIn: { kind: "enabled" }, stageGraph: CURSOR_GRAPH }),
      process: fakeProcess({
        argv: ["--project-dir", WORK, "--output-path", "/work/packages/kernel/src/index.ts"],
        publish,
      }),
    });
    expect(publish.mock.calls).toEqual([
      ['{"pass":true,"dd":"DD-7","findings_count":0,"findings":[],"scanned":"(not an intent record)"}\n'],
    ]);
  });

  test("(c) a malformed DD-7 opt-in fails as UNMEASURED with the config's reason", () => {
    const publish = vi.fn();
    runDdSensor({
      ddIds: ["DD-7"],
      ports: fakeRecordPorts(),
      config: fakeConfig({
        optIn: { kind: "invalid", reason: "rinGates.exceptionWhyChains must be a boolean" },
        stageGraph: CURSOR_GRAPH,
      }),
      process: fakeProcess({ argv: ["--project-dir", WORK, "--output-path", RECORD_ARTEFACT], publish }),
    });
    expect(publish.mock.calls).toEqual([
      [
        '{"pass":false,"dd":"DD-7","findings_count":0,"findings":[],"scanned":"UNMEASURED — harness.config.json is invalid: rinGates.exceptionWhyChains must be a boolean"}\n',
      ],
    ]);
  });

  test.each([
    { configured: CURSOR_GRAPH, measured: "/work/.cursor/tools/data/stage-graph.json" },
    { configured: CLAUDE_GRAPH, measured: "/work/.claude/tools/data/stage-graph.json" },
  ])("(d) the configured $configured is the only graph inspected, and no findings pass", ({ configured, measured }) => {
    const ports = fakeRecordPorts();
    const inspect = vi.fn().mockReturnValue({ kind: "inspected", findings: [] });
    const publish = vi.fn();
    runDdSensor({
      ddIds: ["DD-1", "DD-3"],
      ports,
      inspection: { inspect, describe: vi.fn().mockReturnValue("pinned description") },
      config: fakeConfig({ optIn: { kind: "disabled" }, stageGraph: configured }),
      process: fakeProcess({ argv: ["--project-dir", WORK, "--output-path", RECORD_ARTEFACT], publish }),
    });
    expect(inspect.mock.calls).toEqual([[{ recordDir: RECORD, stageGraphPath: measured, ports }]]);
    expect(publish.mock.calls).toEqual([
      [
        '{"pass":true,"dd":"DD-1+DD-3","findings_count":0,"findings":[],"scanned":"record 260906-example-record, official artefacts only (DD-4)"}\n',
      ],
    ]);
  });

  test("(e) an absent configured graph publishes UNMEASURED with the inspection's own description", () => {
    const ports = fakeRecordPorts();
    const unmeasurable = {
      kind: "unmeasurable",
      reason: "no-stage-graph",
      path: "/work/.cursor/tools/data/stage-graph.json",
    };
    const inspect = vi.fn().mockReturnValue(unmeasurable);
    const describeInspection = vi.fn().mockReturnValue("pinned description of an absent graph");
    const publish = vi.fn();
    runDdSensor({
      ddIds: ["DD-1", "DD-3"],
      ports,
      inspection: { inspect, describe: describeInspection },
      config: fakeConfig({ optIn: { kind: "disabled" }, stageGraph: CURSOR_GRAPH }),
      process: fakeProcess({ argv: ["--project-dir", WORK, "--output-path", RECORD_ARTEFACT], publish }),
    });
    expect(inspect.mock.calls).toEqual([
      [{ recordDir: RECORD, stageGraphPath: "/work/.cursor/tools/data/stage-graph.json", ports }],
    ]);
    expect(describeInspection.mock.calls).toEqual([[unmeasurable]]);
    expect(publish.mock.calls).toEqual([
      [
        '{"pass":false,"dd":"DD-1+DD-3","findings_count":0,"findings":[],"scanned":"UNMEASURED — pinned description of an absent graph"}\n',
      ],
    ]);
  });

  test("(f) an invalid configured graph publishes UNMEASURED, never success", () => {
    const ports = fakeRecordPorts();
    const unmeasurable = {
      kind: "unmeasurable",
      reason: "stage-graph-malformed",
      path: "/work/.cursor/tools/data/stage-graph.json",
    };
    const inspect = vi.fn().mockReturnValue(unmeasurable);
    const describeInspection = vi.fn().mockReturnValue("pinned description of a malformed graph");
    const publish = vi.fn();
    runDdSensor({
      ddIds: ["DD-1", "DD-3"],
      ports,
      inspection: { inspect, describe: describeInspection },
      config: fakeConfig({ optIn: { kind: "disabled" }, stageGraph: CURSOR_GRAPH }),
      process: fakeProcess({ argv: ["--project-dir", WORK, "--output-path", RECORD_ARTEFACT], publish }),
    });
    expect(inspect.mock.calls).toEqual([
      [{ recordDir: RECORD, stageGraphPath: "/work/.cursor/tools/data/stage-graph.json", ports }],
    ]);
    expect(describeInspection.mock.calls).toEqual([[unmeasurable]]);
    expect(publish.mock.calls).toEqual([
      [
        '{"pass":false,"dd":"DD-1+DD-3","findings_count":0,"findings":[],"scanned":"UNMEASURED — pinned description of a malformed graph"}\n',
      ],
    ]);
  });

  test("(g) without --project-dir the graph is inspected under the process port's working directory", () => {
    const ports = fakeRecordPorts();
    const inspect = vi.fn().mockReturnValue({ kind: "inspected", findings: [] });
    const publish = vi.fn();
    runDdSensor({
      ddIds: ["DD-1", "DD-3"],
      ports,
      inspection: { inspect, describe: vi.fn().mockReturnValue("pinned description") },
      config: fakeConfig({ optIn: { kind: "disabled" }, stageGraph: CURSOR_GRAPH }),
      process: fakeProcess({ argv: ["--output-path", RECORD_ARTEFACT], publish, workingDirectory: WORK }),
    });
    expect(inspect.mock.calls).toEqual([
      [{ recordDir: RECORD, stageGraphPath: "/work/.cursor/tools/data/stage-graph.json", ports }],
    ]);
    expect(publish.mock.calls).toEqual([
      [
        '{"pass":true,"dd":"DD-1+DD-3","findings_count":0,"findings":[],"scanned":"record 260906-example-record, official artefacts only (DD-4)"}\n',
      ],
    ]);
  });

  test("(h) only the requested rules' findings are published, failing with their count", () => {
    const inspect = vi.fn().mockReturnValue({
      kind: "inspected",
      findings: [REQUESTED_FINDING, UNREQUESTED_FINDING],
    });
    const publish = vi.fn();
    runDdSensor({
      ddIds: ["DD-1", "DD-3"],
      ports: fakeRecordPorts(),
      inspection: { inspect, describe: vi.fn().mockReturnValue("pinned description") },
      config: fakeConfig({ optIn: { kind: "disabled" }, stageGraph: CURSOR_GRAPH }),
      process: fakeProcess({ argv: ["--project-dir", WORK, "--output-path", RECORD_ARTEFACT], publish }),
    });
    expect(publish.mock.calls).toEqual([
      [
        '{"pass":false,"dd":"DD-1+DD-3","findings_count":1,"findings":[{"rule":"DD-1","artefact":"rin-requirements.md","line":3,"subject":"O-9","remedy":"pinned DD-1 remedy"}],"scanned":"record 260906-example-record, official artefacts only (DD-4)"}\n',
      ],
    ]);
  });
});

const processes = defaultReviewProcessPort();

test("the real DD-7 entry process exits 0 and writes exactly one JSON line to stdout", () => {
  const result = processes.runSync({
    program: "bun",
    args: [
      paths.join({ segments: [import.meta.dirname, "rin-harness-sensor-dd-7.ts"] }),
      "--project-dir",
      paths.join({ segments: [import.meta.dirname, "no-such-project-for-the-dd-7-entry"] }),
      "--output-path",
      INTENT_ARTEFACT,
    ],
  });
  expect(result.status).toBe(0);
  expect(result.stdout).toBe(
    '{"pass":true,"dd":"DD-7","findings_count":0,"findings":[],"scanned":"(DD-7 not adopted)"}\n',
  );
});
