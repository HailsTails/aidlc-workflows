import type { FileContent } from "../../kernel/file-content.ts";
import type { TemplateToken, TokenBindings } from "./template-token.ts";
import { bindTemplateTokens } from "./token-binding.ts";

const invocationTokens: readonly TemplateToken[] = ["INVOKE", "TOOL_PREFIX", "TRUSTED_NAMESPACE"];
const proseTokens: readonly TemplateToken[] = [
  "HARNESS_DIR", "INVOKE", "TOOL_PREFIX", "TRUSTED_NAMESPACE", "OPTION_LETTERS",
];

export const bindCopiedSource = (request: {
  readonly source: string;
  readonly content: FileContent;
  readonly tokens: TokenBindings;
}): FileContent => {
  const selected = request.source.endsWith(".ts") ? invocationTokens
    : /\.(?:md|hook|json|toml)$/.test(request.source) ? proseTokens : [];
  if (selected.length === 0) return request.content;
  const text = request.content.kind === "text" ? request.content.text
    : new TextDecoder("utf-8", { ignoreBOM: true }).decode(request.content.bytes);
  return { kind: "text", text: bindTemplateTokens({ text, tokens: request.tokens, selected }) };
};
