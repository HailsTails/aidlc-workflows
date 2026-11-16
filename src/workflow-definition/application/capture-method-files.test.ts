import { expect, test } from "bun:test";
import { accept } from "../../kernel/fixtures/accept.ts";
import { createInMemoryFileSystem } from "../../kernel/fixtures/file-system.fake.ts";
import { captureCoreMethodFiles, capturePluginMethodFiles } from "./capture-method-files.ts";

const coreFiles = {
  "file:///core/aidlc-common/stages/.keep": "",
  "file:///core/agents/.keep": "",
  "file:///core/scopes/.keep": "",
  "file:///core/sensors/.keep": "",
  "file:///core/memory/.keep": "",
  "file:///core/knowledge/.keep": "",
};

test("core layout captures sorted Markdown paths and original bytes from a slashless root", async () => {
  const reader = createInMemoryFileSystem({ files: { ...coreFiles,
    "file:///core/scopes/z.md": "last", "file:///core/scopes/a.md": "first",
    "file:///core/scopes/ignored.txt": "not a definition",
  } });
  expect(accept(await captureCoreMethodFiles({ root: new URL("file:///core"), reader }))).toEqual<unknown>({
    stages: [], agents: [], scopes: [
      { within: "a.md", content: { kind: "bytes", bytes: new Uint8Array([102, 105, 114, 115, 116]) } },
      { within: "z.md", content: { kind: "bytes", bytes: new Uint8Array([108, 97, 115, 116]) } },
    ], sensors: [], rules: [], knowledge: [],
  });
});

test("core folder faults retain tree and physical location without an invented plugin", async () => {
  const reader = createInMemoryFileSystem({ files: coreFiles,
    faults: { "file:///core/agents/": "permission-denied" } });
  expect(await captureCoreMethodFiles({ root: new URL("file:///core/"), reader })).toEqual({ ok: false,
    refusal: [{ kind: "source-unreadable", location: { kind: "authored-tree", tree: "core", within: "agents/" },
      code: "permission-denied" }],
  });
});

test("plugin layout keeps method groups separate from recursive tool and overlay payloads", async () => {
  const reader = createInMemoryFileSystem({ files: {
    "file:///plugins/metrics/.aidlc-plugin/plugin.json": "manifest",
    "file:///plugins/metrics/stages/inception/example.md": "stage",
    "file:///plugins/metrics/tools/asset.bin": new Uint8Array([0, 255]),
    "file:///plugins/not-a-plugin/tools/helper.ts": "ignored",
  } });
  const capture = accept(await capturePluginMethodFiles({ root: new URL("file:///plugins/"), reader }));
  expect(capture).toEqual<unknown>([{ directory: "metrics", manifest: {
    within: ".aidlc-plugin/plugin.json", content: { kind: "bytes",
      bytes: new Uint8Array([109, 97, 110, 105, 102, 101, 115, 116]) } },
    files: [
      { within: "stages/inception/example.md", content: { kind: "bytes", bytes: new Uint8Array([115, 116, 97, 103, 101]) } },
      { within: "tools/asset.bin", content: { kind: "bytes", bytes: new Uint8Array([0, 255]) } },
    ], methodFiles: { stages: [{ within: "inception/example.md",
      content: { kind: "bytes", bytes: new Uint8Array([115, 116, 97, 103, 101]) } }],
      agents: [], scopes: [], sensors: [], rules: [], knowledge: [] },
  }]);
});

test("a missing plugin root remains an empty repository while a denied root refuses", async () => {
  const empty = createInMemoryFileSystem({ files: {} });
  const denied = createInMemoryFileSystem({ files: {}, faults: { "file:///plugins/": "permission-denied" } });
  expect(await capturePluginMethodFiles({ root: new URL("file:///plugins/"), reader: empty }))
    .toEqual({ ok: true, value: [] });
  expect(await capturePluginMethodFiles({ root: new URL("file:///plugins/"), reader: denied }))
    .toEqual({ ok: false, refusal: [{ kind: "source-unreadable",
      location: { kind: "authored-tree", tree: "plugins", within: "" }, code: "permission-denied" }] });
});

test("per-file faults preserve raw unportable names and suppress partial plugin captures", async () => {
  const reader = createInMemoryFileSystem({ files: {
    "file:///plugins/metrics/.aidlc-plugin/plugin.json": "manifest",
    "file:///plugins/metrics/tools/con.ts": "unportable",
    "file:///plugins/metrics/tools/ok.ts": "readable",
  } });
  expect(await capturePluginMethodFiles({ root: new URL("file:///plugins/"), reader })).toEqual({ ok: false,
    refusal: [{ kind: "source-unreadable", location: { kind: "authored-tree", tree: "plugins",
      within: "metrics/tools/con.ts" }, code: "unportable-name" }],
  });
});

test("captured payloads survive subsequent source replacement", async () => {
  const reader = createInMemoryFileSystem({ files: {
    "file:///plugins/metrics/.aidlc-plugin/plugin.json": "manifest",
    "file:///plugins/metrics/tools/tool.ts": "before",
  } });
  const captured = accept(await capturePluginMethodFiles({ root: new URL("file:///plugins/"), reader }));
  accept(await reader.writeFile({ file: new URL("file:///plugins/metrics/tools/tool.ts"),
    content: { kind: "text", text: "after" } }));
  expect(captured[0]?.files).toEqual<unknown>([{ within: "tools/tool.ts",
    content: { kind: "bytes", bytes: new Uint8Array([98, 101, 102, 111, 114, 101]) } }]);
});

test("core skips other entries and non-Markdown files before reading or validating them", async () => {
  const reader = createInMemoryFileSystem({ files: { ...coreFiles,
    "file:///core/scopes/con.txt": "unportable but not a definition",
    "file:///core/scopes/notes.": "unportable but not Markdown",
  }, faults: { "file:///core/scopes/private.txt": "permission-denied" },
    others: ["file:///core/scopes/con.md", "file:///core/scopes/link.md"] });
  expect(await captureCoreMethodFiles({ root: new URL("file:///core/"), reader })).toEqual({ ok: true,
    value: { stages: [], agents: [], scopes: [], sensors: [], rules: [], knowledge: [] } });
});

test("selected Markdown faults are still reported at their actual source", async () => {
  const reader = createInMemoryFileSystem({ files: coreFiles,
    faults: { "file:///core/scopes/private.md": "permission-denied" } });
  expect(await captureCoreMethodFiles({ root: new URL("file:///core/"), reader })).toEqual({ ok: false,
    refusal: [{ kind: "source-unreadable", location: { kind: "authored-tree", tree: "core",
      within: "scopes/private.md" }, code: "permission-denied" }] });
});

test("plugin payload capture skips other entries while retaining selected file failures", async () => {
  const reader = createInMemoryFileSystem({ files: {
    "file:///plugins/metrics/.aidlc-plugin/plugin.json": "manifest",
  }, faults: { "file:///plugins/metrics/tools/selected.bin": "permission-denied" },
    others: ["file:///plugins/metrics/tools/link.ts", "file:///plugins/metrics/tools/con.ts"] });
  expect(await capturePluginMethodFiles({ root: new URL("file:///plugins/"), reader })).toEqual({ ok: false,
    refusal: [{ kind: "source-unreadable", location: { kind: "authored-tree", tree: "plugins",
      within: "metrics/tools/selected.bin" }, code: "permission-denied" }] });
});
