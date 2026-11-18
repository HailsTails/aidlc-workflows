import type { FileContent } from "../../../kernel/file-content.ts";
import { accepted, refused, type Result } from "../../../kernel/result.ts";
import { projectPath } from "../../../kernel/values.ts";
import type { HostDocumentRenderer } from "../../../projection/application/ports/documents.ts";
import type { Rendering } from "../../../projection/application/ports/harness.ts";
import { keepOwnHarnessBindings } from "../../../projection/domain/harness-bindings.ts";
import type { NeutralDocument, OnboardingFills, OnboardingTemplates } from "../../../projection/domain/neutral-surface.ts";
import type { ProjectionRefusal } from "../../../projection/domain/projection.ts";
import { serializeRootHistory, type RootSerialization } from "../../../projection/domain/root-history.ts";
import { renderNeutralOnboarding, renderOnboarding } from "../../../projection/domain/onboarding.ts";
import { declareLegacyOnboardingFile } from "../../../projection/domain/legacy-native-source.ts";
import { bindTemplateTokens } from "../../../projection/domain/token-binding.ts";
import type { TokenBindings } from "../../../projection/domain/template-token.ts";

import { COPILOT_BINDING_HEADING } from "../host-data.ts";

const decode = (content: FileContent): string => content.kind === "text" ? content.text
  : new TextDecoder("utf-8", { ignoreBOM: true }).decode(content.bytes);
const bind = (text: string, tokens: TokenBindings): string => bindTemplateTokens({ text, tokens,
  selected: ["HARNESS_DIR", "INVOKE", "TOOL_PREFIX", "TRUSTED_NAMESPACE", "OPTION_LETTERS"] });
const onboardingFailure = (reason: string): Result<RootSerialization, ProjectionRefusal> => refused({ kind: "render-failed",
  concept: "onboarding", name: "AGENTS.md", reason });

const placeDocument = (document: NeutralDocument, inputs: {
  readonly tokens: TokenBindings; readonly bindingHeadings: readonly string[];
}): Rendering => {
  const { tokens, bindingHeadings } = inputs;
  const path = projectPath(`.aidlc/${document.source}`);
  if (!path.ok) return refused({ kind: "render-failed", concept: "neutral-document",
    name: document.source, reason: "The document destination must be project-relative." });
  const bound = bind(decode(document.content), tokens);
  const content = document.role === "protocol" ? keepOwnHarnessBindings({ content: bound, ownHeading: COPILOT_BINDING_HEADING,
    expectedHeadings: bindingHeadings, file: document.source })
    : accepted(bound);
  return content.ok ? accepted([{ path: path.value, content: { kind: "text", text: content.value },
    mode: "regular", origin: { kind: "neutral", source: document.source } }])
    : refused({ kind: "render-failed", concept: "neutral-document", name: document.source, reason: content.refusal });
};

const serializeOnboarding = (inputs: { readonly templates: OnboardingTemplates; readonly fills: OnboardingFills;
  readonly tokens: TokenBindings }): Result<RootSerialization, ProjectionRefusal> => {
    const { templates } = inputs;
    const neutral = renderNeutralOnboarding(templates.neutral);
    if (!neutral.ok) return onboardingFailure(neutral.refusal);
    const rendered = renderOnboarding(
      `${templates.harnessSkeleton}\n## Shared AI-DLC onboarding\n\n${neutral.value}`, inputs.fills);
    if (!rendered.ok) return onboardingFailure(rendered.refusal);
    const path = projectPath("AGENTS.md");
    const body = bind(rendered.value, inputs.tokens)
      .replaceAll(`${inputs.tokens["HARNESS_DIR"]}/skills/`, ".github/skills/");
    return path.ok ? accepted(declareLegacyOnboardingFile({ dialect: templates.nativeDialect,
      fragments: [{ kind: "authored-onboarding", text: body }], file: { path: path.value, mode: "regular",
        content: { kind: "text", text: body },
        origin: { kind: "rendered", concept: "onboarding", name: "AGENTS.md" } } }))
      : onboardingFailure("The onboarding destination must be project-relative.");
};

export const createCopilotDocumentRenderer: HostDocumentRenderer = (inputs) => ({
  renderOnboarding: ({ templates }): Rendering => {
    const current = () => serializeOnboarding({ templates, fills: inputs.fills, tokens: inputs.tokens });
    const rendered = "copyAuthoring" in templates || "copyAuthoring" in inputs.fills
      ? serializeRootHistory({ serialize: view => view === "current" ? current() : serializeOnboarding({
        templates: "copyAuthoring" in templates ? templates.copyAuthoring : templates,
        fills: "copyAuthoring" in inputs.fills ? inputs.fills.copyAuthoring : inputs.fills, tokens: inputs.tokens }),
      mismatch: { kind: "render-failed", concept: "onboarding", name: "AGENTS.md",
        reason: "The compatibility authoring must serialize to the same onboarding destination and mode." } }) : current();
    return rendered.ok ? accepted([rendered.value]) : rendered;
  },
  placeNeutralDocument: ({ document }) => placeDocument(document, inputs),
});
