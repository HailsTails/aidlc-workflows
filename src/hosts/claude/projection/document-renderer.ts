import type { FileContent } from "../../../kernel/file-content.ts";
import { accepted, refused } from "../../../kernel/result.ts";
import { projectPath } from "../../../kernel/values.ts";
import type { HostDocumentRenderer } from "../../../projection/application/ports/documents.ts";
import type { Rendering } from "../../../projection/application/ports/harness.ts";
import { keepOwnHarnessBindings } from "../../../projection/domain/harness-bindings.ts";
import type { NeutralDocument } from "../../../projection/domain/neutral-surface.ts";
import { renderNeutralOnboarding, renderOnboarding } from "../../../projection/domain/onboarding.ts";
import { bindTemplateTokens } from "../../../projection/domain/token-binding.ts";
import type { TokenBindings } from "../../../projection/domain/template-token.ts";

import { CLAUDE_BINDING_HEADING } from "../host-data.ts";

const decode = (content: FileContent): string => content.kind === "text" ? content.text
  : new TextDecoder("utf-8", { ignoreBOM: true }).decode(content.bytes);
const bind = (text: string, tokens: TokenBindings): string => bindTemplateTokens({ text, tokens,
  selected: ["HARNESS_DIR", "INVOKE", "TOOL_PREFIX", "TRUSTED_NAMESPACE", "OPTION_LETTERS"] });
const onboardingFailure = (reason: string): Rendering => refused({ kind: "render-failed",
  concept: "onboarding", name: ".claude/CLAUDE.md", reason });

const placeDocument = (document: NeutralDocument, inputs: {
  readonly tokens: TokenBindings; readonly bindingHeadings: readonly string[];
}): Rendering => {
  const { tokens, bindingHeadings } = inputs;
  const path = projectPath(`.claude/${document.source}`);
  if (!path.ok) return refused({ kind: "render-failed", concept: "neutral-document",
    name: document.source, reason: "The document destination must be project-relative." });
  const bound = bind(decode(document.content), tokens);
  const content = document.role === "protocol" ? keepOwnHarnessBindings({ content: bound, ownHeading: CLAUDE_BINDING_HEADING,
    expectedHeadings: bindingHeadings, file: document.source })
    : accepted(bound);
  return content.ok ? accepted([{ path: path.value, content: { kind: "text", text: content.value },
    mode: "regular", origin: { kind: "neutral", source: document.source } }])
    : refused({ kind: "render-failed", concept: "neutral-document", name: document.source, reason: content.refusal });
};

export const createClaudeDocumentRenderer: HostDocumentRenderer = (inputs) => ({
  renderOnboarding: ({ templates }): Rendering => {
    const neutral = renderNeutralOnboarding(templates.neutral);
    if (!neutral.ok) return onboardingFailure(neutral.refusal);
    const rendered = renderOnboarding(
      `${templates.harnessSkeleton}\n## Shared AI-DLC onboarding\n\n${neutral.value}`, inputs.fills);
    if (!rendered.ok) return onboardingFailure(rendered.refusal);
    const path = projectPath(".claude/CLAUDE.md");
    return path.ok ? accepted([{ path: path.value, mode: "regular",
      content: { kind: "text", text: bind(rendered.value, inputs.tokens) },
      origin: { kind: "rendered", concept: "onboarding", name: ".claude/CLAUDE.md" } }])
      : onboardingFailure("The onboarding destination must be project-relative.");
  },
  placeNeutralDocument: ({ document }) => placeDocument(document, inputs),
});
