import { accepted } from "../../kernel/result.ts";
import { authoredSourcePaths } from "../../projection/domain/host-surface.ts";
import { copilotDistribution } from "./distribution.ts";
import { COPILOT_AUTHORED_PLACEMENTS, COPILOT_BINDING_HEADING, COPILOT_HOST_DATA, COPILOT_TOKENS, copilotHostIdentity } from "./host-data.ts";
import { COPILOT_ONBOARDING_FILLS } from "./onboarding-fills.ts";
import { copilotAgents } from "./projection/agent-renderer.ts";
import { copilotCommandPath } from "./projection/command-renderer.ts";
import { createCopilotDocumentRenderer } from "./projection/document-renderer.ts";
import { COPILOT_SETTINGS_INPUTS, createCopilotSettingsRenderer } from "./projection/settings-renderer.ts";
import { COPILOT_SKILL_INPUTS, createCopilotSkillRenderer } from "./projection/skill-renderer.ts";

export const copilotHost = () => {
  const identity = copilotHostIdentity();
  if (!identity.ok) return identity;
  const agentInputs = authoredSourcePaths([]);
  if (!agentInputs.ok) return agentInputs;
  const skillInputs = authoredSourcePaths(COPILOT_SKILL_INPUTS);
  if (!skillInputs.ok) return skillInputs;
  const settingsInputs = authoredSourcePaths(COPILOT_SETTINGS_INPUTS);
  if (!settingsInputs.ok) return settingsInputs;
  return accepted({
    host: identity.value,
    projection: {
      tokens: COPILOT_TOKENS,
      renderData: () => COPILOT_HOST_DATA,
      placements: COPILOT_AUTHORED_PLACEMENTS,
      agents: { inputs: agentInputs.value, render: copilotAgents },
      commands: copilotCommandPath,
      skills: { inputs: skillInputs.value, render: createCopilotSkillRenderer },
      settings: { inputs: settingsInputs.value, render: createCopilotSettingsRenderer },
      documents: { inputs: [], render: createCopilotDocumentRenderer },
      fills: COPILOT_ONBOARDING_FILLS,
      bindingHeading: COPILOT_BINDING_HEADING,
    },
    distribution: copilotDistribution,
  });
};
