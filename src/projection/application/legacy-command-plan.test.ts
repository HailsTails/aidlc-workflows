import { expect, test } from "bun:test";
import { accept } from "../../kernel/fixtures/accept.ts";
import { pluginId } from "../../workflow-definition/domain/identities.ts";
import { methodSource } from "../../workflow-definition/fixtures/method-source.fixture.ts";
import { methodSliceFixture } from "../../workflow-definition/fixtures/method.fixture.ts";
import type { MethodSource } from "../../workflow-definition/domain/method-source.ts";
import { captureCommandScopes, duplicateNativeCommand, selectedScopeDescription,
  selectLegacyDocuments } from "./legacy-command-plan.ts";

const classic: MethodSource = { owner: { kind: "core" },
  path: methodSource({ kind: "scope", within: "aidlc-classic.md" }), content: { kind: "text", text: "Classic" } };
const feature: MethodSource = { owner: { kind: "core" },
  path: methodSource({ kind: "scope", within: "aidlc-feature.md" }), content: { kind: "text", text: "Feature" } };

test("scope source capture retains Method order and owner despite overlapping plugin paths", () => {
  expect(captureCommandScopes({ method: methodSliceFixture, sources: [feature,
    { ...classic, owner: { kind: "plugin", plugin: accept(pluginId("metrics")) } }, classic],
  })).toEqual({ ok: true, value: [classic, feature] });
});

test("a missing scope names the first actual Method scope instead of a source-wide failure", () => {
  expect(captureCommandScopes({ method: methodSliceFixture, sources: [feature] })).toEqual({ ok: false,
    refusal: { kind: "render-failed", concept: "scope-command", name: "classic",
      reason: "The accepted scope source was not captured." } });
});

test("scope selection distinguishes declined, available and selected-but-absent", () => {
  expect(selectedScopeDescription({ name: "classic", selected: ["feature"], scopes: {} }))
    .toEqual({ ok: true, value: null });
  expect(selectedScopeDescription({ name: "feature", selected: ["feature"],
    scopes: { feature: { description: "Feature work" } } })).toEqual({ ok: true, value: "Feature work" });
  expect(selectedScopeDescription({ name: "feature", selected: ["feature"], scopes: {} }))
    .toEqual({ ok: false, refusal: "The selected frozen scope is absent: feature" });
});

test("native duplicate ownership identifies the later subject before output writes", () => {
  expect(duplicateNativeCommand([
    { subject: { concept: "stage-command", name: "example" }, nativeName: "aidlc-example" },
    { subject: { concept: "scope-command", name: "feature" }, nativeName: "aidlc-example" },
  ])).toEqual({ subject: { concept: "scope-command", name: "feature" }, files: null,
    reason: "Two frozen commands share the native destination: aidlc-example" });
  expect(duplicateNativeCommand([
    { subject: { concept: "stage-command", name: "example" }, nativeName: null },
    { subject: { concept: "scope-command", name: "feature" }, nativeName: null },
  ])).toBeNull();
});

test("document selection retains nested companion order and excludes sibling prefixes", () => {
  expect(selectLegacyDocuments({ nativeName: "aidlc-example", paths: [
    "skills/aidlc-example/SKILL.md", "skills/aidlc-example/agents/openai.yaml",
    "skills/aidlc-example/nested/asset.bin", "skills/aidlc-example-two/other.bin",
  ] })).toEqual({ ok: true, value: { skill: "skills/aidlc-example/SKILL.md", companions: [
    { path: "skills/aidlc-example/agents/openai.yaml", within: "agents/openai.yaml" },
    { path: "skills/aidlc-example/nested/asset.bin", within: "nested/asset.bin" },
  ] } });
});

test("document selection supports captured native separators and refuses ambiguous native names", () => {
  expect(selectLegacyDocuments({ nativeName: "aidlc-example", paths: [
    "skills\\aidlc-example\\SKILL.md", "skills\\aidlc-example\\agents\\openai.yaml",
  ] })).toEqual({ ok: true, value: { skill: "skills\\aidlc-example\\SKILL.md", companions: [
    { path: "skills\\aidlc-example\\agents\\openai.yaml", within: "agents/openai.yaml" },
  ] } });
  expect(selectLegacyDocuments({ nativeName: "aidlc-example", paths: [
    "one/aidlc-example/SKILL.md", "two/aidlc-example/SKILL.md",
  ] })).toEqual({ ok: false,
    refusal: "The frozen output must contain exactly one directory for this native name." });
});
