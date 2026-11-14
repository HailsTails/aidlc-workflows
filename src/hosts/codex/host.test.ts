import { expect, test } from "bun:test";
import { distribution, path, source } from "../../kernel/fixtures/values.fixture.ts";
import { accepted } from "../../kernel/result.ts";
import { codexDistribution } from "./distribution.ts";
import { CODEX_AUTHORED_PLACEMENTS, CODEX_BINDING_HEADING, CODEX_TOKENS } from "./host-data.ts";
import { codexHost } from "./host.ts";
import { CODEX_ONBOARDING_FILLS } from "./onboarding-fills.ts";
import { codexAgents } from "./projection/agent-renderer.ts";
import { codexCommandPath } from "./projection/command-renderer.ts";
import { createCodexDocumentRenderer } from "./projection/document-renderer.ts";
import { createCodexSettingsRenderer } from "./projection/settings-renderer.ts";
import { createCodexSkillRenderer } from "./projection/skill-renderer.ts";
import { codexTrustRoutes } from "./trust-route.ts";

test("codex module gathers the identity, distribution and every projection part the host already has", () => {
  expect(codexHost()).toEqual(accepted({
    host: { distribution: distribution("codex"), directory: path(".codex") },
    projection: {
      tokens: CODEX_TOKENS,
      renderData: expect.any(Function),
      placements: CODEX_AUTHORED_PLACEMENTS,
      agents: { inputs: [], render: codexAgents },
      commands: codexCommandPath,
      skills: { inputs: [source("skills/aidlc/SKILL.md"), source("skills/aidlc/question-rendering.md"), source("skills/aidlc/composer.md"), source("skills/aidlc/tables.md")], render: createCodexSkillRenderer },
      settings: { inputs: [], render: createCodexSettingsRenderer },
      documents: { inputs: [], render: createCodexDocumentRenderer },
      fills: CODEX_ONBOARDING_FILLS,
      bindingHeading: CODEX_BINDING_HEADING,
    },
    distribution: codexDistribution,
    routes: codexTrustRoutes,
  }));
});
