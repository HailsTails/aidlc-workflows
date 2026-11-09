import { expect, test } from "bun:test";
import { host, source } from "../../kernel/fixtures/values.fixture.ts";
import { agent } from "../../workflow-definition/fixtures/identities.fixture.ts";
import { legacyAgentModelPolicy, legacyAgentTiersData, legacyCliModelPolicy } from "./legacy-agent-surfaces.ts";

test("Kiro inherits its session model under the frozen policy", () => {
  expect(legacyAgentModelPolicy(null)({ host: host({ name: "kiro", directory: ".kiro" }),
    agent: agent("aidlc-architect-agent"), model: { kind: "tier", tier: "judgment" } }))
    .toEqual({ ok: true, value: undefined });
});

test("an unsupported model host refuses the actual agent before policy lookup", () => {
  expect(legacyAgentModelPolicy(null)({ host: host({ name: "unknown", directory: ".unknown" }),
    agent: agent("aidlc-architect-agent"), model: { kind: "tier", tier: "judgment" } }))
    .toEqual({ ok: false, refusal: { kind: "render-failed", concept: "agent", name: "aidlc-architect-agent",
      reason: "The frozen model policy has no host unknown." } });
});
import { methodSliceFixture } from "../../workflow-definition/fixtures/method.fixture.ts";

test("runtime tiers come only from admitted core agents and retain canonical native names and sort order", () => {
  expect(legacyAgentTiersData(methodSliceFixture)).toEqual({ kind: "text", text: `{
  "architect": "judgment",
  "architecture-reviewer": "balanced",
  "delivery": "templated",
  "developer": "judgment",
  "product": "judgment",
  "product-lead": "balanced"
}
` });
});

test("CLI model policy preserves authored defaults under an explicit cap", () => {
  expect(legacyCliModelPolicy("templated")({ source: source("settings/cli.json"), content: { kind: "text",
    text: '{"custom":true,"chat.modelDefaults":{"private":{"keep":1}}}' } })).toEqual({ ok: true, value: {
    source: source("settings/cli.json"), content: { kind: "text",
      text: '{\n  "custom": true,\n  "chat.modelDefaults": {\n    "private": {\n      "keep": 1\n    }\n  }\n}\n' },
  } });
});

test("CLI model policy decodes captured bytes and keeps an empty inherited model map absent", () => {
  expect(legacyCliModelPolicy(null)({ source: source("settings/cli.json"),
    content: { kind: "bytes", bytes: new Uint8Array([123, 125]) } })).toEqual({ ok: true, value: {
    source: source("settings/cli.json"), content: { kind: "text", text: "{}\n" },
  } });
});

test("CLI model policy refuses an array with the actual source", () => {
  expect(legacyCliModelPolicy(null)({ source: source("settings/cli.json"),
    content: { kind: "text", text: "[]" } })).toEqual({ ok: false, refusal: {
    kind: "render-failed", concept: "settings", name: "settings/cli.json",
    reason: "The CLI settings file must contain a JSON object.",
  } });
});

test("CLI model policy keeps JSON parse failures at the source boundary", () => {
  expect(legacyCliModelPolicy(null)({ source: source("settings/broken.json"),
    content: { kind: "text", text: "{" } })).toMatchObject({ ok: false, refusal: {
    kind: "render-failed", concept: "settings", name: "settings/broken.json", reason: expect.any(String),
  } });
});

test("captured UTF-8 BOM bytes retain the legacy JSON refusal", () => {
  expect(legacyCliModelPolicy(null)({ source: source("settings/cli.json"),
    content: { kind: "bytes", bytes: new Uint8Array([239, 187, 191, 123, 125]) } }))
    .toMatchObject({ ok: false, refusal: { kind: "render-failed", concept: "settings", name: "settings/cli.json" } });
});
