import { ConfigCommentParser } from "@eslint/plugin-kit";

export type InlineConfigComment =
  | { readonly kind: "disable"; readonly ruleIds: readonly string[] }
  | { readonly kind: "rule-config"; readonly ruleIds: readonly string[] }
  | { readonly kind: "unparseable-rule-config" }
  | { readonly kind: "not-an-exception" };

const DISABLE_LABELS: readonly string[] = [
  "eslint-disable",
  "eslint-disable-line",
  "eslint-disable-next-line",
];

const RULE_CONFIG_LABEL = "eslint";

const commentParser = new ConfigCommentParser();

export const parseInlineConfigComment = (request: {
  readonly text: string;
}): InlineConfigComment => {
  const directive = commentParser.parseDirective(request.text);
  if (directive === undefined) {
    return { kind: "not-an-exception" };
  }
  if (DISABLE_LABELS.includes(directive.label)) {
    return { kind: "disable", ruleIds: Object.keys(commentParser.parseListConfig(directive.value)) };
  }
  if (directive.label !== RULE_CONFIG_LABEL) {
    return { kind: "not-an-exception" };
  }
  const ruleConfig = commentParser.parseJSONLikeConfig(directive.value);
  return ruleConfig.ok
    ? { kind: "rule-config", ruleIds: Object.keys(ruleConfig.config) }
    : { kind: "unparseable-rule-config" };
};
