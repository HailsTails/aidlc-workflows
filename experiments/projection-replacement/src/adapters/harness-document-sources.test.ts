import { expect, mock, test } from "bun:test";
import { createHarnessDocumentSourceReader, createHarnessDocumentSourceOperations } from "./harness-document-sources.ts";
import { createEntrySourceOperations, entryLocation, entrySources, entryManifest, entryDigest } from "../../__tests__/harness-document-fixtures.ts";

test("reads the four declared documents with the observed manifest as provenance", async () => {
  const operations = createEntrySourceOperations();
  expect(await createHarnessDocumentSourceReader({ operations }).load(entryLocation)).toEqual({ status: "ok", value: entrySources });
  expect(operations.module.mock.calls).toEqual([[{ sourceRoot: "entry-source", path: "harness/claude/manifest.ts", sha256: entryDigest }]]);
  expect(operations.read.mock.calls).toEqual([
    [{ sourceRoot: "entry-source", path: "harness/claude/manifest.ts" }],
    [{ sourceRoot: "entry-source", path: "harness/claude/skills/aidlc/SKILL.md" }],
    [{ sourceRoot: "entry-source", path: "harness/claude/skills/aidlc/composer.md" }],
    [{ sourceRoot: "entry-source", path: "harness/claude/skills/aidlc/question-rendering.md" }],
    [{ sourceRoot: "entry-source", path: "harness/claude/rules-aidlc.md" }],
    [{ sourceRoot: "entry-source", path: "harness/claude/manifest.ts" }],
  ]);
  expect(operations.digest.mock.calls).toEqual([
    [{ bytes: new Uint8Array([77]) }],
    [{ bytes: new Uint8Array([65, 117, 116, 104, 111, 114, 101, 100, 32, 109, 97, 105, 110, 10, 10]) }],
    [{ bytes: new Uint8Array([65, 117, 116, 104, 111, 114, 101, 100, 32, 99, 111, 109, 112, 111, 115, 101, 114, 10]) }],
    [{ bytes: new Uint8Array([65, 117, 116, 104, 111, 114, 101, 100, 32, 113, 117, 101, 115, 116, 105, 111, 110, 10]) }],
    [{ bytes: new Uint8Array([65, 117, 116, 104, 111, 114, 101, 100, 32, 109, 101, 116, 104, 111, 100, 10]) }],
    [{ bytes: new Uint8Array([77]) }],
  ]);
});

test.each([
  { name: "unknown source", additionalMapping: { src: "new.md", dst: "new.md" } },
  { name: "redirected owned source", additionalMapping: { src: "skills/aidlc/SKILL.md", dst: "other.md" } },
  { name: "project-root bypass", additionalMapping: { src: "rules-aidlc.md", dst: "rules/aidlc.md", projectRoot: true } },
  { name: "path traversal", additionalMapping: { src: "../SKILL.md", dst: "skills/aidlc/SKILL.md" } },
])("refuses $name before document reads", async ({ additionalMapping }) => {
  const operations = { ...createEntrySourceOperations(), module: mock().mockResolvedValue({ status: "ok", value: { default: { ...entryManifest.default, harnessFiles: [...entryManifest.default.harnessFiles, additionalMapping] } } }) };
  expect(await createHarnessDocumentSourceReader({ operations }).load(entryLocation)).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "harness-document-sources", detail: "unknown or redirected authored Markdown mapping requires an explicit document owner" }] });
  expect(operations.read).toHaveBeenCalledTimes(1);
});

test.each([
  { name: "missing mapping", mappings: [] },
  { name: "duplicate mapping", mappings: [...entryManifest.default.harnessFiles, { src: "rules-aidlc.md", dst: "rules/aidlc.md" }] },
  { name: "duplicate delegated tables", mappings: [...entryManifest.default.harnessFiles, { src: "skills/aidlc/tables.md", dst: "skills/aidlc/tables.md" }] },
])("refuses $name without partial output", async ({ mappings }) => {
  const operations = { ...createEntrySourceOperations(), module: mock().mockResolvedValue({ status: "ok", value: { default: { ...entryManifest.default, harnessFiles: mappings } } }) };
  expect(await createHarnessDocumentSourceReader({ operations }).load(entryLocation)).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "harness-document-sources", detail: "the Claude entry document profile requires each of its four authored mappings exactly once" }] });
  expect(operations.read).toHaveBeenCalledTimes(1);
});

test("non-Markdown configuration mappings stay with their existing owner", async () => {
  const operations = { ...createEntrySourceOperations(), module: mock().mockResolvedValue({ status: "ok", value: { default: { ...entryManifest.default, harnessFiles: [...entryManifest.default.harnessFiles, { src: "local.json", dst: "local.json", projectRoot: true }] } } }) };
  expect(await createHarnessDocumentSourceReader({ operations }).load(entryLocation)).toEqual({ status: "ok", value: entrySources });
});

test("malformed manifest APIs fail as data", async () => {
  const operations = { ...createEntrySourceOperations(), module: mock().mockResolvedValue({ status: "ok", value: { default: { name: "claude" } } }) };
  expect(await createHarnessDocumentSourceReader({ operations }).load(entryLocation)).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "harness-document-sources", detail: "authored entry documents require the native Claude manifest and supported harness file mappings" }] });
});

test("a document read refusal remains failure data without partial source output", async () => {
  const operations = { ...createEntrySourceOperations(), read: mock().mockResolvedValueOnce({ status: "ok", value: new Uint8Array([77]) }).mockResolvedValueOnce({ status: "invalid", findings: [{ code: "capability-gap", subject: "harness/claude/skills/aidlc/SKILL.md", detail: "source document missing" }] }).mockResolvedValue({ status: "ok", value: new Uint8Array([65]) }) };
  expect(await createHarnessDocumentSourceReader({ operations }).load(entryLocation)).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "harness/claude/skills/aidlc/SKILL.md", detail: "source document missing" }] });
  expect(operations.read).toHaveBeenCalledTimes(5);
});

test("manifest module refusal propagates before any document reads", async () => {
  const operations = { ...createEntrySourceOperations(), module: mock().mockResolvedValue({ status: "invalid", findings: [{ code: "capability-gap", subject: "harness/claude/manifest.ts", detail: "source manifest unavailable" }] }) };
  expect(await createHarnessDocumentSourceReader({ operations }).load(entryLocation)).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "harness/claude/manifest.ts", detail: "source manifest unavailable" }] });
  expect(operations.read).toHaveBeenCalledTimes(1);
});

test("a manifest changed during import does not authorize the observed documents", async () => {
  const operations = { ...createEntrySourceOperations(), digest: mock().mockReturnValueOnce(entryDigest).mockReturnValueOnce(entryDigest).mockReturnValueOnce(entryDigest).mockReturnValueOnce(entryDigest).mockReturnValueOnce(entryDigest).mockReturnValue("cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc") };
  expect(await createHarnessDocumentSourceReader({ operations }).load(entryLocation)).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "harness-document-sources", detail: "Claude manifest changed while reading authored entry documents" }] });
});

test("other harnesses refuse before source access", async () => {
  const operations = createEntrySourceOperations();
  expect(await createHarnessDocumentSourceReader({ operations }).load({ ...entryLocation, binding: { harness: "cursor", directory: ".cursor" } })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "harness-document-sources", detail: "authored entry documents qualify Claude copy delivery only" }] });
  expect(operations.read).not.toHaveBeenCalled();
});

test.each([
  { name: "plugin source kind", basis: { source: { kind: "plugin", id: "rin" }, pin: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" } },
  { name: "another core source identity", basis: { source: { kind: "core", id: "other" }, pin: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" } },
  { name: "abbreviated source pin", basis: { source: { kind: "core", id: "framework" }, pin: "aaaaaaaa" } },
] as const)("$name cannot bypass source admission", async ({ basis }) => {
  const operations = createEntrySourceOperations();
  expect(await createHarnessDocumentSourceReader({ operations }).load({ ...entryLocation, basis })).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "harness-document-sources", detail: "authored entry documents require the framework source basis and full source pin" }] });
  expect(operations.read).not.toHaveBeenCalled();
  expect(operations.module).not.toHaveBeenCalled();
  expect(operations.digest).not.toHaveBeenCalled();
});

test("the production source factory supplies only source IO and digest ports", () => {
  expect(createHarnessDocumentSourceOperations()).toEqual({ read: expect.any(Function), module: expect.any(Function), digest: expect.any(Function) });
});

test("the canonical IO bridge wraps successful raw file and module values", async () => {
  const read = mock().mockResolvedValue(new Uint8Array([77]));
  const load = mock().mockResolvedValue({ native: "manifest" });
  const operations = createHarnessDocumentSourceOperations({ read, module: load });
  expect(await operations.read({ sourceRoot: "entry-source", path: "harness/claude/manifest.ts" })).toEqual({ status: "ok", value: new Uint8Array([77]) });
  expect(await operations.module({ sourceRoot: "entry-source", path: "harness/claude/manifest.ts", sha256: entryDigest })).toEqual({ status: "ok", value: { native: "manifest" } });
  expect(read.mock.calls).toEqual([[{ sourceRoot: "entry-source", path: "harness/claude/manifest.ts" }]]);
  expect(load.mock.calls).toEqual([[{ sourceRoot: "entry-source", path: "harness/claude/manifest.ts", sha256: entryDigest }]]);
});

test("the canonical file IO bridge translates library rejection at the file boundary", async () => {
  const operations = createHarnessDocumentSourceOperations({ read: mock().mockRejectedValue(new Error("file unavailable")) });
  expect(await operations.read({ sourceRoot: "entry-source", path: "harness/claude/rules-aidlc.md" })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "harness/claude/rules-aidlc.md", detail: "authored harness document source file unavailable" }] });
});

test("the canonical module IO bridge translates library rejection at the module boundary", async () => {
  const operations = createHarnessDocumentSourceOperations({ module: mock().mockRejectedValue(new Error("module unavailable")) });
  expect(await operations.module({ sourceRoot: "entry-source", path: "harness/claude/manifest.ts", sha256: entryDigest })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "harness/claude/manifest.ts", detail: "authored harness document source module unavailable" }] });
});

test("malformed UTF-8 source bytes refuse as decoding data", async () => {
  const operations = { ...createEntrySourceOperations(), read: mock().mockResolvedValueOnce({ status: "ok", value: new Uint8Array([77]) }).mockResolvedValueOnce({ status: "ok", value: new Uint8Array([255]) }).mockResolvedValue({ status: "ok", value: new Uint8Array([65]) }) };
  expect(await createHarnessDocumentSourceReader({ operations }).load(entryLocation)).toEqual({ status: "invalid", findings: [{ code: "invalid-input", subject: "harness/claude/skills/aidlc/SKILL.md", detail: "authored harness documents require readable UTF-8 source bytes" }] });
  expect(operations.read).toHaveBeenCalledTimes(5);
});
