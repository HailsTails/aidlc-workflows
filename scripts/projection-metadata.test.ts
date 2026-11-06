import { expect, test } from "bun:test";
import { planProjectionMetadata, prepareProjectionMetadata } from "./projection-metadata.ts";
import type { HarnessManifest, RootIntegration } from "./manifest-types.ts";
import { createMetadataRuleFixture, metadataDeclaration, metadataProjectionBytes, metadataStampBytes, rootProjectionBytes, previewStampBytes, optionalProjectionBytes, localOnboardingProjectionBytes } from "./__tests__/projection-metadata-fixtures.ts";

test("serializes the declared projection and explicit build stamp with exact Native bytes", () => {
  const fixture = createMetadataRuleFixture();
  expect(prepareProjectionMetadata({ rules: fixture.rules, declaration: metadataDeclaration, files: [".engine/tools/tool.ts"], directories: ["empty", ".engine"], rootFiles: [], buildVersion: "1.2.3" })).toEqual({ kind: "prepared", artifacts: [
    { file: ".engine/tools/data/aidlc-projection.json", bytes: metadataProjectionBytes },
    { file: ".engine/tools/data/aidlc-stamp.json", bytes: metadataStampBytes },
  ] });
  expect(fixture.rules.choiceText.mock.calls).toEqual([[{ declaration: metadataDeclaration }]]);
  expect(fixture.rules.shipsRootBlock.mock.calls).toEqual([]);
  expect(fixture.rules.encodeRootIntegration.mock.calls).toEqual([]);
});

test("retains optional descriptor fields and gives explicit harness onboarding priority over project-root placement", () => {
  const fixture = createMetadataRuleFixture();
  const declaration: HarnessManifest = { ...metadataDeclaration, choiceName: "Choice", choiceNote: "Note", firstRunSteps: ["First", "Second"], editorTerminalApp: "Editor", onboarding: { dst: "ROOT.md", harnessDst: "NATIVE.md", projectRoot: true, fills: { invoke: "/aidlc", slots: {} } } };
  expect(prepareProjectionMetadata({ rules: fixture.rules, declaration, files: [".engine/NATIVE.md"], directories: ["empty", ".engine"], rootFiles: [], buildVersion: "1.2.3" })).toEqual({ kind: "prepared", artifacts: [
    { file: ".engine/tools/data/aidlc-projection.json", bytes: optionalProjectionBytes },
    { file: ".engine/tools/data/aidlc-stamp.json", bytes: metadataStampBytes },
  ] });
  expect(fixture.rules.choiceText.mock.calls).toEqual([[{ declaration }]]);
});

test("selects ordinary harness-local onboarding when no explicit harness destination is declared", () => {
  const fixture = createMetadataRuleFixture();
  expect(prepareProjectionMetadata({ rules: fixture.rules, declaration: { ...metadataDeclaration, onboarding: { dst: "LOCAL.md", fills: { invoke: "/aidlc", slots: {} } } }, files: [".engine/LOCAL.md"], directories: ["empty", ".engine"], rootFiles: [], buildVersion: "1.2.3" })).toEqual({ kind: "prepared", artifacts: [
    { file: ".engine/tools/data/aidlc-projection.json", bytes: localOnboardingProjectionBytes },
    { file: ".engine/tools/data/aidlc-stamp.json", bytes: metadataStampBytes },
  ] });
});

test("omits project-root onboarding from the engine-local onboarding descriptor", () => {
  const fixture = createMetadataRuleFixture();
  expect(prepareProjectionMetadata({ rules: fixture.rules, declaration: { ...metadataDeclaration, onboarding: { dst: "ROOT.md", projectRoot: true, fills: { invoke: "/aidlc", slots: {} } } }, files: [".engine/tool.ts"], directories: ["empty", ".engine"], rootFiles: [], buildVersion: "1.2.3" })).toEqual({ kind: "prepared", artifacts: [
    { file: ".engine/tools/data/aidlc-projection.json", bytes: metadataProjectionBytes },
    { file: ".engine/tools/data/aidlc-stamp.json", bytes: metadataStampBytes },
  ] });
});

test("null onboarding leaves descriptor metadata unchanged", () => {
  const fixture = createMetadataRuleFixture();
  expect(prepareProjectionMetadata({ rules: fixture.rules, declaration: { ...metadataDeclaration, onboarding: null }, files: [".engine/tool.ts"], directories: ["empty", ".engine"], rootFiles: [], buildVersion: "1.2.3" })).toEqual({ kind: "prepared", artifacts: [
    { file: ".engine/tools/data/aidlc-projection.json", bytes: metadataProjectionBytes },
    { file: ".engine/tools/data/aidlc-stamp.json", bytes: metadataStampBytes },
  ] });
});

test("root-only directories remain project-owned, while truly empty directories remain managed", () => {
  const fixture = createMetadataRuleFixture();
  expect(planProjectionMetadata({ rules: fixture.rules, declaration: { ...metadataDeclaration, rootIntegrations: [{ path: ".vscode/settings.json", policy: "jsonc-settings" }] }, files: [".engine/tools/tool.ts", ".vscode/settings.json"], directories: [".vscode", ".vscode/empty-child", "empty", ".engine"] })).toEqual({ kind: "planned", managedDirectories: [".engine", "empty"], rootPathsToRead: [] });
});

test("a directory with any non-root content remains a managed directory", () => {
  const fixture = createMetadataRuleFixture();
  expect(planProjectionMetadata({ rules: fixture.rules, declaration: { ...metadataDeclaration, rootIntegrations: [{ path: ".vscode/settings.json", policy: "jsonc-settings" }] }, files: [".engine/tools/tool.ts", ".vscode/settings.json", ".vscode/extension.txt"], directories: [".vscode", ".engine"] })).toEqual({ kind: "planned", managedDirectories: [".engine", ".vscode"], rootPathsToRead: [] });
});

const rootedDeclaration: HarnessManifest = { ...metadataDeclaration, rootIntegrations: [
  { path: ".gitignore", policy: "managed-block", marker: "gitignore", legacySignatures: { wholeFileHashes: ["sha256:old", "sha256:new", "sha256:old"], jsonEntryHashes: { scripts: ["sha256:entry"] } } },
  { path: ".mcp.json", policy: "json-map", optional: true },
  { path: "opencode.json", policy: "json-entries" },
  { path: ".vscode/settings.json", policy: "jsonc-settings" },
] };

test("plans reads only for admitted shipped-block decisions", () => {
  const fixture = createMetadataRuleFixture();
  fixture.rules.shipsRootBlock.mockReturnValueOnce("shipped").mockReturnValueOnce("shipped").mockReturnValueOnce("shipped").mockReturnValueOnce("not-shipped");
  expect(planProjectionMetadata({ rules: fixture.rules, declaration: rootedDeclaration, files: [".engine/tools/tool.ts", ".gitignore", ".mcp.json", "opencode.json", ".vscode/settings.json"], directories: ["empty", ".vscode", ".engine"] })).toEqual({ kind: "planned", managedDirectories: [".engine", "empty"], rootPathsToRead: [".gitignore", ".mcp.json", "opencode.json"] });
});

const nonBlockIntegrations: RootIntegration[] = [
  { path: "owned.json", policy: "whole-file" },
  { path: "owned.json", policy: "json-array" },
  { path: "owned.json", policy: "json-map" },
  { path: "owned.json", policy: "json-map", optional: false },
  { path: "owned.json", policy: "jsonc-settings" },
];
test.each(nonBlockIntegrations)("does not override a not-shipped rule decision using the filename or policy: $policy", (integration) => {
  const fixture = createMetadataRuleFixture();
  expect(planProjectionMetadata({ rules: fixture.rules, declaration: { ...metadataDeclaration, rootIntegrations: [integration] }, files: ["owned.json"], directories: [".engine"] })).toEqual({ kind: "planned", managedDirectories: [".engine"], rootPathsToRead: [] });
  expect(fixture.rules.shipsRootBlock.mock.calls).toEqual([[{ integration }]]);
});

test("preserves opaque roots and forwards updated signatures to the encoder without changing its replies", () => {
  const fixture = createMetadataRuleFixture();
  fixture.rules.shipsRootBlock.mockReturnValueOnce("shipped").mockReturnValueOnce("shipped").mockReturnValueOnce("shipped").mockReturnValueOnce("not-shipped").mockReturnValueOnce("shipped").mockReturnValueOnce("shipped").mockReturnValueOnce("shipped").mockReturnValueOnce("not-shipped").mockReturnValueOnce("shipped").mockReturnValueOnce("shipped").mockReturnValueOnce("shipped").mockReturnValueOnce("not-shipped");
  fixture.rules.encodeRootIntegration.mockReturnValueOnce({ path: ".gitignore", policy: "managed-block", marker: "gitignore", legacySignatures: { wholeFileHashes: ["sha256:old", "sha256:new"], jsonEntryHashes: { scripts: ["sha256:entry"] } } }).mockReturnValueOnce({ path: ".mcp.json", policy: "json-map", optional: true }).mockReturnValueOnce({ path: "opencode.json", policy: "whole-file", extendedPolicy: "json-entries" }).mockReturnValueOnce({ path: ".vscode/settings.json", policy: "whole-file", extendedPolicy: "jsonc-settings" });
  expect(prepareProjectionMetadata({ rules: fixture.rules, declaration: rootedDeclaration, files: [".engine/tools/tool.ts", ".gitignore", ".mcp.json", "opencode.json", ".vscode/settings.json"], directories: ["empty", ".vscode", ".engine"], rootFiles: [
    { path: ".gitignore", fileName: ".gitignore", bytes: new Uint8Array([255, 0]), sha256: "sha256:new" },
    { path: ".mcp.json", fileName: ".mcp.json", bytes: new Uint8Array([123, 125]), sha256: "sha256:unused-json" },
    { path: "opencode.json", fileName: "opencode.json", bytes: new Uint8Array([10]), sha256: "sha256:unused-entry" },
  ], buildVersion: "1.2.3" })).toEqual({ kind: "prepared", artifacts: [
    { file: ".engine/tools/data/root-blocks/gitignore", bytes: new Uint8Array([255, 0]) },
    { file: ".engine/tools/data/root-blocks/.mcp.json", bytes: new Uint8Array([123, 125]) },
    { file: ".engine/tools/data/root-blocks/opencode.json", bytes: new Uint8Array([10]) },
    { file: ".engine/tools/data/aidlc-projection.json", bytes: rootProjectionBytes },
    { file: ".engine/tools/data/aidlc-stamp.json", bytes: metadataStampBytes },
  ] });
  expect(rootedDeclaration.rootIntegrations[0]?.legacySignatures).toEqual({ wholeFileHashes: ["sha256:old", "sha256:new", "sha256:old"], jsonEntryHashes: { scripts: ["sha256:entry"] } });
  expect(fixture.rules.encodeRootIntegration.mock.calls).toEqual([
    [{ integration: { path: ".gitignore", policy: "managed-block", marker: "gitignore", legacySignatures: { wholeFileHashes: ["sha256:old", "sha256:new"], jsonEntryHashes: { scripts: ["sha256:entry"] } } } }],
    [{ integration: { path: ".mcp.json", policy: "json-map", optional: true } }],
    [{ integration: { path: "opencode.json", policy: "json-entries" } }],
    [{ integration: { path: ".vscode/settings.json", policy: "jsonc-settings" } }],
  ]);
});

const refusalControls: { readonly declaration: HarnessManifest; readonly files: readonly string[]; readonly directories: readonly string[]; readonly message: string; readonly choiceDecision: "plain" | "invalid" }[] = [
  { declaration: { ...metadataDeclaration, choiceName: "invalid\nchoice", rootIntegrations: [{ path: "missing", policy: "whole-file" }, { path: "missing", policy: "whole-file" }] }, files: [], directories: [], message: "[fixture] choiceName or choiceNote is not text the harness lists can show", choiceDecision: "invalid" },
  { declaration: { ...metadataDeclaration, rootIntegrations: [{ path: "missing", policy: "whole-file" }, { path: "missing", policy: "whole-file" }] }, files: [], directories: [], message: "[fixture] duplicate root integration path", choiceDecision: "plain" },
  { declaration: { ...metadataDeclaration, rootIntegrations: [{ path: "missing", policy: "whole-file" }] }, files: ["unclassified"], directories: [], message: "[fixture] root integration is not projected: missing", choiceDecision: "plain" },
  { declaration: metadataDeclaration, files: ["z.txt", "a.txt"], directories: [], message: "[fixture] unclassified projection entries: a.txt, z.txt", choiceDecision: "plain" },
];
test.each(refusalControls)("preserves Native policy refusal order: $message", ({ declaration, files, directories, message, choiceDecision }) => {
  const fixture = createMetadataRuleFixture();
  fixture.rules.choiceText.mockReturnValue(choiceDecision);
  expect(planProjectionMetadata({ rules: fixture.rules, declaration, files, directories })).toEqual({ kind: "refused", message });
});

test("missing projected root bytes refuse before producing any artifacts", () => {
  const fixture = createMetadataRuleFixture();
  fixture.rules.shipsRootBlock.mockReturnValue("shipped");
  expect(prepareProjectionMetadata({ rules: fixture.rules, declaration: { ...metadataDeclaration, rootIntegrations: [{ path: ".gitignore", policy: "managed-block" }] }, files: [".gitignore"], directories: [], rootFiles: [], buildVersion: "1.2.3" })).toEqual({ kind: "refused", message: "[fixture] root integration bytes unavailable: .gitignore" });
});

test("duplicate root byte observations cannot choose a different signature or body", () => {
  const fixture = createMetadataRuleFixture();
  fixture.rules.shipsRootBlock.mockReturnValue("shipped");
  expect(prepareProjectionMetadata({ rules: fixture.rules, declaration: { ...metadataDeclaration, rootIntegrations: [{ path: ".gitignore", policy: "managed-block" }] }, files: [".gitignore"], directories: [], rootFiles: [{ path: ".gitignore", fileName: ".gitignore", bytes: new Uint8Array([1]), sha256: "sha256:first" }, { path: ".gitignore", fileName: ".gitignore", bytes: new Uint8Array([2]), sha256: "sha256:second" }], buildVersion: "1.2.3" })).toEqual({ kind: "refused", message: "[fixture] duplicate projected root file bytes" });
});

test("explicit valid preview version is stamped without reading ambient release settings", () => {
  const fixture = createMetadataRuleFixture();
  expect(prepareProjectionMetadata({ rules: fixture.rules, declaration: metadataDeclaration, files: [".engine/tools/tool.ts"], directories: ["empty", ".engine"], rootFiles: [], buildVersion: "1.2.4-preview.20261107.1" })).toEqual({ kind: "prepared", artifacts: [
    { file: ".engine/tools/data/aidlc-projection.json", bytes: metadataProjectionBytes },
    { file: ".engine/tools/data/aidlc-stamp.json", bytes: previewStampBytes },
  ] });
});

test.each(["invalid", "1.2.3\n", "1.2.3-preview.fake.1"])("Native version identifier grammar rejects invalid explicit build version: %s", (buildVersion) => {
  const fixture = createMetadataRuleFixture();
  expect(prepareProjectionMetadata({ rules: fixture.rules, declaration: metadataDeclaration, files: [], directories: [], rootFiles: [], buildVersion })).toEqual({ kind: "refused", message: "[fixture] invalid projection build version" });
});
