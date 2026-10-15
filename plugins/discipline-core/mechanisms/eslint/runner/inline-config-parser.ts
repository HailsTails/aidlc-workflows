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

type DirectiveLabelKind = "disable" | "rule-config" | "other";

const directiveLabelKindOf = (request: { readonly label: string }): DirectiveLabelKind => {
  if (DISABLE_LABELS.includes(request.label)) {
    return "disable";
  }
  return request.label === RULE_CONFIG_LABEL ? "rule-config" : "other";
};

const ruleConfigComment = (request: { readonly value: string }): InlineConfigComment => {
  const ruleConfig = commentParser.parseJSONLikeConfig(request.value);
  if (!ruleConfig.ok) {
    return { kind: "unparseable-rule-config" };
  }
  return { kind: "rule-config", ruleIds: Object.keys(ruleConfig.config) };
};

export const parseInlineConfigComment = (request: {
  readonly text: string;
}): InlineConfigComment => {
  const directive = commentParser.parseDirective(request.text);
  if (directive === undefined) {
    return { kind: "not-an-exception" };
  }
  const labelKind = directiveLabelKindOf({ label: directive.label });
  switch (labelKind) {
    case "other":
      return { kind: "not-an-exception" };
    case "disable":
      return { kind: "disable", ruleIds: Object.keys(commentParser.parseListConfig(directive.value)) };
    case "rule-config":
      return ruleConfigComment({ value: directive.value });
  }
};
