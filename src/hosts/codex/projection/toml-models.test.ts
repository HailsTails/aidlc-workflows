import { expect, test } from "bun:test";
import { host } from "../../../kernel/fixtures/values.fixture.ts";
import { accept } from "../../../kernel/fixtures/accept.ts";
import { agentSlug, pluginId } from "../../../workflow-definition/domain/identities.ts";
import { methodSourcePath } from "../../../workflow-definition/domain/method-source.ts";
import type { Agent } from "../../../workflow-definition/domain/agent.ts";
import { renderCodexToml } from "./toml-models.ts";

const codex = host({ name: "codex", directory: ".codex" });
const agent: Agent = {
  slug: accept(agentSlug("aidlc-example-agent")),
  source: accept(methodSourcePath({ kind: "agent", within: "aidlc-example-agent.md" })),
  displayName: "Example", description: "Role", examples: [], owner: { kind: "core" },
  model: { kind: "tier", tier: "balanced" }, tools: { disallowed: [] }, maxTurns: null,
  persona: { text: "Persona", headings: [] }, additions: { afterPreflight: [], endOfBody: [] },
};
const content = 'name = "example"\ndescription = "Role"\nmodel = "old"\nmodel_reasoning_effort = "high"\n';

test("the host bridge preserves the frozen balanced effort bytes and model inheritance", () => {
  expect(renderCodexToml({ agent, content, host: codex, modelCap: null }))
    .toEqual({ ok: true, value: 'name = "example"\ndescription = "Role"\nmodel_reasoning_effort = "medium"\n' });
});

test("the host bridge applies the captured cap without keeping a stale effort or model pin", () => {
  expect(renderCodexToml({ agent, content, host: codex, modelCap: "templated" }))
    .toEqual({ ok: true, value: 'name = "example"\ndescription = "Role"\n' });
});

test("the host bridge preserves the actual agent subject when the host is unsupported", () => {
  expect(renderCodexToml({ agent, content, host: host({ name: "unknown", directory: ".unknown" }), modelCap: null }))
    .toEqual({ ok: false, refusal: { kind: "render-failed", concept: "agent", name: "aidlc-example-agent",
      reason: "The frozen model policy has no host unknown." } });
});

test("a host-default plugin model retains the existing authored-tier refusal", () => {
  expect(renderCodexToml({ agent: { ...agent, owner: { kind: "plugin", plugin: accept(pluginId("metrics")) },
    model: { kind: "host-default" } }, content, host: codex, modelCap: null }))
    .toEqual({ ok: false, refusal: { kind: "render-failed", concept: "agent", name: "aidlc-example-agent",
      reason: "This core-agent bridge requires an authored model tier." } });
});
