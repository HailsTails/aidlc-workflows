import { source } from "../../kernel/fixtures/values.fixture.ts";
import type { DocumentRenderingInputs } from "../application/ports/documents.ts";
import type { NeutralDocument, OnboardingFills, OnboardingTemplates } from "../domain/neutral-surface.ts";
import { tokenBindingsFixture } from "./token-bindings.fixture.ts";
import { text } from "./values.fixture.ts";

export const ONBOARDING_TEMPLATES_FIXTURE: OnboardingTemplates = {
  neutral: ["# AI-DLC in this project", "", "Your work is recorded under aidlc/.", ""].join("\n"),
  harnessSkeleton: [
    "{{SLOT:title_block}}",
    "",
    "Start a piece of work with {{SKILL_INVOKE}}.",
    "The install lives in {{HARNESS_DIR}}; run {{INVOKE}} doctor to check it.",
    "",
  ].join("\n"),
};

export const ONBOARDING_FILLS_FIXTURE: OnboardingFills = {
  invoke: "/aidlc",
  slots: { ["title_block"]: "# AI-DLC for this host" },
};

export const protocolDocumentFixture = (): NeutralDocument => ({
  source: source("aidlc-common/protocols/stage-protocol.md"),
  role: "protocol",
  content: text([
    "# Stage protocol",
    "",
    "Read the standing rules in {{HARNESS_DIR}}/rules/ before a stage starts.",
    "",
    "## Harness bindings",
    "",
    "#### Claude Code",
    "",
    "Claude Code runs the stage in the chat.",
    "",
    "#### Kiro CLI",
    "",
    "Kiro CLI runs the stage in the agent.",
    "",
    "#### Kiro IDE",
    "",
    "Kiro IDE runs the stage in the agent panel.",
    "",
    "#### Codex CLI",
    "",
    "Codex CLI runs the stage in the session.",
    "",
    "#### Cursor",
    "",
    "Cursor runs the stage in the agent chat.",
    "",
    "#### opencode",
    "",
    "opencode runs the stage in the session.",
    "",
    "#### GitHub Copilot",
    "",
    "GitHub Copilot runs the stage in the chat.",
  ]),
});

export const templateDocumentFixture = (): NeutralDocument => ({
  source: source("aidlc-common/templates/intent.md"),
  role: "template",
  content: text(["# Intent", "", "Run {{INVOKE}} status to see where the work stands."]),
});

export const conductorDocumentFixture = (): NeutralDocument => ({
  source: source("aidlc-common/conductor.md"),
  role: "conductor",
  content: text(["# The Conductor's Craft", "", "Ask the engine for the next step."]),
});

export const stageDocumentFixture = (): NeutralDocument => ({
  source: source("aidlc-common/stages/inception/requirements.md"),
  role: "stage",
  content: text(["# Requirements", "", "Write the requirements into aidlc/."]),
});

export const knowledgeDocumentFixture = (): NeutralDocument => ({
  source: source("knowledge/aidlc-shared/glossary.md"),
  role: "knowledge",
  content: text(["# Glossary", "", "A stage is a station on a line."]),
});

export const documentRenderingInputsFixture = ({ harnessDir }: {
  readonly harnessDir: string;
}): DocumentRenderingInputs => ({
  fills: ONBOARDING_FILLS_FIXTURE,
  tokens: tokenBindingsFixture({ harnessDir }),
});
