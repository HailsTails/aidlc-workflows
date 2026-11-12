import { expect, test } from "bun:test";
import { distribution, path, source } from "../../kernel/fixtures/values.fixture.ts";
import { accepted } from "../../kernel/result.ts";
import { openCodeDistribution } from "./distribution.ts";
import { OPENCODE_AUTHORED_PLACEMENTS, OPENCODE_BINDING_HEADING, OPENCODE_TOKENS } from "./host-data.ts";
import { openCodeHost } from "./host.ts";
import { OPENCODE_ONBOARDING_FILLS } from "./onboarding-fills.ts";
import { openCodeAgents } from "./projection/agent-renderer.ts";
import { openCodeCommandPath } from "./projection/command-renderer.ts";
import { createOpenCodeDocumentRenderer } from "./projection/document-renderer.ts";
import { createOpenCodeSettingsRenderer } from "./projection/settings-renderer.ts";
import { createOpenCodeSkillRenderer } from "./projection/skill-renderer.ts";

test("openCode module gathers the identity, distribution and every projection part the host already has", () => {
  expect(openCodeHost()).toEqual(accepted({
    host: { distribution: distribution("opencode"), directory: path(".aidlc") },
    projection: {
      tokens: OPENCODE_TOKENS,
      renderData: expect.any(Function),
      placements: OPENCODE_AUTHORED_PLACEMENTS,
      agents: { inputs: [], render: openCodeAgents },
      commands: openCodeCommandPath,
      skills: { inputs: [source("skills/aidlc/SKILL.md"), source("skills/aidlc/question-rendering.md"), source("skills/aidlc/composer.md"), source("skills/aidlc/tables.md")], render: createOpenCodeSkillRenderer },
      settings: { inputs: [source("opencode.json"), source("plugin/aidlc-opencode-adapter.ts")], render: createOpenCodeSettingsRenderer },
      documents: { inputs: [], render: createOpenCodeDocumentRenderer },
      fills: OPENCODE_ONBOARDING_FILLS,
      bindingHeading: OPENCODE_BINDING_HEADING,
    },
    distribution: openCodeDistribution,
  }));
});
