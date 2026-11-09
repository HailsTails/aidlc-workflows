import { expect, test } from "bun:test";
import { methodSliceFixture } from "../../workflow-definition/fixtures/method.fixture.ts";
import { legacySkillScopeMapping } from "./legacy-skill-tables.ts";

test("the formatter receives scope metadata and compiled Method memberships without an authored reader", () => {
  expect(legacySkillScopeMapping(methodSliceFixture)).toMatchObject({
    feature: { depth: "Standard", stages: { "requirements-analysis": "EXECUTE",
      "units-generation": "EXECUTE", "code-generation": "EXECUTE" } },
  });
});

import { mock } from "bun:test";
import { accepted, refused } from "../../kernel/result.ts";
import { createInMemoryFileSystem } from "../../kernel/fixtures/file-system.fake.ts";
import { createScriptedProcessRunner } from "../../kernel/fixtures/process-runner.fake.ts";
import { host } from "../../kernel/fixtures/values.fixture.ts";
import type { LegacyRunnerScratch } from "../application/ports.ts";
import { prepareLegacySkillTables } from "./legacy-skill-tables.ts";

const request = { method: methodSliceFixture, host: host({ name: "claude", directory: ".claude" }),
  projectRoot: new URL("file:///built%20copy/") };
const frames = new URL("file:///frames/");

test("the frozen built formatter receives captured scope data and its exact compiled graph", async () => {
  const scratch = createInMemoryFileSystem({ files: {} });
  const writeFile = mock<LegacyRunnerScratch["writeFile"]>(scratch.writeFile);
  const removeFolder = mock<LegacyRunnerScratch["removeFolder"]>(scratch.removeFolder);
  const processRunner = createScriptedProcessRunner({ outcome: accepted({
    exit: { kind: "exited", code: 0 }, stdout: "canonical region\n", stderr: "",
  }) });
  const tables = await prepareLegacySkillTables(request, { frames, processRunner,
    scratch: { ...scratch, writeFile, removeFolder } });
  expect(tables("stage-table")).toEqual(accepted("canonical region\n"));
  expect(tables("scope-table")).toEqual(accepted("canonical region\n"));
  expect(processRunner.received()[0]?.argv).toEqual([
    "--no-install", { kind: "path", location: new URL("file:///built%20copy/.claude/tools/aidlc-utility.ts") },
    "stage-table",
  ]);
  expect(processRunner.received()[1]?.argv[2]).toBe("scope-table");
  expect(processRunner.received()[0]?.env["AIDLC_STAGE_GRAPH"]).toEqual({ kind: "path",
    location: new URL("file:///built%20copy/.claude/tools/data/stage-graph.json") });
  expect(processRunner.received()[0]?.env).toHaveProperty("AIDLC_SCOPE_MAPPING",
    { kind: "path", location: writeFile.mock.calls[0]?.[0].file });
  expect(writeFile).toHaveBeenCalledTimes(1);
  expect(removeFolder).toHaveBeenCalledTimes(1);
});

test("a stage formatter refusal stops the scope process and still cleans its frame", async () => {
  const scratch = createInMemoryFileSystem({ files: {} });
  const removeFolder = mock<LegacyRunnerScratch["removeFolder"]>(scratch.removeFolder);
  const processRunner = createScriptedProcessRunner({ outcome: refused({
    kind: "not-started", reason: "Runtime unavailable",
  }) });
  const tables = await prepareLegacySkillTables(request, { frames, processRunner,
    scratch: { ...scratch, removeFolder } });
  expect(tables("stage-table")).toEqual(refused("Runtime unavailable"));
  expect(tables("scope-table")).toEqual(refused("Runtime unavailable"));
  expect(processRunner.received()).toHaveLength(1);
  expect(removeFolder).toHaveBeenCalledTimes(1);
});

test("scope snapshot write failure launches no process and remains refusal data", async () => {
  const scratch = createInMemoryFileSystem({ files: {} });
  const removeFolder = mock<LegacyRunnerScratch["removeFolder"]>(scratch.removeFolder);
  const writeFile = mock<LegacyRunnerScratch["writeFile"]>(async () => refused({
    kind: "unwritable", code: "permission-denied",
  }));
  const processRunner = createScriptedProcessRunner({ outcome: refused({ kind: "not-started", reason: "Unused" }) });
  const tables = await prepareLegacySkillTables(request, { frames, processRunner,
    scratch: { ...scratch, writeFile, removeFolder } });
  expect(tables("stage-table"))
    .toEqual(refused("The captured scope mapping could not be written: permission-denied"));
  expect(processRunner.received()).toEqual([]);
  expect(removeFolder).toHaveBeenCalledTimes(1);
});