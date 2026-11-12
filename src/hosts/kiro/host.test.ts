import { expect, test } from "bun:test";
import { distribution, path, source } from "../../kernel/fixtures/values.fixture.ts";
import { accepted } from "../../kernel/result.ts";
import { kiroDistribution } from "./distribution.ts";
import { KIRO_AUTHORED_PLACEMENTS, KIRO_BINDING_HEADING, KIRO_TOKENS } from "./host-data.ts";
import { kiroHost, kiroPersonas } from "./host.ts";
import { KIRO_ONBOARDING_FILLS } from "./onboarding-fills.ts";
import { kiroAgentRenderer } from "./projection/agent-renderer.ts";
import { deriveKiroHarnessRecord } from "./projection/harness-record.ts";
import { kiroAgents } from "./projection/json-agent-renderer.ts";
import { kiroCommandPath } from "./projection/command-renderer.ts";
import { createKiroDocumentRenderer } from "./projection/document-renderer.ts";
import { createKiroSettingsRenderer } from "./projection/settings-renderer.ts";
import { createKiroSkillRenderer } from "./projection/skill-renderer.ts";

test("kiro module gathers the identity, distribution and every projection part the host already has", () => {
  expect(kiroHost()).toEqual(accepted({
    host: { distribution: distribution("kiro"), directory: path(".kiro") },
    projection: {
      tokens: KIRO_TOKENS,
      renderData: expect.any(Function),
      placements: KIRO_AUTHORED_PLACEMENTS,
      agents: { inputs: [source("agents/aidlc.json"), source("agents/aidlc-architect-agent.json"), source("agents/aidlc-developer-agent.json"), source("agents/aidlc-product-lead-agent.json"), source("agents/aidlc-architecture-reviewer-agent.json"), source("agents/aidlc-composer-agent.json"), source("agents/aidlc-product-agent.json"), source("agents/aidlc-design-agent.json"), source("agents/aidlc-delivery-agent.json"), source("agents/aidlc-aws-platform-agent.json"), source("agents/aidlc-compliance-agent.json"), source("agents/aidlc-devsecops-agent.json"), source("agents/aidlc-quality-agent.json"), source("agents/aidlc-pipeline-deploy-agent.json"), source("agents/aidlc-operations-agent.json")], render: kiroAgents },
      commands: kiroCommandPath,
      skills: { inputs: [source("skills/aidlc/SKILL.md"), source("skills/aidlc/question-rendering.md"), source("skills/aidlc/composer.md"), source("skills/aidlc/tables.md")], render: createKiroSkillRenderer },
      settings: { inputs: [source("settings/cli.json"), source("hooks/aidlc-record-human-turn.kiro.hook"), source("hooks/aidlc-plan-approval-guard.kiro.hook")], render: createKiroSettingsRenderer },
      documents: { inputs: [], render: createKiroDocumentRenderer },
      fills: KIRO_ONBOARDING_FILLS,
      bindingHeading: KIRO_BINDING_HEADING,
      derive: deriveKiroHarnessRecord,
    },
    distribution: kiroDistribution,
  }));
});

test("Kiro offers its persona renderer beside its module for the host that builds on it", () => {
  expect(kiroPersonas).toBe(kiroAgentRenderer);
});
