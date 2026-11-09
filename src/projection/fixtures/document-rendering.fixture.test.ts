import { describe, expect, test } from "bun:test";
import { source } from "../../kernel/fixtures/values.fixture.ts";
import {
  conductorDocumentFixture,
  documentRenderingInputsFixture,
  knowledgeDocumentFixture,
  ONBOARDING_FILLS_FIXTURE,
  ONBOARDING_TEMPLATES_FIXTURE,
  orgMemoryFixture,
  protocolDocumentFixture,
  stageDocumentFixture,
  templateDocumentFixture,
} from "./document-rendering.fixture.ts";
import { tokenBindingsFixture } from "./token-bindings.fixture.ts";
import { methodPath } from "./values.fixture.ts";

describe("onboarding fixtures", () => {
  test("keep the neutral template free of tokens", () => {
    expect(ONBOARDING_TEMPLATES_FIXTURE.neutral).not.toContain("{{");
  });

  test("carry a skeleton with a slot and every token a host binds", () => {
    expect(ONBOARDING_TEMPLATES_FIXTURE.harnessSkeleton).toContain("{{SLOT:titleBlock}}");
    expect(ONBOARDING_TEMPLATES_FIXTURE.harnessSkeleton).toContain("{{SKILL_INVOKE}}");
    expect(ONBOARDING_TEMPLATES_FIXTURE.harnessSkeleton).toContain("{{HARNESS_DIR}}");
    expect(ONBOARDING_TEMPLATES_FIXTURE.harnessSkeleton).toContain("{{INVOKE}}");
  });

  test("fill the skeleton's slot", () => {
    expect(ONBOARDING_FILLS_FIXTURE).toEqual({
      invoke: "/aidlc",
      slots: { titleBlock: "# AI-DLC for this host" },
    });
  });
});

describe("neutral document fixtures", () => {
  test("carry a protocol with two hosts' binding subsections and a rules reference", () => {
    expect(protocolDocumentFixture).toMatchObject({
      role: "protocol",
      content: {
        kind: "text",
        text: expect.stringMatching(/\{\{HARNESS_DIR\}\}\/rules\/[\s\S]*#### Claude Code[\s\S]*#### Codex CLI/),
      },
    });
  });

  test("cover every role a host places", () => {
    expect([
      protocolDocumentFixture.role,
      templateDocumentFixture.role,
      conductorDocumentFixture.role,
      stageDocumentFixture.role,
      knowledgeDocumentFixture.role,
    ]).toEqual(["protocol", "template", "conductor", "stage", "knowledge"]);
  });

  test("place a stage document at its core source path", () => {
    expect(stageDocumentFixture.source).toEqual(source("aidlc-common/stages/inception/requirements.md"));
  });
});

describe("documentRenderingInputsFixture", () => {
  test("offers the fills, the host's tokens and the org memory rule", () => {
    expect(documentRenderingInputsFixture({ harnessDir: ".kiro" })).toEqual({
      fills: ONBOARDING_FILLS_FIXTURE,
      tokens: tokenBindingsFixture({ harnessDir: ".kiro" }),
      memory: [orgMemoryFixture],
    });
  });

  test("reads the org memory rule from the memory folder", () => {
    expect(orgMemoryFixture.path).toEqual(methodPath({ kind: "rule", within: "org.md" }));
  });
});
