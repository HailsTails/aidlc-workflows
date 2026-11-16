const outliner = { outline: (text: string) => ({ text, headings: [] }) };
import { expect, test } from "bun:test";
import { accepted, refused } from "../kernel/result.ts";
import { accept } from "../kernel/fixtures/accept.ts";
import { createInMemoryFileSystem } from "../kernel/fixtures/file-system.fake.ts";
import { createInMemoryYamlParser } from "../kernel/fixtures/yaml-parser.fake.ts";
import { createAuthoredMethodLoading } from "./core-root.ts";

const files = {
  "file:///core/aidlc-common/stages/.keep": "", "file:///core/agents/.keep": "",
  "file:///core/scopes/.keep": "", "file:///core/sensors/.keep": "",
  "file:///core/memory/.keep": "", "file:///core/knowledge/.keep": "",
};

test("Definition wires its decoder and compiler around the injected file and parser ports", async () => {
  const loading = createAuthoredMethodLoading({ reader: createInMemoryFileSystem({ files }),
    parser: createInMemoryYamlParser({ documents: {} }), outliner });
  const core = accept(await loading.loadCore(new URL("file:///core/")));
  expect(core.method.graph.nodes).toEqual([]);
  expect(core.sources).toEqual([]);
  expect(await loading.loadPlugins({ core, pluginsRoot: new URL("file:///plugins/") }))
    .toEqual(accepted({ method: core.method, plugins: [] }));
});

test("the injected frontmatter parser's refusal crosses the composition unchanged", async () => {
  const loading = createAuthoredMethodLoading({ reader: createInMemoryFileSystem({ files: {
    ...files, "file:///core/aidlc-common/stages/inception/example.md": "---\nslug: example\n---\nBody",
  } }), parser: { parse: () => refused({ kind: "invalid-yaml", reason: "Parser unavailable" }) }, outliner });
  expect(await loading.loadCore(new URL("file:///core/"))).toMatchObject({ ok: false, refusal: [
    { kind: "invalid-file", issues: ["Parser unavailable"] },
  ] });
});
