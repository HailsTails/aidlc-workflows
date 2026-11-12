import { expect, test } from "bun:test";
import { distribution, path, source } from "../../kernel/fixtures/values.fixture.ts";
import { accepted } from "../../kernel/result.ts";
import { claudeDistribution } from "./distribution.ts";
import { CLAUDE_AUTHORED_PLACEMENTS, CLAUDE_BINDING_HEADING, CLAUDE_TOKENS } from "./host-data.ts";
import { claudeHost } from "./host.ts";
import { CLAUDE_ONBOARDING_FILLS } from "./onboarding-fills.ts";
import { claudeAgents } from "./projection/agent-renderer.ts";
import { claudeCommandPath } from "./projection/command-renderer.ts";
import { createClaudeDocumentRenderer } from "./projection/document-renderer.ts";
import { createClaudeSettingsRenderer } from "./projection/settings-renderer.ts";
import { createClaudeSkillRenderer } from "./projection/skill-renderer.ts";

test("Claude's module gathers the identity, distribution and every projection part the host already has", () => {
  const built = claudeHost();
  expect(built).toEqual(accepted({
    host: { distribution: distribution("claude"), directory: path(".claude") },
    projection: {
      tokens: CLAUDE_TOKENS,
      renderData: expect.any(Function),
      placements: CLAUDE_AUTHORED_PLACEMENTS,
      agents: { inputs: [], render: claudeAgents },
      commands: claudeCommandPath,
      skills: {
        inputs: [
          source("skills/aidlc/SKILL.md"), source("skills/aidlc/question-rendering.md"),
          source("skills/aidlc/composer.md"), source("skills/aidlc/tables.md"),
        ],
        render: createClaudeSkillRenderer,
      },
      settings: { inputs: [source("settings.json")], render: createClaudeSettingsRenderer },
      documents: { inputs: [], render: createClaudeDocumentRenderer },
      fills: CLAUDE_ONBOARDING_FILLS,
      bindingHeading: CLAUDE_BINDING_HEADING,
    },
    distribution: claudeDistribution,
  }));
});
