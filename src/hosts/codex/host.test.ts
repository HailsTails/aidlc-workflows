import { commonHarnessRecord } from "../../projection/domain/harness-record.ts";
import { expect, test } from "bun:test";
import { distribution, path, source } from "../../kernel/fixtures/values.fixture.ts";
import { accepted } from "../../kernel/result.ts";
import { accept } from "../../kernel/fixtures/accept.ts";
import { createRecordingTerminal } from "../../kernel/fixtures/terminal.fake.ts";
import { settingsRenderingInputsFixture } from "../../projection/fixtures/settings-rendering.fixture.ts";
import { codexDistribution } from "./distribution.ts";
import { CODEX_AUTHORED_PLACEMENTS, CODEX_BINDING_HEADING, CODEX_TIER_FLAVOR, CODEX_TOKENS } from "./host-data.ts";
import { codexHost } from "./host.ts";
import { CODEX_ONBOARDING_FILLS, codexOnboardingFills } from "./onboarding-fills.ts";
import { codexAgents } from "./projection/agent-renderer.ts";
import { codexCommandPath } from "./projection/command-renderer.ts";
import { createCodexDocumentRenderer } from "./projection/document-renderer.ts";

import { createCodexSkillRenderer } from "./projection/skill-renderer.ts";


test("codex module gathers the identity, distribution and every projection part the host already has", () => {
  expect(codexHost()).toEqual(accepted({
    host: { distribution: distribution("codex"), directory: path(".codex") },
    projection: {
      tokens: CODEX_TOKENS,
      renderData: expect.any(Function),
      record: commonHarnessRecord,
      placements: CODEX_AUTHORED_PLACEMENTS,
      tierFlavor: CODEX_TIER_FLAVOR,
      agents: { inputs: [], render: codexAgents },
      commands: codexCommandPath,
      skills: { inputs: [source("skills/aidlc/SKILL.md"), source("skills/aidlc/question-rendering.md"), source("skills/aidlc/composer.md"), source("skills/aidlc/tables.md")], render: createCodexSkillRenderer },
      settings: { inputs: [], render: expect.any(Function) },
      documents: { inputs: [], render: createCodexDocumentRenderer },
      fills: expect.any(Function),
      bindingHeading: CODEX_BINDING_HEADING,
    },
    distribution: codexDistribution,
    routes: expect.any(Function),
  }));
});

test("Codex binds the real host-owned hash into both hook settings and the trust route", async () => {
  const module = accept(codexHost());
  const terminal = createRecordingTerminal();
  const inputs = settingsRenderingInputsFixture({ harnessDir: ".codex", files: [] });
  const tokens = { ...inputs.tokens, ["INVOKE"]: "bun .codex/tools/aidlc.ts", ["TRUSTED_NAMESPACE"]: "engine" };
  const hooks = accept(module.projection.settings.render({ ...inputs, tokens,
    extendedSubprocessTimeoutMs: 1_800_000 }).renderHookRegistrations({ hooks: [] }));
  expect(hooks[1]?.content).toMatchObject({ kind: "text", text: expect.stringContaining(
    'trusted_hash = "sha256:58956c1f8f0b66e96c0f4d02e26946e79979e0f30599e8dc06a512ebecf03843"') });
  const routes = module.routes({ terminal, settings: { extendedSubprocessTimeoutMs: 1_800_000 },
    copyTokens: { ["INVOKE"]: "bun .codex/tools/aidlc.ts", ["TRUSTED_NAMESPACE"]: "engine",
      ["TOOL_PREFIX"]: "bun .codex/tools/" } });
  expect(await routes[0]?.run(["--project", "/project"])).toBe(0);
  expect(terminal.errors()).toEqual([]);
  expect(terminal.output()[0]).toContain(
    'trusted_hash = "sha256:58956c1f8f0b66e96c0f4d02e26946e79979e0f30599e8dc06a512ebecf03843"');
});

test("host onboarding binds channel fills without changing its copy facts", () => {
  const module = accept(codexHost());
  expect(module.projection.fills("copy")).toEqual(CODEX_ONBOARDING_FILLS);
  expect(module.projection.fills).toBe(codexOnboardingFills);
});
