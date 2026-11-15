import { createKiroIdeHarnessRecord } from "./projection/harness-record.ts";
import { expect, mock, test } from "bun:test";
import { distribution, path, source } from "../../kernel/fixtures/values.fixture.ts";
import { accept } from "../../kernel/fixtures/accept.ts";
import { accepted } from "../../kernel/result.ts";
import { DELEGATE_SHELL_FACTS } from "../../projection/fixtures/delegate-shell-facts.fixture.ts";
import type { ProjectedFile } from "../../projection/domain/projected-file.ts";
import { KIRO_IDE_AUTHORED_PLACEMENTS, KIRO_IDE_BINDING_HEADING, KIRO_IDE_TIER_FLAVOR, KIRO_IDE_TOKENS } from "./host-data.ts";
import { kiroIdeHost } from "./host.ts";
import { KIRO_IDE_ONBOARDING_FILLS, kiroIdeOnboardingFills } from "./onboarding-fills.ts";
import type { KiroIdePersonaRendering } from "./projection/agent-renderer.ts";
import { kiroIdeHostData } from "./projection/host-data-renderer.ts";
import { kiroIdeCommandPath } from "./projection/command-renderer.ts";
import { createKiroIdeDocumentRenderer } from "./projection/document-renderer.ts";
import { createKiroIdeSettingsRenderer } from "./projection/settings-renderer.ts";
import { createKiroIdeSkillRenderer } from "./projection/skill-renderer.ts";

const personas = mock<KiroIdePersonaRendering>();
const permissionsLine = (prefix: string): string => `- **Permissions**: Kiro CLI's line for ${prefix}.`;
const kiroCli = { personas, permissionsLine };

test("kiroIde module gathers the identity, distribution and every projection part the host already has", () => {
  expect(kiroIdeHost(kiroCli)).toEqual(accepted({
    host: { distribution: distribution("kiro-ide"), directory: path(".kiro") },
    projection: {
      tokens: KIRO_IDE_TOKENS,
      renderData: kiroIdeHostData,
      record: createKiroIdeHarnessRecord,
      placements: KIRO_IDE_AUTHORED_PLACEMENTS,
      tierFlavor: KIRO_IDE_TIER_FLAVOR,
      agents: { inputs: [source("agents/aidlc-aidlc.md")], render: expect.any(Function) },
      commands: kiroIdeCommandPath,
      skills: { inputs: [source("skills/aidlc/SKILL.md"), source("skills/aidlc/workflow.md"), source("skills/aidlc/question-rendering.md"), source("skills/aidlc/composer.md"), source("skills/aidlc/tables.md")], render: createKiroIdeSkillRenderer },
      settings: { inputs: [source("settings/cli.json"), source("hooks/aidlc-record-human-turn.json"), source("hooks/aidlc-guard-tool-call.json"), source("hooks/aidlc-log-subagent.json"), source("hooks/aidlc-session-start.json"), source("hooks/aidlc-continue-workflow.json")], render: createKiroIdeSettingsRenderer },
      documents: { inputs: [], render: createKiroIdeDocumentRenderer },
      fills: expect.any(Function),
      bindingHeading: KIRO_IDE_BINDING_HEADING,
      derive: expect.any(Function),
    },
    distribution: expect.any(Function),
    routes: expect.any(Function),
  }));
});

const record = (text: string): ProjectedFile => ({ path: path(".kiro/tools/data/harness.json"),
  content: { kind: "text", text }, mode: "regular",
  origin: { kind: "rendered", concept: "host-data", name: "kiro-ide" } });

test("kiroIde derives only steering after its complete record was already constructed", () => {
  const derived = accept(accept(kiroIdeHost(kiroCli)).projection.derive?.({
    files: [record('{\n  "newChatStep": 1\n}\n')] }) ?? accepted([]));
  expect(derived).toEqual([
    expect.objectContaining({ path: path(".kiro/steering/aidlc-active-memory.md") }),

  ]);
});

test("kiroIde says Kiro CLI's native permissions line, handed in by the root", () => {
  const module = accept(kiroIdeHost(kiroCli));
  const distribution = accept(module.distribution({ delegateShellFacts: DELEGATE_SHELL_FACTS }));
  expect(distribution.native.permissions).toEqual({ kind: "host-line", line: permissionsLine });
});

test("host onboarding binds channel fills without changing its copy facts", () => {
  const module = accept(kiroIdeHost(kiroCli));
  expect(module.projection.fills({ channel: "copy" })).toEqual(KIRO_IDE_ONBOARDING_FILLS);
  expect(module.projection.fills).toBe(kiroIdeOnboardingFills);
});
