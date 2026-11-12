import { accepted } from "../../kernel/result.ts";
import { authoredSourcePaths } from "../../projection/domain/host-surface.ts";
import { kiroDistribution } from "./distribution.ts";
import { KIRO_AUTHORED_PLACEMENTS, KIRO_BINDING_HEADING, KIRO_HOST_DATA, KIRO_TOKENS, kiroHostIdentity } from "./host-data.ts";
import { KIRO_ONBOARDING_FILLS } from "./onboarding-fills.ts";
import { deriveKiroHarnessRecord } from "./projection/harness-record.ts";
import { KIRO_AGENT_JSON, kiroAgents } from "./projection/json-agent-renderer.ts";
import { kiroCommandPath } from "./projection/command-renderer.ts";
import { createKiroDocumentRenderer } from "./projection/document-renderer.ts";
import { KIRO_SETTINGS_INPUTS, createKiroSettingsRenderer } from "./projection/settings-renderer.ts";
import { KIRO_SKILL_INPUTS, createKiroSkillRenderer } from "./projection/skill-renderer.ts";

export const kiroHost = () => {
  const identity = kiroHostIdentity();
  if (!identity.ok) return identity;
  const agentInputs = authoredSourcePaths(KIRO_AGENT_JSON);
  if (!agentInputs.ok) return agentInputs;
  const skillInputs = authoredSourcePaths(KIRO_SKILL_INPUTS);
  if (!skillInputs.ok) return skillInputs;
  const settingsInputs = authoredSourcePaths(KIRO_SETTINGS_INPUTS);
  if (!settingsInputs.ok) return settingsInputs;
  return accepted({
    host: identity.value,
    projection: {
      tokens: KIRO_TOKENS,
      renderData: () => KIRO_HOST_DATA,
      placements: KIRO_AUTHORED_PLACEMENTS,
      agents: { inputs: agentInputs.value, render: kiroAgents },
      commands: kiroCommandPath,
      skills: { inputs: skillInputs.value, render: createKiroSkillRenderer },
      settings: { inputs: settingsInputs.value, render: createKiroSettingsRenderer },
      documents: { inputs: [], render: createKiroDocumentRenderer },
      fills: KIRO_ONBOARDING_FILLS,
      bindingHeading: KIRO_BINDING_HEADING,
      derive: deriveKiroHarnessRecord,
    },
    distribution: kiroDistribution,
  });
};

export { kiroAgentRenderer as kiroPersonas } from "./projection/agent-renderer.ts";
