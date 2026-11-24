import { accept } from "../../kernel/fixtures/accept.ts";
import { commonHarnessRecord } from "../../projection/domain/harness-record.ts";
import { expect, test } from "bun:test";
import { distribution, path, source } from "../../kernel/fixtures/values.fixture.ts";
import { accepted } from "../../kernel/result.ts";
import { cursorDistribution } from "./distribution.ts";
import { CURSOR_AUTHORED_PLACEMENTS, CURSOR_BINDING_HEADING, CURSOR_TIER_FLAVOR, CURSOR_TOKENS } from "./host-data.ts";
import { cursorHost } from "./host.ts";
import { CURSOR_ONBOARDING_FILLS, cursorOnboardingFills } from "./onboarding-fills.ts";
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
      record: commonHarnessRecord,
      placements: CURSOR_AUTHORED_PLACEMENTS,
      tierFlavor: CURSOR_TIER_FLAVOR,
      agents: { inputs: [], render: cursorAgents },
      commands: cursorCommandPath,
      skills: { inputs: [source("skills/aidlc/SKILL.md"), source("skills/aidlc/question-rendering.md"), source("skills/aidlc/composer.md"), source("skills/aidlc/tables.md"), source("skills/aidlc-status/SKILL.md"), source("skills/aidlc-jump/SKILL.md"), source("skills/aidlc-scope/SKILL.md")], render: createCursorSkillRenderer },
      settings: { inputs: [source("cli.json"), source("hooks.json")], render: createCursorSettingsRenderer },
      documents: { inputs: [], render: createCursorDocumentRenderer },
      fills: expect.any(Function),
      bindingHeading: CURSOR_BINDING_HEADING,
    },
    distribution: cursorDistribution,
    routes: expect.any(Function),
  }));
});

test("host onboarding binds channel fills without changing its copy facts", () => {
  const module = accept(cursorHost());
  expect(module.projection.fills).toBe(cursorOnboardingFills);
  expect(module.projection.fills({ channel: "copy" })).toEqual(CURSOR_ONBOARDING_FILLS);
});
