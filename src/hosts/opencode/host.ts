import { commonHarnessRecord } from "../../projection/domain/harness-record.ts";
import { accepted } from "../../kernel/result.ts";
import { authoredSourcePaths } from "../../projection/domain/host-surface.ts";
import { openCodeDistribution } from "./distribution.ts";
import { OPENCODE_AUTHORED_PLACEMENTS, OPENCODE_BINDING_HEADING, OPENCODE_TIER_FLAVOR, OPENCODE_HOST_DATA, OPENCODE_TOKENS, openCodeHostIdentity } from "./host-data.ts";
import { openCodeOnboardingFills } from "./onboarding-fills.ts";
import { openCodeAgents } from "./projection/agent-renderer.ts";
import { openCodeCommandPath } from "./projection/command-renderer.ts";
import { createOpenCodeDocumentRenderer } from "./projection/document-renderer.ts";
import { OPENCODE_SETTINGS_INPUTS, createOpenCodeSettingsRenderer } from "./projection/settings-renderer.ts";
import { OPENCODE_SKILL_INPUTS, createOpenCodeSkillRenderer } from "./projection/skill-renderer.ts";

export const openCodeHost = () => {
  const identity = openCodeHostIdentity();
  if (!identity.ok) return identity;
  const agentInputs = authoredSourcePaths([]);
  if (!agentInputs.ok) return agentInputs;
  const skillInputs = authoredSourcePaths(OPENCODE_SKILL_INPUTS);
  if (!skillInputs.ok) return skillInputs;
  const settingsInputs = authoredSourcePaths(OPENCODE_SETTINGS_INPUTS);
  if (!settingsInputs.ok) return settingsInputs;
  return accepted({
    host: identity.value,
    projection: {
      tokens: OPENCODE_TOKENS,
      renderData: () => OPENCODE_HOST_DATA,
      record: commonHarnessRecord,
      placements: OPENCODE_AUTHORED_PLACEMENTS,
      tierFlavor: OPENCODE_TIER_FLAVOR,
      agents: { inputs: agentInputs.value, render: openCodeAgents },
      commands: openCodeCommandPath,
      skills: { inputs: skillInputs.value, render: createOpenCodeSkillRenderer },
      settings: { inputs: settingsInputs.value, render: createOpenCodeSettingsRenderer },
      documents: { inputs: [], render: createOpenCodeDocumentRenderer },
      fills: openCodeOnboardingFills,
      bindingHeading: OPENCODE_BINDING_HEADING,
    },
    distribution: openCodeDistribution,
    routes: () => [],
  });
};
