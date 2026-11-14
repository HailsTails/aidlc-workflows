import { expect, test } from "bun:test";
import { accept } from "../../kernel/fixtures/accept.ts";
import { pluginId } from "./identities.ts";
import { authoredBody } from "../fixtures/authored-body.fixture.ts";
import { applyFragmentText } from "./apply-fragment-text.ts";

const plugin = accept(pluginId("test-pro"));
const instructions = authoredBody([
  { level: 2, title: "Steps", prose: "\n" },
  { level: 3, title: "Step 4-8: Build", prose: "\nOriginal step.\n\n" },
  { level: 3, title: "Step 9: Verify", prose: "\nVerify.\n\n" },
  { level: 2, title: "Sensors", prose: "\nSensor policy.\n" },
]);
const outline = (text: string) => ({ text, headings: [] });

test("repeated range-step anchors keep their order against one original heading snapshot", () => {
  const applied = applyFragmentText({ body: instructions, outline, fragments: [
    { plugin, target: "stage", name: "build-and-test", fragment: {
      anchor: { kind: "after-step", step: 8 }, order: 110, text: "Later." } },
    { plugin, target: "stage", name: "build-and-test", fragment: {
      anchor: { kind: "after-step", step: 8 }, order: 100, text: "Earlier." } },
  ] });
  expect(applied.findings).toEqual([]);
  expect(applied.body.text).toBe("## Steps\n\n### Step 4-8: Build\n\nOriginal step.\n\n\n" +
    "Earlier.\n\n\nLater.\n\n### Step 9: Verify\n\nVerify.\n\n## Sensors\n\nSensor policy.\n");
});

test("missing anchors produce an attributed finding and preserve the body", () => {
  expect(applyFragmentText({ body: instructions, outline, fragments: [
    { plugin, target: "stage", name: "build-and-test", fragment: {
      anchor: { kind: "before-step", step: 99 }, order: 100, text: "Never silently appended." } },
  ] })).toEqual({ body: instructions, findings: [{ kind: "overlay-dropped", plugin, target: "stage",
    name: "build-and-test", anchor: { kind: "before-step", step: 99 }, reason: "anchor-not-found" }] });
});
