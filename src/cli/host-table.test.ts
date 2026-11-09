import { expect, test } from "bun:test";
import { host } from "../kernel/fixtures/values.fixture.ts";
import { hostAgentInputs, hostAgentMembers, hostSurfaceMembers } from "./host-table.ts";

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
test("the Kiro IDE host table uses policy-rendered data and all five native placements", () => {
  const members = hostSurfaceMembers(host({ name: "kiro-ide", directory: ".kiro" }));
  expect(members).not.toBeNull();
  expect(members?.placements).toEqual([
    { source: "steering/aidlc-active-memory.md", destination: ".kiro/steering/aidlc-active-memory.md" },
    { source: "agents/aidlc-aidlc.md", destination: ".kiro/agents/aidlc-aidlc.md" },
    { source: "hooks/aidlc-kiro-adapter.ts", destination: ".kiro/hooks/aidlc-kiro-adapter.ts" },
    { source: "hooks/aidlc-kiro-tool-names.ts", destination: ".kiro/hooks/aidlc-kiro-tool-names.ts" },
    { source: "dot-gitignore", destination: ".gitignore" },
  ]);
  const hostData = members?.renderData({ delegateShell: {
    shellDeny: (agent) => [`policy for ${agent}`], riskyForms: ["|"] } });
  expect(hostData?.productName).toBe("Kiro");
  expect(hostData?.pluginAgentFrontmatter?.copy).toContain("policy for plugin-agent");
  expect(hostData?.pluginAgentFrontmatter?.native).toEqual(hostData?.pluginAgentFrontmatter?.copy);
});
