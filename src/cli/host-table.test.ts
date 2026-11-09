import { expect, test } from "bun:test";
import { host } from "../kernel/fixtures/values.fixture.ts";
import { hostAgentInputs, hostAgentMembers } from "./host-table.ts";

test("an unregistered host has no agent inputs or accidental Kiro members", () => {
  expect(hostAgentInputs("claude")).toEqual([]);
  expect(hostAgentMembers(host({ name: "claude", directory: ".claude" })))
    .toEqual({ ok: true, value: null });
});

test("the Kiro table captures the conductor and every native persona", () => {
  expect(hostAgentInputs("kiro")).toEqual([
    "agents/aidlc.json", "agents/aidlc-architect-agent.json", "agents/aidlc-developer-agent.json",
    "agents/aidlc-product-lead-agent.json", "agents/aidlc-architecture-reviewer-agent.json",
    "agents/aidlc-composer-agent.json", "agents/aidlc-product-agent.json", "agents/aidlc-design-agent.json",
    "agents/aidlc-delivery-agent.json", "agents/aidlc-aws-platform-agent.json",
    "agents/aidlc-compliance-agent.json", "agents/aidlc-devsecops-agent.json",
    "agents/aidlc-quality-agent.json", "agents/aidlc-pipeline-deploy-agent.json",
    "agents/aidlc-operations-agent.json",
  ]);
});