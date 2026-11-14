import type { TemplateToken, TokenBindings } from "./template-token.ts";

export const bindTemplateTokens = (request: {
  readonly text: string;
  readonly tokens: TokenBindings;
  readonly selected: readonly TemplateToken[];
}): string => request.selected.reduce((current, token) => request.tokens[token] === null ? current
  : current.replaceAll(`{{${token}}}`, request.tokens[token]), request.text);