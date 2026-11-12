import { accepted } from "../../kernel/result.ts";
import { authoredSourcePaths } from "../../projection/domain/host-surface.ts";
import { claudeDistribution } from "./distribution.ts";
import { CLAUDE_AUTHORED_PLACEMENTS, CLAUDE_BINDING_HEADING, CLAUDE_HOST_DATA, CLAUDE_TOKENS, claudeHostIdentity } from "./host-data.ts";
import { CLAUDE_ONBOARDING_FILLS } from "./onboarding-fills.ts";
import { claudeAgents } from "./projection/agent-renderer.ts";
import { claudeCommandPath } from "./projection/command-renderer.ts";
import { createClaudeDocumentRenderer } from "./projection/document-renderer.ts";
import { CLAUDE_SETTINGS_INPUTS, createClaudeSettingsRenderer } from "./projection/settings-renderer.ts";
import { CLAUDE_SKILL_INPUTS, createClaudeSkillRenderer } from "./projection/skill-renderer.ts";

export const claudeHost = () => {
  const identity = claudeHostIdentity();
  if (!identity.ok) return identity;
  const skillInputs = authoredSourcePaths(CLAUDE_SKILL_INPUTS);
  if (!skillInputs.ok) return skillInputs;
  const settingsInputs = authoredSourcePaths(CLAUDE_SETTINGS_INPUTS);
  if (!settingsInputs.ok) return settingsInputs;
  return accepted({
    host: identity.value,
    projection: {
      tokens: CLAUDE_TOKENS,
      renderData: () => CLAUDE_HOST_DATA,
      placements: CLAUDE_AUTHORED_PLACEMENTS,
      agents: { inputs: [], render: claudeAgents },
      commands: claudeCommandPath,
      skills: { inputs: skillInputs.value, render: createClaudeSkillRenderer },
      settings: { inputs: settingsInputs.value, render: createClaudeSettingsRenderer },
      documents: { inputs: [], render: createClaudeDocumentRenderer },
      fills: CLAUDE_ONBOARDING_FILLS,
      bindingHeading: CLAUDE_BINDING_HEADING,
    },
    distribution: claudeDistribution,
  });
};
