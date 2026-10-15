import { describe, expect, test } from "vitest";
import type { R7OptIn } from "./rin-harness-config.ts";
import { recordDirectoryFor, runDdSensor } from "./rin-harness-dd-enforcement.ts";
import type { RecordPorts } from "./rin-harness-doc-discipline.ts";
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
const REQUIREMENTS_GRAPH = JSON.stringify([{ produces: ["rin-requirements"] }]);

type FakeTree = {
  readonly files: Readonly<Record<string, string>>;
  readonly directories: Readonly<Record<string, readonly string[]>>;
};

const fakeRecordPorts = ({ files: texts, directories }: FakeTree): RecordPorts => ({
  reader: {
    fileExists: (path) => path in texts || path in directories,
    readFile: (path) => texts[path],
    listDirectory: (path) => directories[path],
  },
  kinds: {
    isFile: (path) => path in texts,
    isDirectory: (path) => path in directories,
  },
  paths: posixPaths,
});

const recordTree = ({ graphs }: { readonly graphs: Readonly<Record<string, string>> }): FakeTree => ({
  files: { ...graphs, [RECORD_ARTEFACT]: "# Requirements\n\nA standalone requirement.\n" },
  directories: { [RECORD]: ["rin-requirements.md"] },
});

const fakeConfig = ({ optIn, stageGraph }: { readonly optIn: R7OptIn; readonly stageGraph: string }) => ({
  r7OptIn: ({ projectDir }: { readonly projectDir: string }): R7OptIn =>
    projectDir === WORK ? optIn : { kind: "invalid", reason: `config asked about ${projectDir}` },
  stageGraphPath: ({ projectDir }: { readonly projectDir: string }): string =>
    projectDir === WORK ? stageGraph : "config-asked-about-another-directory.json",
});

const capturingProcess = ({
  argv,
  published,
  workingDirectory = ELSEWHERE,
}: {
  readonly argv: readonly string[];
  readonly published: string[];
  readonly workingDirectory?: string;
}) => ({
  arguments: ["bun", "rin-harness-sensor.ts", ...argv],
  publish: (text: string) => {
    published.push(text);
  },
  workingDirectory: () => workingDirectory,
});

describe("runDdSensor — in-process through its ports", () => {
  test("(a) DD-7 without the opt-in publishes one not-adopted line", () => {
    const published: string[] = [];
    runDdSensor({
      ddIds: ["DD-7"],
      ports: fakeRecordPorts(recordTree({ graphs: {} })),
      config: fakeConfig({ optIn: { kind: "disabled" }, stageGraph: CURSOR_GRAPH }),
      process: capturingProcess({ argv: ["--project-dir", WORK, "--output-path", RECORD_ARTEFACT], published }),
    });
    expect(published).toEqual([
      '{"pass":true,"dd":"DD-7","findings_count":0,"findings":[],"scanned":"(DD-7 not adopted)"}\n',
    ]);
  });

  test("(b) DD-7 opted in reports a path outside any intent record as not a record", () => {
    const published: string[] = [];
    runDdSensor({
      ddIds: ["DD-7"],
      ports: fakeRecordPorts(recordTree({ graphs: {} })),
      config: fakeConfig({ optIn: { kind: "enabled" }, stageGraph: CURSOR_GRAPH }),
      process: capturingProcess({
        argv: ["--project-dir", WORK, "--output-path", "/work/packages/kernel/src/index.ts"],
        published,
      }),
    });
    expect(published).toEqual([
      '{"pass":true,"dd":"DD-7","findings_count":0,"findings":[],"scanned":"(not an intent record)"}\n',
    ]);
  });

  test("(c) a malformed DD-7 opt-in fails as UNMEASURED with the config's reason", () => {
    const published: string[] = [];
    runDdSensor({
      ddIds: ["DD-7"],
      ports: fakeRecordPorts(recordTree({ graphs: {} })),
      config: fakeConfig({
        optIn: { kind: "invalid", reason: "rinGates.exceptionWhyChains must be a boolean" },
        stageGraph: CURSOR_GRAPH,
      }),
      process: capturingProcess({ argv: ["--project-dir", WORK, "--output-path", RECORD_ARTEFACT], published }),
    });
    expect(published).toEqual([
      '{"pass":false,"dd":"DD-7","findings_count":0,"findings":[],"scanned":"UNMEASURED — harness.config.json is invalid: rinGates.exceptionWhyChains must be a boolean"}\n',
    ]);
  });

  test.each([
    { configured: CURSOR_GRAPH, other: CLAUDE_GRAPH },
    { configured: CLAUDE_GRAPH, other: CURSOR_GRAPH },
  ])("(d) the configured $configured is the only graph measured", ({ configured, other }) => {
    const published: string[] = [];
    runDdSensor({
      ddIds: ["DD-1", "DD-3"],
      ports: fakeRecordPorts(
        recordTree({ graphs: { [`${WORK}/${configured}`]: REQUIREMENTS_GRAPH, [`${WORK}/${other}`]: "{invalid graph" } }),
      ),
      config: fakeConfig({ optIn: { kind: "disabled" }, stageGraph: configured }),
      process: capturingProcess({ argv: ["--project-dir", WORK, "--output-path", RECORD_ARTEFACT], published }),
    });
    expect(published).toEqual([
      '{"pass":true,"dd":"DD-1+DD-3","findings_count":0,"findings":[],"scanned":"record 260906-example-record, official artefacts only (DD-4)"}\n',
    ]);
  });

  test("(e) an absent configured graph fails as UNMEASURED even when another harness's graph exists", () => {
    const published: string[] = [];
    runDdSensor({
      ddIds: ["DD-1", "DD-3"],
      ports: fakeRecordPorts(recordTree({ graphs: { [`${WORK}/${CLAUDE_GRAPH}`]: REQUIREMENTS_GRAPH } })),
      config: fakeConfig({ optIn: { kind: "disabled" }, stageGraph: CURSOR_GRAPH }),
      process: capturingProcess({ argv: ["--project-dir", WORK, "--output-path", RECORD_ARTEFACT], published }),
    });
    expect(published).toEqual([
      '{"pass":false,"dd":"DD-1+DD-3","findings_count":0,"findings":[],"scanned":"UNMEASURED — no-stage-graph: /work/.cursor/tools/data/stage-graph.json is absent, so the official-artefact set (DD-4) could not be resolved"}\n',
    ]);
  });

  test("(f) an invalid configured graph fails as UNMEASURED, never success", () => {
    const published: string[] = [];
    runDdSensor({
      ddIds: ["DD-1", "DD-3"],
      ports: fakeRecordPorts(recordTree({ graphs: { [`${WORK}/${CURSOR_GRAPH}`]: "{invalid graph" } })),
      config: fakeConfig({ optIn: { kind: "disabled" }, stageGraph: CURSOR_GRAPH }),
      process: capturingProcess({ argv: ["--project-dir", WORK, "--output-path", RECORD_ARTEFACT], published }),
    });
    expect(published).toEqual([
      '{"pass":false,"dd":"DD-1+DD-3","findings_count":0,"findings":[],"scanned":"UNMEASURED — stage-graph-malformed: /work/.cursor/tools/data/stage-graph.json is not a valid stage graph, so the official-artefact set (DD-4) could not be resolved"}\n',
    ]);
  });

  test("(g) without --project-dir the process port's working directory is the project", () => {
    const published: string[] = [];
    runDdSensor({
      ddIds: ["DD-1", "DD-3"],
      ports: fakeRecordPorts(recordTree({ graphs: { [`${WORK}/${CURSOR_GRAPH}`]: REQUIREMENTS_GRAPH } })),
      config: fakeConfig({ optIn: { kind: "disabled" }, stageGraph: CURSOR_GRAPH }),
      process: capturingProcess({ argv: ["--output-path", RECORD_ARTEFACT], published, workingDirectory: WORK }),
    });
    expect(published).toEqual([
      '{"pass":true,"dd":"DD-1+DD-3","findings_count":0,"findings":[],"scanned":"record 260906-example-record, official artefacts only (DD-4)"}\n',
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
