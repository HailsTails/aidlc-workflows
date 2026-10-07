import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { describe, expect, test } from "vitest";
import { recordDirectoryFor } from "./rin-harness-dd-enforcement.ts";

const INTENT_ARTEFACT = join(
  "aidlc",
  "spaces",
  "default",
  "intents",
  "260906-example-record",
  "rin-requirements.md",
);

describe("record resolution — the paths that decide corpus-wide safety", () => {
  test("an artefact inside a record resolves to that record's directory", () => {
    const resolved = recordDirectoryFor({ outputPath: INTENT_ARTEFACT });
    expect(resolved).toBe(
      resolve(
        join("aidlc", "spaces", "default", "intents", "260906-example-record"),
      ),
    );
  });

  test("an artefact nested under a phase directory resolves to the RECORD, not the phase", () => {
    const nested = join(
      "aidlc",
      "spaces",
      "default",
      "intents",
      "260906-example-record",
      "inception",
      "rin-gate-1-framing",
      "rin-requirements.md",
    );
    expect(recordDirectoryFor({ outputPath: nested })).toBe(
      resolve(
        join("aidlc", "spaces", "default", "intents", "260906-example-record"),
      ),
    );
  });

  test("a path outside any intent record resolves to nothing", () => {
    expect(
      recordDirectoryFor({
        outputPath: join("packages", "kernel", "src", "index.ts"),
      }),
    ).toBeUndefined();
  });

  test("a path whose only 'intents' mention is a filename does not resolve", () => {
    expect(
      recordDirectoryFor({ outputPath: join("docs", "intents.md") }),
    ).toBeUndefined();
  });

  test("the resolved directory is the segment immediately after intents", () => {
    const resolved = recordDirectoryFor({ outputPath: INTENT_ARTEFACT });
    expect(resolved?.split(sep).pop()).toBe("260906-example-record");
  });
});

test("DD-7 sensor reports not adopted without the project opt-in", () => {
  const root = mkdtempSync(join(tmpdir(), "rin-dd7-sensor-"));
  const sensor = join(import.meta.dirname, "rin-harness-sensor-dd-7.ts");
  const outputPath = join(
    root,
    "aidlc",
    "spaces",
    "default",
    "intents",
    "example",
    "result.md",
  );
  const result = spawnSync(
    "bun",
    [sensor, "--project-dir", root, "--output-path", outputPath],
    { encoding: "utf8" },
  );
  rmSync(root, { recursive: true, force: true });
  expect(result.status).toBe(0);
  expect(result.stdout).toContain('"scanned":"(DD-7 not adopted)"');
});

test("DD-7 sensor measures an opted-in project", () => {
  const root = mkdtempSync(join(tmpdir(), "rin-dd7-sensor-"));
  writeFileSync(
    join(root, "harness.config.json"),
    JSON.stringify({
      projectName: "sensor-fixture",
      defaultScope: "rin-gates",
      rulesetRoot: "aidlc/spaces/default/memory",
      stageGraph: ".claude/tools/data/stage-graph.json",
      packageManager: { primary: "bun", runnerAllowlist: ["pnpm"] },
      rinGates: { exceptionWhyChains: true },
    }),
  );
  const sensor = join(import.meta.dirname, "rin-harness-sensor-dd-7.ts");
  const outputPath = join(
    root,
    "aidlc",
    "spaces",
    "default",
    "intents",
    "example",
    "result.md",
  );
  const result = spawnSync(
    "bun",
    [sensor, "--project-dir", root, "--output-path", outputPath],
    { encoding: "utf8" },
  );
  rmSync(root, { recursive: true, force: true });
  expect(result.status).toBe(0);
  expect(result.stdout).toContain('"scanned":"(not an intent record)"');
});

test("DD-7 sensor reports UNMEASURED and fails when the opt-in is malformed", () => {
  const root = mkdtempSync(join(tmpdir(), "rin-dd7-sensor-"));
  writeFileSync(
    join(root, "harness.config.json"),
    JSON.stringify({
      projectName: "sensor-fixture",
      defaultScope: "rin-gates",
      rulesetRoot: "aidlc/spaces/default/memory",
      stageGraph: ".claude/tools/data/stage-graph.json",
      packageManager: { primary: "bun", runnerAllowlist: ["pnpm"] },
      rinGates: { exceptionWhyChains: "true" },
    }),
  );
  const sensor = join(import.meta.dirname, "rin-harness-sensor-dd-7.ts");
  const outputPath = join(
    root,
    "aidlc",
    "spaces",
    "default",
    "intents",
    "example",
    "result.md",
  );
  const result = spawnSync(
    "bun",
    [sensor, "--project-dir", root, "--output-path", outputPath],
    { encoding: "utf8" },
  );
  rmSync(root, { recursive: true, force: true });
  expect(result.stdout).toContain('"pass":false');
  expect(result.stdout).toContain(
    "UNMEASURED — harness.config.json is invalid",
  );
});
