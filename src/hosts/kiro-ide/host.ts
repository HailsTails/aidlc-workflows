import { accepted } from "../../kernel/result.ts";
import type { HostFileDeriver } from "../../projection/application/ports/harness.ts";
import { authoredSourcePaths } from "../../projection/domain/host-surface.ts";
import { kiroIdeDistribution } from "./distribution.ts";
import { KIRO_IDE_AUTHORED_PLACEMENTS, KIRO_IDE_BINDING_HEADING, KIRO_IDE_TOKENS, kiroIdeHostIdentity } from "./host-data.ts";
import { KIRO_IDE_ONBOARDING_FILLS } from "./onboarding-fills.ts";
import { createKiroIdeAgents, type KiroIdePersonaRendering } from "./projection/agent-renderer.ts";
import { kiroIdeHostData } from "./projection/host-data-renderer.ts";
import { kiroIdeCommandPath } from "./projection/command-renderer.ts";
import { createKiroIdeDocumentRenderer } from "./projection/document-renderer.ts";
import { KIRO_IDE_SETTINGS_INPUTS, createKiroIdeSettingsRenderer } from "./projection/settings-renderer.ts";
import { KIRO_IDE_SKILL_INPUTS, createKiroIdeSkillRenderer } from "./projection/skill-renderer.ts";
import { deriveKiroIdeHarnessRecord } from "./projection/harness-record.ts";
import { deriveKiroIdeSteering } from "./projection/steering-deriver.ts";

const KIRO_IDE_DERIVERS: readonly HostFileDeriver[] = [deriveKiroIdeSteering, deriveKiroIdeHarnessRecord];

const deriveKiroIdeFiles: HostFileDeriver = (request) => {
  const derived = KIRO_IDE_DERIVERS.map((derive) => derive(request));
  const failed = derived.find((rendering) => !rendering.ok);
  return failed ?? accepted(derived.flatMap((rendering) => (rendering.ok ? rendering.value : [])));
};

export const kiroIdeHost = (personas: KiroIdePersonaRendering) => {
  const identity = kiroIdeHostIdentity();
  if (!identity.ok) return identity;
  const agentInputs = authoredSourcePaths(["agents/aidlc-aidlc.md"]);
  if (!agentInputs.ok) return agentInputs;
  const skillInputs = authoredSourcePaths(KIRO_IDE_SKILL_INPUTS);
  if (!skillInputs.ok) return skillInputs;
  const settingsInputs = authoredSourcePaths(KIRO_IDE_SETTINGS_INPUTS);
  if (!settingsInputs.ok) return settingsInputs;
  return accepted({
    host: identity.value,
    projection: {
      tokens: KIRO_IDE_TOKENS,
      renderData: kiroIdeHostData,
      placements: KIRO_IDE_AUTHORED_PLACEMENTS,
      agents: { inputs: agentInputs.value, render: createKiroIdeAgents({ personas }) },
      commands: kiroIdeCommandPath,
      skills: { inputs: skillInputs.value, render: createKiroIdeSkillRenderer },
      settings: { inputs: settingsInputs.value, render: createKiroIdeSettingsRenderer },
      documents: { inputs: [], render: createKiroIdeDocumentRenderer },
      fills: KIRO_IDE_ONBOARDING_FILLS,
      bindingHeading: KIRO_IDE_BINDING_HEADING,
      derive: deriveKiroIdeFiles,
    },
    distribution: kiroIdeDistribution,
    routes: () => [],
  });
};
