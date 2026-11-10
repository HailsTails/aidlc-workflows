import type { FileContent } from "../../../kernel/file-content.ts";
import { accepted, refused } from "../../../kernel/result.ts";
import { projectPath } from "../../../kernel/values.ts";
import type { DocumentRenderingInputs, HostDocumentRenderer } from "../../../projection/application/ports/documents.ts";
import type { Rendering } from "../../../projection/application/ports/harness.ts";
import { keepOwnHarnessBindings } from "../../../projection/domain/harness-bindings.ts";
import type { NeutralDocument, OnboardingTemplates } from "../../../projection/domain/neutral-surface.ts";
import { renderNeutralOnboarding, renderOnboarding } from "../../../projection/domain/onboarding.ts";
import { bindTemplateTokens } from "../../../projection/domain/token-binding.ts";
import type { TokenBindings } from "../../../projection/domain/template-token.ts";
import { CURSOR_BINDING_HEADING } from "../host-data.ts";

const decode = (content: FileContent): string => content.kind === "text" ? content.text
  : new TextDecoder("utf-8", { ignoreBOM: true }).decode(content.bytes);
const bind = (text: string, tokens: TokenBindings): string => bindTemplateTokens({ text, tokens,
  selected: ["HARNESS_DIR", "INVOKE", "TOOL_PREFIX", "TRUSTED_NAMESPACE", "OPTION_LETTERS"],
});
const onboardingFailure = (name: string, reason: string): Rendering => refused({
  kind: "render-failed", concept: "onboarding", name, reason,
});

const placeOnboarding = ({ name, text, tokens }: {
  readonly name: string; readonly text: string; readonly tokens: TokenBindings;
}): Rendering => {
  const path = projectPath(name);
  return path.ok ? accepted([{ path: path.value, mode: "regular", availability: "always",
    content: { kind: "text", text: bind(text, tokens) },
    origin: { kind: "rendered", concept: "onboarding", name } }])
    : onboardingFailure(name, "The onboarding destination must be project-relative.");
};

const renderSplitOnboarding = (templates: OnboardingTemplates, inputs: DocumentRenderingInputs): Rendering => {
  const neutral = renderNeutralOnboarding(templates.neutral);
  if (!neutral.ok) return onboardingFailure("AGENTS.md", neutral.refusal);
  const rendered = renderOnboarding(templates.harnessSkeleton, inputs.fills);
  if (!rendered.ok) return onboardingFailure(".cursor/rules/aidlc-onboarding.mdc", rendered.refusal);
  const root = placeOnboarding({ name: "AGENTS.md", text: neutral.value, tokens: inputs.tokens });
  if (!root.ok) return root;
  const native = placeOnboarding({ name: ".cursor/rules/aidlc-onboarding.mdc", text: rendered.value, tokens: inputs.tokens });
  return native.ok ? accepted([...root.value, ...native.value]) : native;
};

const placeDocument = (document: NeutralDocument, inputs: {
  readonly tokens: TokenBindings; readonly bindingHeadings: readonly string[];
}): Rendering => {
  const path = projectPath(`.cursor/${document.source}`);
  if (!path.ok) return refused({ kind: "render-failed", concept: "neutral-document",
    name: document.source, reason: "The document destination must be project-relative." });
  const bound = bind(decode(document.content), inputs.tokens);
  const content = document.role === "protocol" ? keepOwnHarnessBindings({ content: bound,
    ownHeading: CURSOR_BINDING_HEADING, expectedHeadings: inputs.bindingHeadings, file: document.source }) : accepted(bound);
  return content.ok ? accepted([{ path: path.value, content: { kind: "text", text: content.value },
    mode: "regular", availability: "always", origin: { kind: "neutral", source: document.source } }])
    : refused({ kind: "render-failed", concept: "neutral-document", name: document.source, reason: content.refusal });
};

export const createCursorDocumentRenderer: HostDocumentRenderer = (inputs) => ({
  renderOnboarding: ({ templates }) => renderSplitOnboarding(templates, inputs),
  placeNeutralDocument: ({ document }) => placeDocument(document, inputs),
});
