import { expect, mock, test } from "bun:test";
import { distribution, path, source } from "../../kernel/fixtures/values.fixture.ts";
import { accept } from "../../kernel/fixtures/accept.ts";
import { accepted } from "../../kernel/result.ts";
import type { ProjectedFile } from "../../projection/domain/projected-file.ts";
import { kiroIdeDistribution } from "./distribution.ts";
import { KIRO_IDE_AUTHORED_PLACEMENTS, KIRO_IDE_BINDING_HEADING, KIRO_IDE_TOKENS } from "./host-data.ts";
import { kiroIdeHost } from "./host.ts";
import { KIRO_IDE_ONBOARDING_FILLS } from "./onboarding-fills.ts";
import type { KiroIdePersonaRendering } from "./projection/agent-renderer.ts";
import { kiroIdeHostData } from "./projection/host-data-renderer.ts";
import { kiroIdeCommandPath } from "./projection/command-renderer.ts";
import { createKiroIdeDocumentRenderer } from "./projection/document-renderer.ts";
import { createKiroIdeSettingsRenderer } from "./projection/settings-renderer.ts";
import { createKiroIdeSkillRenderer } from "./projection/skill-renderer.ts";

const personas = mock<KiroIdePersonaRendering>();

test("kiroIde module gathers the identity, distribution and every projection part the host already has", () => {
  expect(kiroIdeHost(personas)).toEqual(accepted({
    host: { distribution: distribution("kiro-ide"), directory: path(".kiro") },
    projection: {
      tokens: KIRO_IDE_TOKENS,
      renderData: kiroIdeHostData,
      placements: KIRO_IDE_AUTHORED_PLACEMENTS,
      agents: { inputs: [source("agents/aidlc-aidlc.md")], render: expect.any(Function) },
      commands: kiroIdeCommandPath,
      skills: { inputs: [source("skills/aidlc/SKILL.md"), source("skills/aidlc/question-rendering.md"), source("skills/aidlc/composer.md"), source("skills/aidlc/tables.md")], render: createKiroIdeSkillRenderer },
      settings: { inputs: [source("settings/cli.json"), source("hooks/aidlc-record-human-turn.json"), source("hooks/aidlc-guard-tool-call.json"), source("hooks/aidlc-log-subagent.json"), source("hooks/aidlc-session-start.json"), source("hooks/aidlc-continue-workflow.json")], render: createKiroIdeSettingsRenderer },
      documents: { inputs: [], render: createKiroIdeDocumentRenderer },
      fills: KIRO_IDE_ONBOARDING_FILLS,
      bindingHeading: KIRO_IDE_BINDING_HEADING,
      derive: expect.any(Function),
    },
    distribution: kiroIdeDistribution,
  }));
});

const record = (text: string): ProjectedFile => ({ path: path(".kiro/tools/data/harness.json"),
  content: { kind: "text", text }, mode: "regular", availability: "always",
  origin: { kind: "rendered", concept: "host-data", name: "kiro-ide" } });

test("kiroIde derives its steering file and completes its harness record in one step", () => {
  const derived = accept(accept(kiroIdeHost(personas)).projection.derive?.({
    files: [record('{\n  "newChatStep": 1\n}\n')] }) ?? accepted([]));
  expect(derived).toEqual([
    expect.objectContaining({ path: path(".kiro/steering/aidlc-active-memory.md") }),
    record('{\n  "newChatStep": 1,\n  "kiroLayout": "kas"\n}\n'),
  ]);
});
