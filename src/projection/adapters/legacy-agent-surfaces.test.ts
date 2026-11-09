import { expect, test } from "bun:test";
import { host } from "../../kernel/fixtures/values.fixture.ts";
import { agent } from "../../workflow-definition/fixtures/identities.fixture.ts";
import { legacyAgentModelPolicy } from "./legacy-agent-surfaces.ts";

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