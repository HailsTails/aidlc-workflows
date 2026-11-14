import type { HostProjectionParts } from "../../projection/application/ports/host-parts.ts";
import { commonHarnessRecord } from "../../projection/domain/harness-record.ts";
import { accepted } from "../../kernel/result.ts";
import { authoredSourcePaths } from "../../projection/domain/host-surface.ts";
import { codexDistribution } from "./distribution.ts";
import { CODEX_AUTHORED_PLACEMENTS, CODEX_BINDING_HEADING, CODEX_TIER_FLAVOR, CODEX_HOST_DATA, CODEX_TOKENS, codexHostIdentity } from "./host-data.ts";
import { CODEX_ONBOARDING_FILLS } from "./onboarding-fills.ts";
import { codexAgents } from "./projection/agent-renderer.ts";
import { codexCommandPath } from "./projection/command-renderer.ts";
import { createCodexDocumentRenderer } from "./projection/document-renderer.ts";
import { CODEX_SETTINGS_INPUTS, createCodexSettingsRenderer } from "./projection/settings-renderer.ts";
import { CODEX_SKILL_INPUTS, createCodexSkillRenderer } from "./projection/skill-renderer.ts";
import { codexTrustRoutes } from "./trust-route.ts";
import { codexHookTrust } from "./projection/hook-trust.ts";

const onboardingFills: HostProjectionParts["fills"] = () => CODEX_ONBOARDING_FILLS;

export const codexHost = () => {
  const identity = codexHostIdentity();
  if (!identity.ok) return identity;
  const agentInputs = authoredSourcePaths([]);
  if (!agentInputs.ok) return agentInputs;
  const skillInputs = authoredSourcePaths(CODEX_SKILL_INPUTS);
  if (!skillInputs.ok) return skillInputs;
  const settingsInputs = authoredSourcePaths(CODEX_SETTINGS_INPUTS);
  if (!settingsInputs.ok) return settingsInputs;
  return accepted({
    host: identity.value,
    projection: {
      tokens: CODEX_TOKENS,
      renderData: () => CODEX_HOST_DATA,
      record: commonHarnessRecord,
      placements: CODEX_AUTHORED_PLACEMENTS,
      tierFlavor: CODEX_TIER_FLAVOR,
      agents: { inputs: agentInputs.value, render: codexAgents },
      commands: codexCommandPath,
      skills: { inputs: skillInputs.value, render: createCodexSkillRenderer },
      settings: { inputs: settingsInputs.value, render: createCodexSettingsRenderer(codexHookTrust) },
      documents: { inputs: [], render: createCodexDocumentRenderer },
      fills: onboardingFills,
      bindingHeading: CODEX_BINDING_HEADING,
    },
    distribution: codexDistribution,
    routes: codexTrustRoutes(codexHookTrust),
  });
};
