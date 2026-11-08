import { expect, test } from "bun:test";
import { sourcePath } from "../../kernel/values.ts";
import { accept } from "../../kernel/fixtures/accept.ts";
import { captureRepositoryPlugins } from "./source-files.ts";
import { readPluginContent } from "./read-plugin-content.ts";

const captures = await captureRepositoryPlugins(new URL("../../../plugins/", import.meta.url));
const outliner = { outline: (text: string) => ({ text, headings: [] }) };

test.each([...captures])("the real plugin uses shared decoders with owner-qualified identities", async (capture) => {
  expect(captures).toMatchObject([{ directory: "test-pro" }]);
  const reading = accept(await readPluginContent({ capture, outliner }));
  expect(reading.plugin).toBe<string>("test-pro");
  expect(reading.content.stages).toMatchObject([
    { slug: "test-pro-integration", owner: { kind: "plugin", plugin: "test-pro" } },
    { slug: "test-pro-full-suite", owner: { kind: "plugin", plugin: "test-pro" } },
  ]);
  expect(reading.content.scopes).toMatchObject([{ name: "test-pro-validation" }]);
  expect(reading.content.agents).toMatchObject([{ slug: "test-pro-metrics-agent" }]);
  expect(reading.content.rules).toMatchObject([
    { id: "test-pro/phases/inception", layer: { kind: "phase", phase: "inception" } },
    { id: "test-pro/rules", layer: { kind: "team" } },
  ]);
  expect(reading.files).toEqual(expect.arrayContaining([expect.objectContaining({
    owner: { kind: "plugin", plugin: "test-pro" },
    path: "aidlc-common/stages/construction/test-pro-integration.md",
  })]));
});

const reservedSources = [
  { directory: "metrics", name: "core", refused: "core" },
  { directory: "metrics", name: "aidlc", refused: "aidlc" },
  { directory: "metrics", name: "aidlc-extra", refused: "aidlc-extra" },
  { directory: "core", name: "metrics", refused: "core" },
  { directory: "aidlc", name: "metrics", refused: "aidlc" },
  { directory: "aidlc-extra", name: "metrics", refused: "aidlc-extra" },
];

test.each(reservedSources)("reserved folder or manifest names share one typed refusal: %j",
  async ({ directory, name, refused }) => {
    expect(await readPluginContent({ outliner, capture: { directory, files: [], manifest: {
      within: accept(sourcePath(".aidlc-plugin/plugin.json")),
      content: { kind: "text", text: JSON.stringify({
        name, version: "1", description: "", aidlc: { contributes: {} },
      }) },
    } } })).toEqual({ ok: false, refusal: [{ kind: "core-namespace-claimed", plugin: refused }] });
  });

test("an ordinary folder may retain a separate admitted manifest identity", async () => {
  const reading = accept(await readPluginContent({ outliner, capture: {
    directory: "folder-name", files: [], manifest: {
      within: accept(sourcePath(".aidlc-plugin/plugin.json")),
      content: { kind: "text", text:
        '{"name":"metrics","version":"1","description":"","aidlc":{"contributes":{}}}' },
    },
  } }));
  expect(reading.plugin).toBe<string>("metrics");
  expect(reading.content.stages).toEqual([]);
});

test("a malformed folder refuses through identity admission", async () => {
  expect(await readPluginContent({ outliner, capture: {
    directory: "Bad Name", files: [], manifest: {
      within: accept(sourcePath(".aidlc-plugin/plugin.json")),
      content: { kind: "text", text:
        '{"name":"metrics","version":"1","description":"","aidlc":{"contributes":{}}}' },
    },
  } })).toEqual({ ok: false, refusal: [{ kind: "invalid-file",
    location: { kind: "plugin-manifest", plugin: "Bad Name" },
    issues: ["Invalid plugin identity."] }] });
});
