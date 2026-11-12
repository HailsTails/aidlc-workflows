import { expect, test } from "bun:test";
import { path, source } from "../../../kernel/fixtures/values.fixture.ts";
import { methodSliceFixture } from "../../../workflow-definition/fixtures/method.fixture.ts";
import { ONBOARDING_TEMPLATES_FIXTURE, documentRenderingInputsFixture,
  protocolDocumentFixture } from "../../../projection/fixtures/document-rendering.fixture.ts";
import { createKiroDocumentRenderer } from "./document-renderer.ts";

const bindingHeadings = ["Claude Code", "Kiro CLI", "Kiro IDE", "Codex CLI", "Cursor", "opencode", "GitHub Copilot"];
const renderer = createKiroDocumentRenderer({ ...documentRenderingInputsFixture({ harnessDir: ".kiro" }), bindingHeadings });

test("Kiro splits neutral onboarding from native steering with exact destinations and bytes", () => {
  expect(renderer.renderOnboarding({ templates: ONBOARDING_TEMPLATES_FIXTURE, method: methodSliceFixture }))
    .toEqual({ ok: true, value: [
      { path: path("AGENTS.md"), mode: "regular",
        origin: { kind: "rendered", concept: "onboarding", name: "AGENTS.md" },
        content: { kind: "text", text: "# AI-DLC in this project\n\nYour work is recorded under aidlc/.\n" } },
      { path: path(".kiro/steering/aidlc-onboarding.md"), mode: "regular",
        origin: { kind: "rendered", concept: "onboarding", name: ".kiro/steering/aidlc-onboarding.md" },
        content: { kind: "text", text: "# AI-DLC for this host\n\nStart a piece of work with /aidlc.\n" +
          "The install lives in .kiro; run bun .kiro/tools/aidlc.ts doctor to check it.\n" } },
    ] });
});

test("protocol placement owns Kiro CLI bindings and renames the rules directory", () => {
  const document = protocolDocumentFixture();
  expect(renderer.placeNeutralDocument({ document })).toEqual({ ok: true, value: [{
    path: path(".kiro/aidlc-common/protocols/stage-protocol.md"), mode: "regular",
    origin: { kind: "neutral", source: document.source }, content: { kind: "text", text:
      "# Stage protocol\n\nRead the standing rules in .kiro/steering/ before a stage starts.\n\n" +
      "## Harness bindings\n\n#### Kiro CLI\n\nKiro CLI runs the stage in the agent.\n\n" },
  }] });
});

test("a malformed protocol refuses with its actual source and missing headings", () => {
  expect(renderer.placeNeutralDocument({ document: { source: source("aidlc-common/protocols/bad.md"),
    role: "protocol", content: { kind: "text", text: "### Kiro CLI\nOnly\n" } } })).toEqual({ ok: false,
    refusal: { kind: "render-failed", concept: "neutral-document", name: "aidlc-common/protocols/bad.md",
      reason: "harness bindings: aidlc-common/protocols/bad.md line 1: a binding run must name each tool once " +
        "(found Kiro CLI; missing Claude Code, Kiro IDE, Codex CLI, Cursor, opencode, GitHub Copilot)." } });
});

test("invalid neutral onboarding refuses at the neutral root destination", () => {
  expect(renderer.renderOnboarding({ templates: { ...ONBOARDING_TEMPLATES_FIXTURE, neutral: "{{UNKNOWN}}" },
    method: methodSliceFixture })).toEqual({ ok: false, refusal: { kind: "render-failed", concept: "onboarding",
    name: "AGENTS.md", reason: "neutral onboarding must not contain template markers" } });
});

test("the shared rename preserves default.rules and leaves unrelated hosts alone", () => {
  expect(renderer.placeNeutralDocument({ document: { source: source("knowledge/rules.md"), role: "knowledge",
    content: { kind: "text", text: ".kiro/rules/default.rules .kiro/rules/team.md .claude/rules/team.md" } } }))
    .toEqual({ ok: true, value: [{ path: path(".kiro/knowledge/rules.md"), mode: "regular",
      origin: { kind: "neutral", source: source("knowledge/rules.md") }, content: { kind: "text",
        text: ".kiro/rules/default.rules .kiro/steering/team.md .claude/rules/team.md" } }] });
});

test("final document bytes are bound only once", () => {
  const inputs = documentRenderingInputsFixture({ harnessDir: ".kiro" });
  const native = createKiroDocumentRenderer({ ...inputs, bindingHeadings,
    tokens: { ...inputs.tokens, ["INVOKE"]: "{{HARNESS_DIR}}" } });
  expect(native.placeNeutralDocument({ document: { source: source("knowledge/one.md"), role: "knowledge",
    content: { kind: "text", text: "Run {{INVOKE}}" } } })).toEqual({ ok: true, value: [{
    path: path(".kiro/knowledge/one.md"), mode: "regular",
    origin: { kind: "neutral", source: source("knowledge/one.md") }, content: { kind: "text", text: "Run {{HARNESS_DIR}}" },
  }] });
});
