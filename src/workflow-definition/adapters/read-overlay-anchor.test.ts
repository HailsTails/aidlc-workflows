import { expect, test } from "bun:test";
import { accept } from "../../kernel/fixtures/accept.ts";
import { pluginId } from "../domain/identities.ts";
import { methodSource } from "../fixtures/method-source.fixture.ts";
import { readPersonaAnchor, readStageAnchor } from "./read-overlay-anchor.ts";

const source = { owner: { kind: "plugin" as const, plugin: accept(pluginId("metrics")) },
  path: methodSource({ kind: "overlay", within: "agents/reviewer.md" }) };

test("stage and persona anchors retain distinct attachment vocabularies", () => {
  expect(readStageAnchor(source, "after-step:8")).toEqual({
    ok: true, value: { kind: "after-step", step: 8 },
  });
  expect(readPersonaAnchor(source, "in:Collaboration")).toEqual({
    ok: true, value: { kind: "in-section", section: "Collaboration" },
  });
  expect(readPersonaAnchor(source, "after-preflight")).toEqual({
    ok: true, value: { kind: "after-preflight" },
  });
});

test("cross-vocabulary anchors refuse at their authored source", () => {
  expect(readStageAnchor(source, "after-preflight")).toEqual({ ok: false, refusal: [{
    kind: "invalid-file", location: { kind: "method-source", ...source },
    issues: ["Unsupported overlay anchor: after-preflight"],
  }] });
  expect(readPersonaAnchor(source, "before-step:2")).toEqual({ ok: false, refusal: [{
    kind: "invalid-file", location: { kind: "method-source", ...source },
    issues: ["Unsupported overlay anchor: before-step:2"],
  }] });
});
