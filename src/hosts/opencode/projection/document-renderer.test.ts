import { expect, test } from "bun:test";
import { path, source } from "../../../kernel/fixtures/values.fixture.ts";
import { methodSliceFixture } from "../../../workflow-definition/fixtures/method.fixture.ts";
import { ONBOARDING_TEMPLATES_FIXTURE, documentRenderingInputsFixture,
  protocolDocumentFixture } from "../../../projection/fixtures/document-rendering.fixture.ts";
import { createOpenCodeDocumentRenderer } from "./document-renderer.ts";

const inputs = documentRenderingInputsFixture({ harnessDir: ".aidlc" });
const renderer = createOpenCodeDocumentRenderer(inputs);

test("OpenCode splits neutral onboarding at the root from native onboarding in .aidlc", () => {
  expect(renderer.renderOnboarding({ templates: ONBOARDING_TEMPLATES_FIXTURE, method: methodSliceFixture }))
    .toEqual({ ok: true, value: [
      { path: path("AGENTS.md"), mode: "regular",
        origin: { kind: "rendered", concept: "onboarding", name: "AGENTS.md" },
        content: { kind: "text", text: "# AI-DLC in this project\n\nYour work is recorded under aidlc/.\n" } },
      { path: path(".aidlc/onboarding.md"), mode: "regular",
        origin: { kind: "rendered", concept: "onboarding", name: ".aidlc/onboarding.md" },
        content: { kind: "text", text: "# AI-DLC for this host\n\nStart a piece of work with /aidlc.\n" +
          "The install lives in .aidlc; run bun .aidlc/tools/aidlc.ts doctor to check it.\n" } },
    ] });
});

test("onboarding keeps its option letters unbound while copied documents bind them", () => {
  const letters = createOpenCodeDocumentRenderer({ ...inputs, tokens: { ...inputs.tokens, ["OPTION_LETTERS"]: "A-E" } });
  const templates = { ...ONBOARDING_TEMPLATES_FIXTURE, harnessSkeleton: "{{SLOT:title_block}}\nOptions {{OPTION_LETTERS}}\n" };
  const onboarding = letters.renderOnboarding({ templates, method: methodSliceFixture });
  expect(onboarding.ok && onboarding.value[1]?.content).toEqual({ kind: "text",
    text: "# AI-DLC for this host\nOptions {{OPTION_LETTERS}}\n" });
  expect(letters.placeNeutralDocument({ document: { source: source("knowledge/letters.md"), role: "knowledge",
    content: { kind: "text", text: "Pick {{OPTION_LETTERS}}" } } })).toEqual({ ok: true, value: [{
    path: path(".aidlc/knowledge/letters.md"), mode: "regular",
    origin: { kind: "neutral", source: source("knowledge/letters.md") },
    content: { kind: "text", text: "Pick A-E" } }] });
});

test("protocol placement keeps only the opencode binding and never renames a rules directory", () => {
  const document = protocolDocumentFixture();
  expect(renderer.placeNeutralDocument({ document })).toEqual({ ok: true, value: [{
    path: path(".aidlc/aidlc-common/protocols/stage-protocol.md"), mode: "regular",
    origin: { kind: "neutral", source: document.source }, content: { kind: "text", text:
      "# Stage protocol\n\nRead the standing rules in .aidlc/rules/ before a stage starts.\n\n" +
      "## Harness bindings\n\n#### opencode\n\nopencode runs the stage in the session.\n\n" },
  }] });
});

test("a malformed protocol refuses with its actual source and missing headings", () => {
  expect(renderer.placeNeutralDocument({ document: { source: source("aidlc-common/protocols/bad.md"),
    role: "protocol", content: { kind: "text", text: "### opencode\nOnly\n" } } })).toEqual({ ok: false,
    refusal: { kind: "render-failed", concept: "neutral-document", name: "aidlc-common/protocols/bad.md",
      reason: "harness bindings: aidlc-common/protocols/bad.md line 1: a binding run must name each tool once " +
        "(found opencode; missing Claude Code, Kiro CLI, Kiro IDE, Codex CLI, Cursor, GitHub Copilot)." } });
});

test("invalid neutral onboarding refuses at the neutral root destination", () => {
  expect(renderer.renderOnboarding({ templates: { ...ONBOARDING_TEMPLATES_FIXTURE, neutral: "{{UNKNOWN}}" },
    method: methodSliceFixture })).toEqual({ ok: false, refusal: { kind: "render-failed", concept: "onboarding",
    name: "AGENTS.md", reason: "neutral onboarding must not contain template markers" } });
});
