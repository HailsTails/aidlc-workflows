import { describe, expect, test } from "bun:test";
import { source } from "../../kernel/fixtures/values.fixture.ts";
import {
  conductorDocumentFixture,
  documentRenderingInputsFixture,
  knowledgeDocumentFixture,
  ONBOARDING_FILLS_FIXTURE,
  ONBOARDING_TEMPLATES_FIXTURE,
  protocolDocumentFixture,
  stageDocumentFixture,
  templateDocumentFixture,
} from "./document-rendering.fixture.ts";
import { tokenBindingsFixture } from "./token-bindings.fixture.ts";

describe("onboarding fixtures", () => {
  test("keep the neutral template free of tokens", () => {
    expect(ONBOARDING_TEMPLATES_FIXTURE.neutral).not.toContain("{{");
  });

  test("carry a skeleton with a slot and every token a host binds", () => {
    expect(ONBOARDING_TEMPLATES_FIXTURE.harnessSkeleton).toContain("{{SLOT:title_block}}");
    expect(ONBOARDING_TEMPLATES_FIXTURE.harnessSkeleton).toContain("{{SKILL_INVOKE}}");
    expect(ONBOARDING_TEMPLATES_FIXTURE.harnessSkeleton).toContain("{{HARNESS_DIR}}");
    expect(ONBOARDING_TEMPLATES_FIXTURE.harnessSkeleton).toContain("{{INVOKE}}");
  });

  test("fill the skeleton's slot", () => {
    expect(ONBOARDING_FILLS_FIXTURE).toEqual({
      invoke: "/aidlc",
      slots: { ["title_block"]: "# AI-DLC for this host" },
    });
  });
});

describe("neutral document fixtures", () => {
  test("carry a protocol with every host's binding subsection, in the binding order, and a rules reference", () => {
    expect(protocolDocumentFixture()).toMatchObject({
      role: "protocol",
      content: {
        kind: "text",
        text: expect.stringMatching(/\{\{HARNESS_DIR\}\}\/rules\/[\s\S]*#### Claude Code[\s\S]*#### Kiro CLI[\s\S]*#### Kiro IDE[\s\S]*#### Codex CLI[\s\S]*#### Cursor[\s\S]*#### opencode[\s\S]*#### GitHub Copilot/),
      },
    });
  });

  test("cover every role a host places", () => {
    expect([
      protocolDocumentFixture().role,
      templateDocumentFixture().role,
      conductorDocumentFixture().role,
      stageDocumentFixture().role,
      knowledgeDocumentFixture().role,
    ]).toEqual(["protocol", "template", "conductor", "stage", "knowledge"]);
  });

  test("place a stage document at its core source path", () => {
    expect(stageDocumentFixture().source).toEqual(source("aidlc-common/stages/inception/requirements.md"));
  });
});

describe("documentRenderingInputsFixture", () => {
  test("offers the fills and the host's tokens", () => {
    expect(documentRenderingInputsFixture({ harnessDir: ".kiro" })).toEqual({
      fills: ONBOARDING_FILLS_FIXTURE,
      tokens: tokenBindingsFixture({ harnessDir: ".kiro" }),
    });
  });
});
