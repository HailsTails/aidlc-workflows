// covers: file:scripts/projection-metadata-filesystem.ts, file:scripts/projection/native/projection-metadata.ts
import { afterEach, expect, test } from "bun:test";
import { existsSync, linkSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import claude from "../harness/claude/manifest.ts";
import { sha256Bytes } from "../core/tools/aidlc-distribution.ts";
import type { HarnessManifest } from "./manifest-types.ts";
import { writeProjectionMetadata } from "./projection-metadata-filesystem.ts";
import { prepareProjectionMetadata } from "./projection/native/projection-metadata.ts";

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
const declaration = (extra: Partial<HarnessManifest> = {}): HarnessManifest => ({ ...claude, name: "foo", productName: "Test", configNextStep: "Open test", harnessDir: ".foo", onboarding: null, rootIntegrations: [], ...extra });
function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), "projection-metadata-"));
  roots.push(root);
  mkdirSync(join(root, ".foo"));
  return root;
}
function write(root: string, path: string, value: string | Uint8Array): void {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), value);
}
const read = (root: string, path: string) => readFileSync(join(root, path), "utf8");
const descriptorPath = ".foo/tools/data/aidlc-projection.json";
const stampPath = ".foo/tools/data/aidlc-stamp.json";
const descriptor = { schemaVersion: 1, distribution: "foo", productName: "Test", configNextStep: "Open test", harnessDir: ".foo", managedDirectories: [".foo"], rootIntegrations: [] };
const publish = (root: string, manifest = declaration()) => writeProjectionMetadata({ root, declaration: manifest, buildVersion: "1.2.3" });

test("unknown identity uses the retained descriptor and stamp byte order", () => {
  const root = fixture();
  publish(root);
  expect(read(root, descriptorPath)).toBe(`${JSON.stringify(descriptor, null, 2)}\n`);
  expect(read(root, stampPath)).toBe('{\n  "schemaVersion": 1,\n  "frameworkVersion": "1.2.3",\n  "distribution": "foo",\n  "harnessDir": ".foo"\n}\n');
});

test("root-only nested containers remain project owned and empty directories remain managed", () => {
  const root = fixture();
  mkdirSync(join(root, ".vscode/nested/empty"), { recursive: true });
  mkdirSync(join(root, "empty/deeper"), { recursive: true });
  write(root, ".vscode/nested/settings.json", "{}\n");
  const rootIntegrations = [{ path: ".vscode/nested/settings.json", policy: "jsonc-settings" as const }];
  publish(root, declaration({ rootIntegrations }));
  expect(JSON.parse(read(root, descriptorPath))).toEqual({ ...descriptor, managedDirectories: [".foo", "empty"], rootIntegrations: [{ ...rootIntegrations[0], policy: "whole-file", extendedPolicy: "jsonc-settings" }] });
  expect(existsSync(join(root, ".vscode/nested/empty"))).toBe(true);
  expect(existsSync(join(root, "empty/deeper"))).toBe(true);
});

test("copies actual binary root bytes, deduplicates exact signatures and overwrites finalizer paths last", () => {
  const root = fixture();
  const bytes = Buffer.from([0, 255, 128, 10, 13]);
  const digest = sha256Bytes(bytes);
  write(root, "nested/ROOT.md", bytes);
  write(root, "optional.json", "{\"optional\":true}\n");
  write(root, "entries.json", "{\"entry\":1}\n");
  write(root, ".foo/tools/data/root-blocks/block", "callback draft");
  write(root, descriptorPath, "callback descriptor");
  write(root, stampPath, "callback stamp");
  const managed = { path: "nested/ROOT.md", policy: "managed-block" as const, marker: "block", legacySignatures: { wholeFileHashes: ["sha256:old", digest], jsonEntryHashes: { retained: ["sha256:entry"] } } };
  const optional = { path: "optional.json", policy: "json-map" as const, optional: true };
  const entries = { path: "entries.json", policy: "json-entries" as const };
  publish(root, declaration({ rootIntegrations: [managed, optional, entries] }));
  expect(readFileSync(join(root, ".foo/tools/data/root-blocks/block"))).toEqual(bytes);
  expect(readFileSync(join(root, "nested/ROOT.md"))).toEqual(bytes);
  expect(read(root, ".foo/tools/data/root-blocks/optional.json")).toBe('{"optional":true}\n');
  expect(read(root, ".foo/tools/data/root-blocks/entries.json")).toBe('{"entry":1}\n');
  expect(JSON.parse(read(root, descriptorPath)).rootIntegrations).toEqual([managed, optional, { ...entries, policy: "whole-file", extendedPolicy: "json-entries" }]);
  expect(JSON.parse(read(root, stampPath)).distribution).toBe("foo");
});

test("managed blocks use basename without a marker and append the current hash after history", () => {
  const root = fixture();
  write(root, "nested/ROOT.md", "actual root\n");
  const integration = { path: "nested/ROOT.md", policy: "managed-block" as const, legacySignatures: { wholeFileHashes: ["sha256:old"] } };
  publish(root, declaration({ rootIntegrations: [integration] }));
  expect(read(root, ".foo/tools/data/root-blocks/ROOT.md")).toBe("actual root\n");
  expect(JSON.parse(read(root, descriptorPath)).rootIntegrations).toEqual([{ ...integration, legacySignatures: { wholeFileHashes: ["sha256:old", sha256Bytes(Buffer.from("actual root\n"))] } }]);
});

test.each([
  { name: "duplicate roots", roots: [{ path: "ROOT.md", policy: "whole-file" as const }, { path: "ROOT.md", policy: "whole-file" as const }], expected: "[foo] duplicate root integration path" },
  { name: "missing declared root", roots: [{ path: "absent.md", policy: "whole-file" as const }], expected: "[foo] root integration is not projected: absent.md" },
  { name: "loose root file", roots: [], expected: "[foo] unclassified projection entries: ROOT.md" },
])("preserves refusal before metadata publication: $name", ({ roots, expected }) => {
  const root = fixture();
  write(root, "ROOT.md", "root\n");
  expect(() => publish(root, declaration({ rootIntegrations: [...roots] }))).toThrow(expected);
  expect(existsSync(join(root, descriptorPath))).toBe(false);
});

test("plain-text choice validation remains owned by the retained producer", () => {
  const root = fixture();
  expect(() => publish(root, declaration({ choiceName: "line\nbreak" }))).toThrow("[foo] choiceName or choiceNote is not text the harness lists can show");
});

const OPTIONAL_CASES: { name: string; extra: Partial<HarnessManifest>; expected: Record<string, unknown> }[] = [
  { name: "optional display and setup fields", extra: { choiceName: "Choice", choiceNote: "Note", firstRunSteps: ["First", ""], editorTerminalApp: "editor" }, expected: { schemaVersion: 1, distribution: "foo", productName: "Test", choiceName: "Choice", choiceNote: "Note", configNextStep: "Open test", firstRunSteps: ["First", ""], editorTerminalApp: "editor", harnessDir: ".foo", managedDirectories: [".foo"], rootIntegrations: [] } },
  { name: "empty steps retained and empty editor omitted", extra: { firstRunSteps: [], editorTerminalApp: "" }, expected: { schemaVersion: 1, distribution: "foo", productName: "Test", configNextStep: "Open test", firstRunSteps: [], harnessDir: ".foo", managedDirectories: [".foo"], rootIntegrations: [] } },
  { name: "harness onboarding overrides root placement", extra: { onboarding: { ...claude.onboarding!, dst: "ROOT.md", harnessDst: "LOCAL.md", projectRoot: true } }, expected: { ...descriptor, onboarding: ".foo/LOCAL.md" } },
  { name: "ordinary harness onboarding", extra: { onboarding: { ...claude.onboarding!, dst: "LOCAL.md", projectRoot: false, harnessDst: undefined } }, expected: { ...descriptor, onboarding: ".foo/LOCAL.md" } },
  { name: "root onboarding omitted", extra: { onboarding: { ...claude.onboarding!, dst: "ROOT.md", projectRoot: true, harnessDst: undefined } }, expected: descriptor },
  { name: "empty harness destination falls back", extra: { onboarding: { ...claude.onboarding!, dst: "LOCAL.md", harnessDst: "" } }, expected: { ...descriptor, onboarding: ".foo/LOCAL.md" } },
];
test.each(OPTIONAL_CASES)("preserves descriptor fields: $name", ({ extra, expected }) => {
  const root = fixture();
  publish(root, declaration(extra));
  expect(JSON.parse(read(root, descriptorPath))).toEqual(expected);
});

// Empty choice strings are refused by the upstream public packager too;
// descriptor-only assembly never owned that admission decision.
test.each(["choiceName", "choiceNote"] as const)("empty %s keeps the upstream refusal", (field) => {
  const root = fixture();
  expect(() => publish(root, declaration({ [field]: "" }))).toThrow("[foo] choiceName or choiceNote is not text the harness lists can show");
});

test("ordered root reads use the last prior block and its actual signature", () => {
  const root = fixture();
  write(root, "A.md", "first");
  write(root, "D.md", "last");
  write(root, ".foo/tools/data/root-blocks/B.md", "before");
  const rootIntegrations = [
    { path: "A.md", policy: "managed-block" as const, marker: "B.md" },
    { path: "D.md", policy: "managed-block" as const, marker: "B.md" },
    { path: ".foo/tools/data/root-blocks/B.md", policy: "managed-block" as const, marker: "C.md" },
  ];
  publish(root, declaration({ rootIntegrations }));
  expect(read(root, ".foo/tools/data/root-blocks/C.md")).toBe("last");
  expect(JSON.parse(read(root, descriptorPath)).rootIntegrations[2].legacySignatures.wholeFileHashes).toEqual([sha256Bytes(Buffer.from("last"))]);
});

test.each(process.platform === "win32" ? [".foo/./ROOT.md", ".foo\\ROOT.md", ".FOO/root.md"] : [".foo/./ROOT.md"])("declared spelling preserves filesystem existence without changing classification: %s", (path) => {
  const root = fixture();
  write(root, ".foo/ROOT.md", "root");
  publish(root, declaration({ rootIntegrations: [{ path, policy: "managed-block", marker: "alias" }] }));
  expect(read(root, ".foo/tools/data/root-blocks/alias")).toBe("root");
  expect(JSON.parse(read(root, descriptorPath)).managedDirectories).toEqual([".foo"]);
});

test("ordered root aliases observe earlier block writes", () => {
  const root = fixture();
  write(root, "A.md", "replacement");
  write(root, ".foo/tools/data/root-blocks/B.md", "before");
  publish(root, declaration({ rootIntegrations: [
    { path: "A.md", policy: "managed-block", marker: "B.md" },
    { path: ".foo/./tools/data/root-blocks/B.md", policy: "managed-block", marker: "C.md" },
  ] }));
  expect(read(root, ".foo/tools/data/root-blocks/C.md")).toBe("replacement");
});

test("a later failed read publishes none of the prepared metadata", () => {
  const root = fixture();
  write(root, "A.md", "first");
  mkdirSync(join(root, "directory"));
  expect(() => publish(root, declaration({ rootIntegrations: [
    { path: "A.md", policy: "managed-block", marker: "A.md" },
    { path: "directory", policy: "managed-block", marker: "directory" },
  ] }))).toThrow();
  expect(existsSync(join(root, ".foo/tools/data/root-blocks/A.md"))).toBe(false);
  expect(existsSync(join(root, descriptorPath))).toBe(false);
});

test("ordinary retained root preparation preserves its explicit compatibility signature", () => {
  const bytes = Buffer.from("current"), compatibility = sha256Bytes(Buffer.from("historical"));
  const result = prepareProjectionMetadata({ declaration: declaration({ rootIntegrations: [{ path: "ROOT.md", policy: "managed-block" }] }), files: ["ROOT.md"], directories: [".foo"], rootFiles: [{ path: "ROOT.md", fileName: "ROOT.md", bytes, sha256: sha256Bytes(bytes), legacySignatureSha256: compatibility }], buildVersion: "1.2.3" });
  expect(result.kind).toBe("prepared");
  if (result.kind !== "prepared") return;
  const descriptor = result.artifacts.find(artifact => artifact.file === descriptorPath)!;
  expect(JSON.parse(Buffer.from(descriptor.bytes).toString()).rootIntegrations[0].legacySignatures.wholeFileHashes).toEqual([compatibility]);
});
test("ordered root reads observe a distinct hardlink alias of the earlier block", () => {
  const root = fixture();
  write(root, "A.md", "replacement");
  write(root, ".foo/tools/data/root-blocks/B.md", "before");
  linkSync(join(root, ".foo/tools/data/root-blocks/B.md"), join(root, "LATER.md"));
  publish(root, declaration({ rootIntegrations: [
    { path: "A.md", policy: "managed-block", marker: "B.md" },
    { path: "LATER.md", policy: "managed-block", marker: "C.md" },
  ] }));
  expect(read(root, ".foo/tools/data/root-blocks/C.md")).toBe("replacement");
  expect(JSON.parse(read(root, descriptorPath)).rootIntegrations[1].legacySignatures.wholeFileHashes).toEqual([sha256Bytes(Buffer.from("replacement"))]);
});