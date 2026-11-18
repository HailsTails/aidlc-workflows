import { PERMISSION_POLICIES_FIXTURE } from "../../projection/fixtures/onboarding-permissions.fixture.ts";
import { brand } from "../../kernel/brand.ts";
import { prepareOnboardingContext, type OnboardingPermissions } from "../../projection/domain/onboarding-context.ts";
import { accept } from "../../kernel/fixtures/accept.ts";
import { commonHarnessRecord } from "../../projection/domain/harness-record.ts";
import { expect, test } from "bun:test";
import { distribution, path, source } from "../../kernel/fixtures/values.fixture.ts";
import { accepted } from "../../kernel/result.ts";
import { claudeDistribution } from "./distribution.ts";
import { CLAUDE_AUTHORED_PLACEMENTS, CLAUDE_BINDING_HEADING, CLAUDE_TIER_FLAVOR, CLAUDE_TOKENS } from "./host-data.ts";
import { claudeHost } from "./host.ts";
import { CLAUDE_ONBOARDING_FILLS } from "./onboarding-fills.ts";
import { claudeAgents } from "./projection/agent-renderer.ts";
import { claudeCommandPath } from "./projection/command-renderer.ts";
import { createClaudeDocumentRenderer } from "./projection/document-renderer.ts";
import { createClaudeSettingsRenderer } from "./projection/settings-renderer.ts";
import { createClaudeSkillRenderer } from "./projection/skill-renderer.ts";

const nativeContext = prepareOnboardingContext({ context: { channel: "native", permissions: brand<OnboardingPermissions>({
  policy: PERMISSION_POLICIES_FIXTURE["prefix-only"], prefix: "aidlc engine",
}) }, skeleton: "" });

test("Claude's module gathers the identity, distribution and every projection part the host already has", () => {
  const built = claudeHost();
  expect(built).toEqual(accepted({
    host: { distribution: distribution("claude"), directory: path(".claude") },
    projection: {
      tokens: CLAUDE_TOKENS,
      renderData: expect.any(Function),
      record: commonHarnessRecord,
      placements: CLAUDE_AUTHORED_PLACEMENTS,
      tierFlavor: CLAUDE_TIER_FLAVOR,
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
      fills: expect.any(Function),
      bindingHeading: CLAUDE_BINDING_HEADING,
    },
    distribution: claudeDistribution,
    routes: expect.any(Function),
  }));
});

test("host onboarding binds channel fills without changing its copy facts", () => {
  const module = accept(claudeHost());
  expect(module.projection.fills({ channel: "copy" })).toEqual(CLAUDE_ONBOARDING_FILLS);
  expect(module.projection.fills(nativeContext)).toBe(CLAUDE_ONBOARDING_FILLS);
});
