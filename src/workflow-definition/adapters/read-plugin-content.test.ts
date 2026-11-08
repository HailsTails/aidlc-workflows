import { expect, test } from "bun:test";
import { accept } from "../../kernel/fixtures/accept.ts";
import { captureRepositoryPlugins } from "./source-files.ts";
import type { RuleLayer } from "../domain/rule.ts";
import { readPluginContent } from "./read-plugin-content.ts";

const captures = await captureRepositoryPlugins(new URL("../../../plugins/", import.meta.url));
const captured = captures.find((entry) => entry.directory === "test-pro");
if (!captured) throw new Error("The real test-pro contribution fixture is absent.");
const outliner = { outline: (text: string) => ({ text, headings: [] }) };

test("the real plugin uses the shared authored decoders and retains its source bytes", async () => {
  const reading = accept(await readPluginContent({ capture: captured, outliner }));
  expect(reading.plugin).toBe<string>("test-pro");
  expect(reading.content.stages.map((stage) => stage.slug))
    .toEqual<readonly string[]>(["test-pro-integration", "test-pro-full-suite"]);
  expect(reading.content.scopes.map((scope) => scope.name))
    .toEqual<readonly string[]>(["test-pro-validation"]);
  expect(reading.content.agents.map((agent) => agent.slug))
    .toEqual<readonly string[]>(["test-pro-metrics-agent"]);
  const rules = reading.content.rules.map((rule) => ({ id: rule.id, layer: rule.layer }));
  expect(rules).toEqual<readonly { id: string; layer: RuleLayer }[]>([
    { id: "test-pro/phases/inception", layer: { kind: "phase", phase: "inception" } },
    { id: "test-pro/rules", layer: { kind: "team" } },
  ]);
  expect(reading.files.every((file) => file.owner.kind === "plugin"
    && file.owner.plugin === "test-pro")).toBe(true);
  const stage = captured.files.find((file) => file.within.endsWith("test-pro-integration.md"));
  expect(reading.files.find((file) => file.path.endsWith("test-pro-integration.md"))?.content)
    .toBe(stage?.content);
});
