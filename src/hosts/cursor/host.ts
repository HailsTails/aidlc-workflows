import { accepted } from "../../kernel/result.ts";
import { authoredSourcePaths } from "../../projection/domain/host-surface.ts";
import { cursorDistribution } from "./distribution.ts";
import { CURSOR_AUTHORED_PLACEMENTS, CURSOR_BINDING_HEADING, CURSOR_HOST_DATA, CURSOR_TOKENS, cursorHostIdentity } from "./host-data.ts";
import { CURSOR_ONBOARDING_FILLS } from "./onboarding-fills.ts";
import { cursorAgents } from "./projection/agent-renderer.ts";
import { cursorCommandPath } from "./projection/command-renderer.ts";
import { createCursorDocumentRenderer } from "./projection/document-renderer.ts";
import { CURSOR_SETTINGS_INPUTS, createCursorSettingsRenderer } from "./projection/settings-renderer.ts";
import { CURSOR_SKILL_INPUTS, createCursorSkillRenderer } from "./projection/skill-renderer.ts";

export const cursorHost = () => {
  const identity = cursorHostIdentity();
  if (!identity.ok) return identity;
  const agentInputs = authoredSourcePaths([]);
  if (!agentInputs.ok) return agentInputs;
  const skillInputs = authoredSourcePaths(CURSOR_SKILL_INPUTS);
  if (!skillInputs.ok) return skillInputs;
  const settingsInputs = authoredSourcePaths(CURSOR_SETTINGS_INPUTS);
  if (!settingsInputs.ok) return settingsInputs;
  return accepted({
    host: identity.value,
    projection: {
      tokens: CURSOR_TOKENS,
      renderData: () => CURSOR_HOST_DATA,
      placements: CURSOR_AUTHORED_PLACEMENTS,
      agents: { inputs: agentInputs.value, render: cursorAgents },
      commands: cursorCommandPath,
      skills: { inputs: skillInputs.value, render: createCursorSkillRenderer },
      settings: { inputs: settingsInputs.value, render: createCursorSettingsRenderer },
      documents: { inputs: [], render: createCursorDocumentRenderer },
      fills: CURSOR_ONBOARDING_FILLS,
      bindingHeading: CURSOR_BINDING_HEADING,
    },
    distribution: cursorDistribution,
  });
};
