// covers: function:projectHarnessRuntimeData

import { expect, test } from "bun:test";
import { projectHarnessRuntimeData } from "./harness-runtime-data.ts";

const declaration = { name: "future-host", productName: "Future Host", configNextStep: "Reopen the host", harnessDir: ".future", rulesRename: null };

test("a new host ships the selected runtime identity with default rules", () => {
  expect(projectHarnessRuntimeData({ declaration })).toEqual({ schemaVersion: 1, distribution: "future-host", productName: "Future Host", configNextStep: "Reopen the host", name: "future-host", harnessDir: ".future", rulesSubdir: "rules" });
});

test("runtime identity serialization retains field order", () => {
  expect(JSON.stringify(projectHarnessRuntimeData({ declaration }))).toBe('{"schemaVersion":1,"distribution":"future-host","productName":"Future Host","configNextStep":"Reopen the host","name":"future-host","harnessDir":".future","rulesSubdir":"rules"}');
});

test("the projection is a fresh object and leaves its declaration intact", () => {
  expect(projectHarnessRuntimeData({ declaration })).not.toBe(projectHarnessRuntimeData({ declaration }));
  expect(declaration).toEqual({ name: "future-host", productName: "Future Host", configNextStep: "Reopen the host", harnessDir: ".future", rulesRename: null });
});

test("unknown manifest keys cannot enter runtime data or override its schema", () => {
  const extended = { ...declaration, schemaVersion: 99, privateBuildInput: "not-runtime", plugins: ["local-choice"] };
  expect(projectHarnessRuntimeData({ declaration: extended })).toEqual({ schemaVersion: 1, distribution: "future-host", productName: "Future Host", configNextStep: "Reopen the host", name: "future-host", harnessDir: ".future", rulesSubdir: "rules" });
});

test.each(["steering", "aidlc-rules", ""])("an explicitly declared rules directory is retained: %s", (rulesRename) => {
  expect(projectHarnessRuntimeData({ declaration: { ...declaration, rulesRename } }).rulesSubdir).toBe(rulesRename);
});

test("an empty runner-frontmatter list is omitted", () => {
  expect(projectHarnessRuntimeData({ declaration: { ...declaration, runnerFrontmatterAdditions: [] } })).not.toHaveProperty("runnerFrontmatterAdditions");
});

test("nonempty runner frontmatter retains the supplied lines", () => {
  const lines = ["tools: [read]"];
  expect(projectHarnessRuntimeData({ declaration: { ...declaration, runnerFrontmatterAdditions: lines } }).runnerFrontmatterAdditions).toBe(lines);
});

test("null document extractors are omitted", () => {
  expect(projectHarnessRuntimeData({ declaration: { ...declaration, documentExtractors: null } })).not.toHaveProperty("documentExtractors");
});

test("an explicitly empty extractor object remains declared", () => {
  const documentExtractors = {};
  expect(projectHarnessRuntimeData({ declaration: { ...declaration, documentExtractors } }).documentExtractors).toBe(documentExtractors);
});

test("hook activation retains the declared host action", () => {
  const hookActivation = { recovery: "Reopen this host" };
  expect(projectHarnessRuntimeData({ declaration: { ...declaration, hookActivation } }).hookActivation).toBe(hookActivation);
});

test("the Kiro layout is manifest data", () => {
  expect(projectHarnessRuntimeData({ declaration: { ...declaration, kiroLayout: "kas" } }).kiroLayout).toBe("kas");
});

test("zero directive cap remains omitted", () => {
  expect(projectHarnessRuntimeData({ declaration: { ...declaration, directiveMaxBytes: 0 } })).not.toHaveProperty("directiveMaxBytes");
});

test.each([12000, -1])("a truthy directive cap retains the declared value: %s", (directiveMaxBytes) => {
  expect(projectHarnessRuntimeData({ declaration: { ...declaration, directiveMaxBytes } }).directiveMaxBytes).toBe(directiveMaxBytes);
});

test("a declared status-line object remains present even with no items", () => {
  const statusLine = { items: [] };
  expect(projectHarnessRuntimeData({ declaration: { ...declaration, statusLine } }).statusLine).toBe(statusLine);
});

test("agent finish recording remains declared even with no environment names", () => {
  const agentFinishRecorded = { env: [] };
  expect(projectHarnessRuntimeData({ declaration: { ...declaration, agentFinishRecorded } }).agentFinishRecorded).toBe(agentFinishRecorded);
});
