import { expect, mock, test } from "bun:test";
import { prepareProjectionMetadata, projectionMetadataText, type ProjectionMetadataDeclaration, type ProjectionMetadataRules } from "./projection-metadata.ts";

const DECLARATION: ProjectionMetadataDeclaration = Object.freeze({ name: "test", productName: "Test", configNextStep: "Open test", harnessDir: ".test" });
const DESCRIPTOR = { schemaVersion: 1, distribution: "test", productName: "Test", configNextStep: "Open test", harnessDir: ".test", managedDirectories: ["empty", ".test"], rootIntegrations: [] };
const ruleFixture = () => ({ encodeRootIntegration: mock<ProjectionMetadataRules["encodeRootIntegration"]>().mockReturnValue({ path: "root.json", policy: "whole-file", extendedPolicy: "json-entries" }) });

test("assembles explicit observed metadata without sorting or new version policy", () => {
  const rules = ruleFixture();
  expect(prepareProjectionMetadata({ declaration: DECLARATION, managedDirectories: ["empty", ".test"], rootIntegrations: [], buildVersion: "caller-version", rules })).toEqual({ projection: { schemaVersion: 1, distribution: "test", productName: "Test", configNextStep: "Open test", harnessDir: ".test", managedDirectories: ["empty", ".test"], rootIntegrations: [] }, stamp: { schemaVersion: 1, frameworkVersion: "caller-version", distribution: "test", harnessDir: ".test" } });
  expect(rules.encodeRootIntegration.mock.calls).toEqual([]);
});

test("delegates exact prepared root integration to the caller codec", () => {
  const rules = ruleFixture();
  expect(prepareProjectionMetadata({ declaration: DECLARATION, managedDirectories: ["empty", ".test"], rootIntegrations: [{ path: "root.json", policy: "json-entries", optional: true, legacySignatures: { wholeFileHashes: ["sha256:observed"] } }], buildVersion: "1.2.3", rules }).projection).toEqual({ ...DESCRIPTOR, rootIntegrations: [{ path: "root.json", policy: "whole-file", extendedPolicy: "json-entries" }] });
  expect(rules.encodeRootIntegration.mock.calls).toEqual([[{ integration: { path: "root.json", policy: "json-entries", optional: true, legacySignatures: { wholeFileHashes: ["sha256:observed"] } } }]]);
});

const OPTIONAL_CASES: readonly { name: string; declaration: ProjectionMetadataDeclaration; expected: Readonly<Record<string, unknown>> }[] = [
  { name: "optional display and setup fields", declaration: { ...DECLARATION, choiceName: "Choice", choiceNote: "Note", firstRunSteps: ["First", ""], editorTerminalApp: "editor" }, expected: { schemaVersion: 1, distribution: "test", productName: "Test", choiceName: "Choice", choiceNote: "Note", configNextStep: "Open test", firstRunSteps: ["First", ""], editorTerminalApp: "editor", harnessDir: ".test", managedDirectories: ["empty", ".test"], rootIntegrations: [] } },
  { name: "empty display fields omitted but steps array retained", declaration: { ...DECLARATION, choiceName: "", choiceNote: "", firstRunSteps: [], editorTerminalApp: "" }, expected: { schemaVersion: 1, distribution: "test", productName: "Test", configNextStep: "Open test", firstRunSteps: [], harnessDir: ".test", managedDirectories: ["empty", ".test"], rootIntegrations: [] } },
  { name: "harness onboarding overrides root placement", declaration: { ...DECLARATION, onboarding: { dst: "ROOT.md", harnessDst: "LOCAL.md", projectRoot: true } }, expected: { ...DESCRIPTOR, onboarding: ".test/LOCAL.md" } },
  { name: "ordinary harness onboarding", declaration: { ...DECLARATION, onboarding: { dst: "LOCAL.md" } }, expected: { ...DESCRIPTOR, onboarding: ".test/LOCAL.md" } },
  { name: "root onboarding omitted", declaration: { ...DECLARATION, onboarding: { dst: "ROOT.md", projectRoot: true } }, expected: DESCRIPTOR },
  { name: "null onboarding omitted", declaration: { ...DECLARATION, onboarding: null }, expected: DESCRIPTOR },
  { name: "empty harness destination falls back", declaration: { ...DECLARATION, onboarding: { dst: "LOCAL.md", harnessDst: "" } }, expected: { ...DESCRIPTOR, onboarding: ".test/LOCAL.md" } },
];

test.each([...OPTIONAL_CASES])("Native metadata assembly: $name", ({ declaration, expected }) => {
  const rules = ruleFixture();
  expect(prepareProjectionMetadata({ declaration, managedDirectories: ["empty", ".test"], rootIntegrations: [], buildVersion: "1.2.3", rules }).projection).toEqual(expected);
  expect(rules.encodeRootIntegration.mock.calls).toEqual([]);
});

test("uses exact Native pretty JSON and newline without key reordering", () => {
  expect(projectionMetadataText({ value: { schemaVersion: 1, frameworkVersion: "1.2.3", distribution: "test", harnessDir: ".test" } })).toBe('{\n  "schemaVersion": 1,\n  "frameworkVersion": "1.2.3",\n  "distribution": "test",\n  "harnessDir": ".test"\n}\n');
});

test("encoding preserves escaped values and empty collections", () => {
  expect(projectionMetadataText({ value: { text: "line\n\"quoted\"", list: [], object: {} } })).toBe('{\n  "text": "line\\n\\"quoted\\"",\n  "list": [],\n  "object": {}\n}\n');
});

test("assembled descriptor retains Native field order", () => {
  const rules = ruleFixture();
  const metadata = prepareProjectionMetadata({ declaration: DECLARATION, managedDirectories: ["empty", ".test"], rootIntegrations: [], buildVersion: "1.2.3", rules });
  expect(projectionMetadataText({ value: metadata.projection })).toBe('{\n  "schemaVersion": 1,\n  "distribution": "test",\n  "productName": "Test",\n  "configNextStep": "Open test",\n  "harnessDir": ".test",\n  "managedDirectories": [\n    "empty",\n    ".test"\n  ],\n  "rootIntegrations": []\n}\n');
  expect(projectionMetadataText({ value: metadata.stamp })).toBe('{\n  "schemaVersion": 1,\n  "frameworkVersion": "1.2.3",\n  "distribution": "test",\n  "harnessDir": ".test"\n}\n');
  expect(rules.encodeRootIntegration.mock.calls).toEqual([]);
});
