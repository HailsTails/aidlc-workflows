import { afterEach, describe, expect, test } from "vitest";
import { recordDirectoryFor } from "./rin-harness-dd-enforcement.ts";
import {
  defaultPathOperations,
  type PathFlavour,
} from "./rin-harness-path-operations.ts";
import { defaultFileTextPort } from "./rin-harness-sidecar-file-reader.ts";
import { defaultReviewProcessPort } from "./rin-gates/review-process-port.ts";

const files = defaultFileTextPort();
const paths = defaultPathOperations();
const processes = defaultReviewProcessPort();

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

const temporaryDirectory = ({ prefix }: { readonly prefix: string }): string =>
  files.makeTemporaryDirectory(
    paths.join({ segments: [files.temporaryRoot(), prefix] }),
  );

const exampleOutputPath = ({ root }: { readonly root: string }): string =>
  paths.join({
    segments: [root, "aidlc", "spaces", "default", "intents", "example", "result.md"],
  });

const DD7_SENSOR = paths.join({
  segments: [import.meta.dirname, "rin-harness-sensor-dd-7.ts"],
});

test("DD-7 sensor reports not adopted without the project opt-in", () => {
  const root = temporaryDirectory({ prefix: "rin-dd7-sensor-" });
  const outputPath = exampleOutputPath({ root });
  const result = processes.runSync({
    program: "bun",
    args: [DD7_SENSOR, "--project-dir", root, "--output-path", outputPath],
  });
  files.remove(root, { recursive: true, force: true });
  expect(result.status).toBe(0);
  expect(result.stdout).toContain('"scanned":"(DD-7 not adopted)"');
});

test("DD-7 sensor measures an opted-in project", () => {
  const root = temporaryDirectory({ prefix: "rin-dd7-sensor-" });
  files.write(
    paths.join({ segments: [root, "harness.config.json"] }),
    JSON.stringify({
      projectName: "sensor-fixture",
      defaultScope: "rin-gates",
      rulesetRoot: "aidlc/spaces/default/memory",
      stageGraph: ".claude/tools/data/stage-graph.json",
      packageManager: { primary: "bun", runnerAllowlist: ["pnpm"] },
      rinGates: { exceptionWhyChains: true },
    }),
  );
  const outputPath = exampleOutputPath({ root });
  const result = processes.runSync({
    program: "bun",
    args: [DD7_SENSOR, "--project-dir", root, "--output-path", outputPath],
  });
  files.remove(root, { recursive: true, force: true });
  expect(result.status).toBe(0);
  expect(result.stdout).toContain('"scanned":"(not an intent record)"');
});

test("DD-7 sensor reports UNMEASURED and fails when the opt-in is malformed", () => {
  const root = temporaryDirectory({ prefix: "rin-dd7-sensor-" });
  files.write(
    paths.join({ segments: [root, "harness.config.json"] }),
    JSON.stringify({
      projectName: "sensor-fixture",
      defaultScope: "rin-gates",
      rulesetRoot: "aidlc/spaces/default/memory",
      stageGraph: ".claude/tools/data/stage-graph.json",
      packageManager: { primary: "bun", runnerAllowlist: ["pnpm"] },
      rinGates: { exceptionWhyChains: "true" },
    }),
  );
  const outputPath = exampleOutputPath({ root });
  const result = processes.runSync({
    program: "bun",
    args: [DD7_SENSOR, "--project-dir", root, "--output-path", outputPath],
  });
  files.remove(root, { recursive: true, force: true });
  expect(result.stdout).toContain('"pass":false');
  expect(result.stdout).toContain(
    "UNMEASURED — harness.config.json is invalid",
  );
});

const configuredGraphFixtures: string[] = [];

afterEach(() => {
  configuredGraphFixtures.splice(0).forEach((root) => {
    files.remove(root, { recursive: true, force: true });
  });
});

const configuredGraphFixture = ({ stageGraph }: { readonly stageGraph: string }) => {
  const root = temporaryDirectory({ prefix: "rin-dd-configured-graph-" });
  configuredGraphFixtures.push(root);
  const outputPath = paths.join({ segments: [root, INTENT_ARTEFACT] });
  const graphPath = paths.resolve({ segments: [root, stageGraph] });
  files.mkdir(paths.dirname({ path: outputPath }), { recursive: true });
  files.mkdir(paths.dirname({ path: graphPath }), { recursive: true });
  files.write(outputPath, "# Requirements\n\nA standalone requirement.\n");
  files.write(paths.join({ segments: [root, "harness.config.json"] }), JSON.stringify({
    projectName: "configured-graph-fixture", defaultScope: "rin-gates",
    rulesetRoot: "aidlc/spaces/default/memory", stageGraph,
    packageManager: { primary: "bun", runnerAllowlist: ["pnpm"] },
  }));
  return { root, outputPath, graphPath };
};

const configuredGraphSensor = ({ root, outputPath }: { readonly root: string; readonly outputPath: string }) =>
  processes.runSync({
    program: "bun",
    args: [
      paths.join({ segments: [import.meta.dirname, "rin-harness-sensor-dd-1.ts"] }),
      "--project-dir", root, "--output-path", outputPath,
    ],
    cwd: root,
  });

test.each([
  { stageGraph: ".cursor/tools/data/stage-graph.json", otherHarness: ".claude" },
  { stageGraph: ".claude/tools/data/stage-graph.json", otherHarness: ".cursor" },
])("DD sensors measure only the configured $stageGraph", ({ stageGraph, otherHarness }) => {
  const fixture = configuredGraphFixture({ stageGraph });
  files.write(fixture.graphPath, JSON.stringify([{ produces: ["rin-requirements"] }]));
  const result = configuredGraphSensor(fixture);
  expect(result.status).toBe(0);
  expect(JSON.parse(result.stdout)).toMatchObject({ pass: true, findings_count: 0 });
  expect(result.stdout).toContain("official artefacts only");
  expect(files.exists(paths.join({ segments: [fixture.root, otherHarness] }))).toBe(false);
});

test("DD sensors refuse a missing configured Cursor graph even when a Claude graph exists", () => {
  const fixture = configuredGraphFixture({ stageGraph: ".cursor/tools/data/stage-graph.json" });
  const legacyGraph = paths.join({ segments: [fixture.root, ".claude/tools/data/stage-graph.json"] });
  files.mkdir(paths.dirname({ path: legacyGraph }), { recursive: true });
  files.write(legacyGraph, JSON.stringify([{ produces: ["rin-requirements"] }]));
  const result = configuredGraphSensor(fixture);
  expect(result.status).toBe(0);
  expect(JSON.parse(result.stdout)).toMatchObject({ pass: false, findings_count: 0 });
  expect(result.stdout).toContain("UNMEASURED");
  expect(result.stdout).toContain(".cursor/tools/data/stage-graph.json is absent");
});

test("DD sensors report an invalid configured Cursor graph as UNMEASURED, never success", () => {
  const fixture = configuredGraphFixture({ stageGraph: ".cursor/tools/data/stage-graph.json" });
  files.write(fixture.graphPath, "{invalid graph");
  const result = configuredGraphSensor(fixture);
  expect(result.status).toBe(0);
  expect(JSON.parse(result.stdout)).toMatchObject({ pass: false, findings_count: 0 });
  expect(result.stdout).toContain("UNMEASURED");
  expect(result.stdout).toContain("is not a valid stage graph");
});
