import { expect, test } from "bun:test";
import { distribution, path, source } from "../../kernel/fixtures/values.fixture.ts";
import { accepted } from "../../kernel/result.ts";
import { copilotDistribution } from "./distribution.ts";
import { COPILOT_AUTHORED_PLACEMENTS, COPILOT_BINDING_HEADING, COPILOT_TOKENS } from "./host-data.ts";
import { copilotHost } from "./host.ts";
import { COPILOT_ONBOARDING_FILLS } from "./onboarding-fills.ts";
import { copilotAgents } from "./projection/agent-renderer.ts";
import { copilotCommandPath } from "./projection/command-renderer.ts";
import { createCopilotDocumentRenderer } from "./projection/document-renderer.ts";
import { createCopilotSettingsRenderer } from "./projection/settings-renderer.ts";
import { createCopilotSkillRenderer } from "./projection/skill-renderer.ts";

test("copilot module gathers the identity, distribution and every projection part the host already has", () => {
  expect(copilotHost()).toEqual(accepted({
    host: { distribution: distribution("copilot"), directory: path(".aidlc") },
    projection: {
      tokens: COPILOT_TOKENS,
      renderData: expect.any(Function),
      placements: COPILOT_AUTHORED_PLACEMENTS,
      agents: { inputs: [], render: copilotAgents },
      commands: copilotCommandPath,
      skills: { inputs: [source("skills/aidlc/SKILL.md"), source("skills/aidlc/question-rendering.md"), source("skills/aidlc/composer.md"), source("skills/aidlc/tables.md")], render: createCopilotSkillRenderer },
      settings: { inputs: [], render: createCopilotSettingsRenderer },
      documents: { inputs: [], render: createCopilotDocumentRenderer },
      fills: COPILOT_ONBOARDING_FILLS,
      bindingHeading: COPILOT_BINDING_HEADING,
    },
    distribution: copilotDistribution,
    routes: expect.any(Function),
  }));
});
