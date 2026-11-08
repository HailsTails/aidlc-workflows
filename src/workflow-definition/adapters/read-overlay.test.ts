import { expect, test } from "bun:test";
import { accept } from "../../kernel/fixtures/accept.ts";
import { pluginId } from "../domain/identities.ts";
import { agent } from "../fixtures/identities.fixture.ts";
import { authoredBody } from "../fixtures/authored-body.fixture.ts";
import { methodSource } from "../fixtures/method-source.fixture.ts";
import { readOverlay } from "./read-overlay.ts";

const owner = { kind: "plugin" as const, plugin: accept(pluginId("test-pro")) };
const source = { owner, path: methodSource({ kind: "overlay",
  within: "agents/aidlc-quality-agent.md" }) };
const instructions = authoredBody([
  { level: 2, title: "fragment: after-preflight", prose: "\nFirst instruction.\n\n" },
  { level: 2, title: "fragment: in:Collaboration", prose: "\nCollaborate with metrics.\n" },
]);
const raw = `---
target: aidlc-quality-agent
plugin: test-pro
fragments:
  - anchor: after-preflight
    order: 90
  - anchor: in:Collaboration
    order: 100
---
${instructions.text}`;
const outliner = { outline: (text: string) => {
  expect(text).toBe(instructions.text);
  return instructions;
} };

test("a persona overlay retains both native anchor meanings and exact fragment text", () => {
  expect(readOverlay({ source, raw, outliner })).toEqual({ ok: true, value: {
    kind: "agent", agent: agent("aidlc-quality-agent"), fragments: [
      { anchor: { kind: "after-preflight" }, order: 90, text: "First instruction." },
      { anchor: { kind: "in-section", section: "Collaboration" }, order: 100,
        text: "Collaborate with metrics." },
    ],
  } });
});

test("a missing declared fragment refuses at its actual overlay source", () => {
  const missing = { outline: () => ({ text: instructions.text, headings: [] }) };
  expect(readOverlay({ source, raw, outliner: missing })).toEqual({ ok: false, refusal: [
    { kind: "invalid-file", location: { kind: "method-source", ...source },
      issues: ["Declared fragment after-preflight occurrence 1 has no body."] },
    { kind: "invalid-file", location: { kind: "method-source", ...source },
      issues: ["Declared fragment in:Collaboration occurrence 1 has no body."] },
  ] });
});
