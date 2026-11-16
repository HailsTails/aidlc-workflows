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
import { host, path, source } from "../../kernel/fixtures/values.fixture.ts";
import type { LegacyRunnerScratch } from "../application/ports/legacy-runner.ts";
import { prepareCapturedLegacySkillTables, prepareLegacySkillTables, prepareCapturedLegacyFormatting }
  from "./legacy-skill-tables.ts";
import { accept } from "../../kernel/fixtures/accept.ts";
import { methodSource } from "../../workflow-definition/fixtures/method-source.fixture.ts";

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
const capturedFiles = () => [{ path: path(".claude/tools/aidlc-utility.ts"),
  content: { kind: "text" as const, text: "captured formatter" }, mode: "regular" as const,
  origin: { kind: "neutral" as const, source: source("tools/aidlc-utility.ts") } },
  { path: path(".claude/tools/data/stage-graph.json"), content: { kind: "text" as const, text: "captured graph" },
    mode: "regular" as const,
    origin: { kind: "runtime-data" as const, name: "stage-graph" as const } }];

test("a clean full build runs only the captured formatter and graph inside its private frame", async () => {
  const scratch = createInMemoryFileSystem({ files: {} });
  const writeFile = mock<LegacyRunnerScratch["writeFile"]>(scratch.writeFile);
  const processRunner = createScriptedProcessRunner({ outcome: accepted({
    exit: { kind: "exited", code: 0 }, stdout: "captured tables\n", stderr: "",
  }) });
  const tables = await prepareCapturedLegacySkillTables({ ...request, files: capturedFiles() },
    { frames, processRunner, scratch: { ...scratch, writeFile } });
  expect(tables("stage-table")).toEqual(accepted("captured tables\n"));
  expect(tables("scope-table")).toEqual(accepted("captured tables\n"));
  expect(processRunner.received()[0]?.argv).toEqual(["--no-install",
    { kind: "path", location: new URL("file:///frames/scratch-2/.claude/tools/aidlc-utility.ts") }, "stage-table"]);
  expect(processRunner.received()[0]?.env["AIDLC_STAGE_GRAPH"]).toEqual({ kind: "path",
    location: new URL("file:///frames/scratch-2/.claude/tools/data/stage-graph.json") });
  expect(writeFile).toHaveBeenCalledWith({ file: new URL("file:///frames/scratch-2/.claude/tools/data/stage-graph.json"),
    content: { kind: "text", text: "captured graph" } });
  expect(writeFile).toHaveBeenCalledTimes(3);
  expect(scratch.snapshot()).toEqual({});
});

test("captured program write refusal launches nothing and cleans its private frame", async () => {
  const scratch = createInMemoryFileSystem({ files: {}, faults: {
    ["file:///frames/scratch-2/.claude/tools/aidlc-utility.ts"]: "permission-denied",
  } });
  const processRunner = createScriptedProcessRunner({ outcome: refused({ kind: "not-started", reason: "Unused" }) });
  const removeFolder = mock<LegacyRunnerScratch["removeFolder"]>(scratch.removeFolder);
  const tables = await prepareCapturedLegacySkillTables({ ...request, files: capturedFiles() },
    { frames, processRunner, scratch: { ...scratch, removeFolder } });
  expect(tables("stage-table")).toEqual(refused(
    "The captured formatter program is unwritable: .claude/tools/aidlc-utility.ts: permission-denied"));
  expect(processRunner.received()).toEqual([]);
  expect(removeFolder).toHaveBeenCalledTimes(1);
  expect(scratch.snapshot()).toEqual({});
});

const formattingRequest = () => ({ ...request, harnessName: "claude", harnessDir: ".claude",
  files: capturedFiles(), sources: [
    { owner: { kind: "core" as const }, path: methodSource({ kind: "scope", within: "aidlc-classic.md" }),
      content: { kind: "text" as const, text: "Captured classic" } },
    { owner: { kind: "core" as const }, path: methodSource({ kind: "scope", within: "aidlc-feature.md" }),
      content: { kind: "text" as const, text: "Captured feature" } },
  ] });

test("commands and skill tables consume one captured program frame before it is removed", async () => {
  const scratch = createInMemoryFileSystem({ files: {} });
  const removeFolder = mock<LegacyRunnerScratch["removeFolder"]>(scratch.removeFolder);
  const processRunner = createScriptedProcessRunner({ outcome: accepted({
    exit: { kind: "exited", code: 0 }, stderr: "", stdout: '{"failure":null,"entries":[' +
      '{"subject":{"concept":"orchestrator-skill","name":"aidlc-init"},"files":null,"reason":null}]}',
  }) });
  const formatting = accept(await prepareCapturedLegacyFormatting(formattingRequest(),
    { frames, processRunner, scratch: { ...scratch, removeFolder }, child: new URL("file:///entry.ts") }));
  expect(formatting.commands.read({ concept: "orchestrator-skill", name: "aidlc-init" }))
    .toEqual(accepted({ kind: "declined" }));
  expect(JSON.parse(processRunner.received()[0]?.input ?? "").module)
    .toBe("file:///frames/scratch-2/.claude/tools/aidlc-runner-gen.ts");
  expect(processRunner.received()[1]?.argv[1]).toEqual({ kind: "path",
    location: new URL("file:///frames/scratch-2/.claude/tools/aidlc-utility.ts") });
  expect(processRunner.received()[2]?.argv[1]).toEqual({ kind: "path",
    location: new URL("file:///frames/scratch-2/.claude/tools/aidlc-utility.ts") });
  expect(removeFolder).toHaveBeenCalledTimes(1);
  expect(removeFolder).toHaveBeenCalledWith({ folder: new URL("file:///frames/scratch-2/") });
  expect(scratch.snapshot()).toEqual({});
});

test("a captured command program write failure is subjectless and cleans the only frame", async () => {
  const scratch = createInMemoryFileSystem({ files: {}, faults: {
    ["file:///frames/scratch-2/.claude/tools/aidlc-utility.ts"]: "permission-denied",
  } });
  const processRunner = createScriptedProcessRunner({ outcome: refused({ kind: "not-started", reason: "Unused" }) });
  expect(await prepareCapturedLegacyFormatting(formattingRequest(),
    { frames, processRunner, scratch, child: new URL("file:///entry.ts") })).toEqual(refused({
      kind: "command-source-failed",
      reason: "The captured formatter program is unwritable: .claude/tools/aidlc-utility.ts: permission-denied",
    }));
  expect(processRunner.received()).toEqual([]);
  expect(scratch.snapshot()).toEqual({});
});
