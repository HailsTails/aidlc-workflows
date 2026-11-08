import { expect, test } from "bun:test";
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
