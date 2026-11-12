import { expect, test } from "bun:test";
import { path, source } from "../../../kernel/fixtures/values.fixture.ts";
import { methodSliceFixture } from "../../../workflow-definition/fixtures/method.fixture.ts";
import { ONBOARDING_TEMPLATES_FIXTURE, documentRenderingInputsFixture,
  protocolDocumentFixture } from "../../../projection/fixtures/document-rendering.fixture.ts";
import { createClaudeDocumentRenderer } from "./document-renderer.ts";

const renderer = createClaudeDocumentRenderer(documentRenderingInputsFixture({ harnessDir: ".claude" }));

test("Claude combines neutral and native onboarding with one token substitution", () => {
  expect(renderer.renderOnboarding({ templates: ONBOARDING_TEMPLATES_FIXTURE, method: methodSliceFixture }))
    .toEqual({ ok: true, value: [{ path: path(".claude/CLAUDE.md"), mode: "regular",
      origin: { kind: "rendered", concept: "onboarding", name: ".claude/CLAUDE.md" }, content: { kind: "text", text:
        "# AI-DLC for this host\n\nStart a piece of work with /aidlc.\n" +
        "The install lives in .claude; run bun .claude/tools/aidlc.ts doctor to check it.\n\n" +
        "## Shared AI-DLC onboarding\n\n# AI-DLC in this project\n\nYour work is recorded under aidlc/.\n" } }] });
});

test("protocol placement keeps the Claude binding after binding the copied Markdown", () => {
  const document = protocolDocumentFixture();
  expect(renderer.placeNeutralDocument({ document })).toEqual({ ok: true, value: [{
    path: path(".claude/aidlc-common/protocols/stage-protocol.md"), mode: "regular",
    origin: { kind: "neutral", source: document.source }, content: { kind: "text", text:
      "# Stage protocol\n\nRead the standing rules in .claude/rules/ before a stage starts.\n\n" +
      "## Harness bindings\n\n#### Claude Code\n\nClaude Code runs the stage in the chat.\n\n" },
  }] });
});

test("a protocol refusal names the actual neutral document", () => {
  expect(renderer.placeNeutralDocument({ document: { source: source("aidlc-common/protocols/bad.md"),
    role: "protocol", content: { kind: "text", text: "### Claude Code\nOnly\n" } } })).toEqual({ ok: false,
    refusal: { kind: "render-failed", concept: "neutral-document", name: "aidlc-common/protocols/bad.md",
      reason: "harness bindings: aidlc-common/protocols/bad.md line 1: a binding run must name each tool once " +
        "(found Claude Code; missing Kiro CLI, Kiro IDE, Codex CLI, Cursor, opencode, GitHub Copilot)." } });
});

test("invalid neutral onboarding remains an onboarding refusal at its actual destination", () => {
  expect(renderer.renderOnboarding({ templates: { ...ONBOARDING_TEMPLATES_FIXTURE, neutral: "{{UNKNOWN}}" },
    method: methodSliceFixture })).toEqual({ ok: false, refusal: { kind: "render-failed", concept: "onboarding",
    name: ".claude/CLAUDE.md", reason: "neutral onboarding must not contain template markers" } });
});

test("final document bytes are not rebound after the native renderer", () => {
  const inputs = documentRenderingInputsFixture({ harnessDir: ".claude" });
  const native = createClaudeDocumentRenderer({ ...inputs, tokens: { ...inputs.tokens, ["INVOKE"]: "{{HARNESS_DIR}}" } });
  expect(native.placeNeutralDocument({ document: { source: source("knowledge/one.md"), role: "knowledge",
    content: { kind: "text", text: "Run {{INVOKE}}" } } })).toEqual({ ok: true, value: [{
    path: path(".claude/knowledge/one.md"), mode: "regular",
    origin: { kind: "neutral", source: source("knowledge/one.md") }, content: { kind: "text", text: "Run {{HARNESS_DIR}}" },
  }] });
});
