import { expect, test } from "bun:test";
import { path, source } from "../../../kernel/fixtures/values.fixture.ts";
import { methodSliceFixture } from "../../../workflow-definition/fixtures/method.fixture.ts";
import { ONBOARDING_TEMPLATES_FIXTURE, documentRenderingInputsFixture,
  protocolDocumentFixture } from "../../../projection/fixtures/document-rendering.fixture.ts";
import { createCursorDocumentRenderer } from "./document-renderer.ts";

const bindingHeadings = ["Claude Code", "Kiro CLI", "Kiro IDE", "Codex CLI", "Cursor", "opencode", "GitHub Copilot"];
const renderer = createCursorDocumentRenderer({ ...documentRenderingInputsFixture({ harnessDir: ".cursor" }), bindingHeadings });

test("Cursor splits neutral onboarding from native rules with exact destinations and bytes", () => {
  expect(renderer.renderOnboarding({ templates: ONBOARDING_TEMPLATES_FIXTURE, method: methodSliceFixture }))
    .toEqual({ ok: true, value: [
      { path: path("AGENTS.md"), mode: "regular",
        origin: { kind: "rendered", concept: "onboarding", name: "AGENTS.md" },
        content: { kind: "text", text: "# AI-DLC in this project\n\nYour work is recorded under aidlc/.\n" } },
      { path: path(".cursor/rules/aidlc-onboarding.mdc"), mode: "regular",
        origin: { kind: "rendered", concept: "onboarding", name: ".cursor/rules/aidlc-onboarding.mdc" },
        content: { kind: "text", text: "# AI-DLC for this host\n\nStart a piece of work with /aidlc.\n" +
          "The install lives in .cursor; run bun .cursor/tools/aidlc.ts doctor to check it.\n" } },
    ] });
});

test("protocol placement keeps only Cursor bindings without renaming rules", () => {
  const document = protocolDocumentFixture();
  expect(renderer.placeNeutralDocument({ document })).toEqual({ ok: true, value: [{
    path: path(".cursor/aidlc-common/protocols/stage-protocol.md"), mode: "regular",
    origin: { kind: "neutral", source: document.source }, content: { kind: "text", text:
      "# Stage protocol\n\nRead the standing rules in .cursor/rules/ before a stage starts.\n\n" +
      "## Harness bindings\n\n#### Cursor\n\nCursor runs the stage in the agent chat.\n\n" },
  }] });
});

test("a malformed protocol refuses with its actual source and missing headings", () => {
  expect(renderer.placeNeutralDocument({ document: { source: source("aidlc-common/protocols/bad.md"),
    role: "protocol", content: { kind: "text", text: "### Cursor\nOnly\n" } } })).toEqual({ ok: false,
    refusal: { kind: "render-failed", concept: "neutral-document", name: "aidlc-common/protocols/bad.md",
      reason: "harness bindings: aidlc-common/protocols/bad.md line 1: a binding run must name each tool once " +
        "(found Cursor; missing Claude Code, Kiro CLI, Kiro IDE, Codex CLI, opencode, GitHub Copilot)." } });
});

test("invalid neutral onboarding refuses at the neutral root destination", () => {
  expect(renderer.renderOnboarding({ templates: { ...ONBOARDING_TEMPLATES_FIXTURE, neutral: "{{UNKNOWN}}" },
    method: methodSliceFixture })).toEqual({ ok: false, refusal: { kind: "render-failed", concept: "onboarding",
    name: "AGENTS.md", reason: "neutral onboarding must not contain template markers" } });
});

test("Cursor preserves its rules paths and leaves unrelated hosts alone", () => {
  expect(renderer.placeNeutralDocument({ document: { source: source("knowledge/rules.md"), role: "knowledge",
    content: { kind: "text", text: ".cursor/rules/default.rules .cursor/rules/team.md .claude/rules/team.md" } } }))
    .toEqual({ ok: true, value: [{ path: path(".cursor/knowledge/rules.md"), mode: "regular",
      origin: { kind: "neutral", source: source("knowledge/rules.md") }, content: { kind: "text",
        text: ".cursor/rules/default.rules .cursor/rules/team.md .claude/rules/team.md" } }] });
});

test("final document bytes are bound only once", () => {
  const inputs = documentRenderingInputsFixture({ harnessDir: ".cursor" });
  const native = createCursorDocumentRenderer({ ...inputs, bindingHeadings,
    tokens: { ...inputs.tokens, ["INVOKE"]: "{{HARNESS_DIR}}" } });
  expect(native.placeNeutralDocument({ document: { source: source("knowledge/one.md"), role: "knowledge",
    content: { kind: "text", text: "Run {{INVOKE}}" } } })).toEqual({ ok: true, value: [{
    path: path(".cursor/knowledge/one.md"), mode: "regular",
    origin: { kind: "neutral", source: source("knowledge/one.md") }, content: { kind: "text", text: "Run {{HARNESS_DIR}}" },
  }] });
});
