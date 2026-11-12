import { expect, test } from "bun:test";
import { distribution, path, source } from "../../kernel/fixtures/values.fixture.ts";
import { accepted } from "../../kernel/result.ts";
import { cursorDistribution } from "./distribution.ts";
import { CURSOR_AUTHORED_PLACEMENTS, CURSOR_BINDING_HEADING, CURSOR_TOKENS } from "./host-data.ts";
import { cursorHost } from "./host.ts";
import { CURSOR_ONBOARDING_FILLS } from "./onboarding-fills.ts";
import { cursorAgents } from "./projection/agent-renderer.ts";
import { cursorCommandPath } from "./projection/command-renderer.ts";
import { createCursorDocumentRenderer } from "./projection/document-renderer.ts";
import { createCursorSettingsRenderer } from "./projection/settings-renderer.ts";
import { createCursorSkillRenderer } from "./projection/skill-renderer.ts";

test("cursor module gathers the identity, distribution and every projection part the host already has", () => {
  expect(cursorHost()).toEqual(accepted({
    host: { distribution: distribution("cursor"), directory: path(".cursor") },
    projection: {
      tokens: CURSOR_TOKENS,
      renderData: expect.any(Function),
      placements: CURSOR_AUTHORED_PLACEMENTS,
      agents: { inputs: [], render: cursorAgents },
      commands: cursorCommandPath,
      skills: { inputs: [source("skills/aidlc/SKILL.md"), source("skills/aidlc/question-rendering.md"), source("skills/aidlc/composer.md"), source("skills/aidlc/tables.md"), source("skills/aidlc-status/SKILL.md"), source("skills/aidlc-jump/SKILL.md"), source("skills/aidlc-scope/SKILL.md")], render: createCursorSkillRenderer },
      settings: { inputs: [source("cli.json"), source("hooks.json")], render: createCursorSettingsRenderer },
      documents: { inputs: [], render: createCursorDocumentRenderer },
      fills: CURSOR_ONBOARDING_FILLS,
      bindingHeading: CURSOR_BINDING_HEADING,
    },
    distribution: cursorDistribution,
  }));
});
