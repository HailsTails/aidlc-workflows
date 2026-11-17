import { expect, test } from "bun:test";
import { path, source } from "../../../kernel/fixtures/values.fixture.ts";
import { methodSliceFixture } from "../../../workflow-definition/fixtures/method.fixture.ts";
import { ONBOARDING_TEMPLATES_FIXTURE, documentRenderingInputsFixture,
  protocolDocumentFixture } from "../../../projection/fixtures/document-rendering.fixture.ts";
import { createCopilotDocumentRenderer } from "./document-renderer.ts";

const renderer = createCopilotDocumentRenderer(documentRenderingInputsFixture({ harnessDir: ".aidlc" }));

test("Copilot combines neutral and native onboarding with one token substitution", () => {
  expect(renderer.renderOnboarding({ templates: ONBOARDING_TEMPLATES_FIXTURE, method: methodSliceFixture }))
    .toEqual({ ok: true, value: [{ path: path("AGENTS.md"), mode: "regular",
      origin: { kind: "rendered", concept: "onboarding", name: "AGENTS.md" }, content: { kind: "text", text:
        "# AI-DLC for this host\n\nStart a piece of work with /aidlc.\n" +
        "The install lives in .aidlc; run bun .aidlc/tools/aidlc.ts doctor to check it.\n\n" +
        "## Shared AI-DLC onboarding\n\n# AI-DLC in this project\n\nYour work is recorded under aidlc/.\n" } }] });
});

test("protocol placement keeps the Copilot binding after binding the copied Markdown", () => {
  const document = protocolDocumentFixture();
  expect(renderer.placeNeutralDocument({ document })).toEqual({ ok: true, value: [{
    path: path(".aidlc/aidlc-common/protocols/stage-protocol.md"), mode: "regular",
    origin: { kind: "neutral", source: document.source }, content: { kind: "text", text:
      "# Stage protocol\n\nRead the standing rules in .aidlc/rules/ before a stage starts.\n\n" +
      "## Harness bindings\n\n#### GitHub Copilot\n\nGitHub Copilot runs the stage in the chat.\n" },
  }] });
});

test("a protocol refusal names the actual neutral document", () => {
  expect(renderer.placeNeutralDocument({ document: { source: source("aidlc-common/protocols/bad.md"),
    role: "protocol", content: { kind: "text", text: "### GitHub Copilot\nOnly\n" } } })).toEqual({ ok: false,
    refusal: { kind: "render-failed", concept: "neutral-document", name: "aidlc-common/protocols/bad.md",
      reason: "harness bindings: aidlc-common/protocols/bad.md line 1: a binding run must name each tool once " +
        "(found GitHub Copilot; missing Claude Code, Kiro CLI, Kiro IDE, Codex CLI, Cursor, opencode)." } });
});

test("invalid neutral onboarding remains an onboarding refusal at its actual destination", () => {
  expect(renderer.renderOnboarding({ templates: { ...ONBOARDING_TEMPLATES_FIXTURE, neutral: "{{UNKNOWN}}" },
    method: methodSliceFixture })).toEqual({ ok: false, refusal: { kind: "render-failed", concept: "onboarding",
    name: "AGENTS.md", reason: "neutral onboarding must not contain template markers" } });
});

test("final document bytes are not rebound after the native renderer", () => {
  const inputs = documentRenderingInputsFixture({ harnessDir: ".aidlc" });
  const native = createCopilotDocumentRenderer({ ...inputs, tokens: { ...inputs.tokens, ["INVOKE"]: "{{HARNESS_DIR}}" } });
  expect(native.placeNeutralDocument({ document: { source: source("knowledge/one.md"), role: "knowledge",
    content: { kind: "text", text: "Run {{INVOKE}}" } } })).toEqual({ ok: true, value: [{
    path: path(".aidlc/knowledge/one.md"), mode: "regular",
    origin: { kind: "neutral", source: source("knowledge/one.md") }, content: { kind: "text", text: "Run {{HARNESS_DIR}}" },
  }] });
});

test("only onboarding rewrites the slash-suffixed skills family across both combined parts", () => {
  expect(renderer.renderOnboarding({ templates: {
    neutral: "Shared .aidlc/skills/reference.md and .claude/skills/keep.md.\n",
    harnessSkeleton: "Read {{HARNESS_DIR}}/skills/main.md and .aidlc/skills-other/example.\n",
  }, method: methodSliceFixture })).toEqual({ ok: true, value: [{
    path: path("AGENTS.md"), mode: "regular",
    origin: { kind: "rendered", concept: "onboarding", name: "AGENTS.md" }, content: { kind: "text", text:
      "Read .github/skills/main.md and .aidlc/skills-other/example.\n\n" +
      "## Shared AI-DLC onboarding\n\nShared .github/skills/reference.md and .claude/skills/keep.md.\n" },
  }] });
});

test("neutral documents retain runtime skills and rules paths without onboarding rewrites", () => {
  expect(renderer.placeNeutralDocument({ document: { source: source("knowledge/paths.md"), role: "knowledge",
    content: { kind: "text", text: "Read {{HARNESS_DIR}}/skills/one.md .aidlc/rules/default.rules .aidlc/rules/team.md" },
  } })).toEqual({ ok: true, value: [{
    path: path(".aidlc/knowledge/paths.md"), mode: "regular",
    origin: { kind: "neutral", source: source("knowledge/paths.md") }, content: { kind: "text",
      text: "Read .aidlc/skills/one.md .aidlc/rules/default.rules .aidlc/rules/team.md" },
  }] });
});
