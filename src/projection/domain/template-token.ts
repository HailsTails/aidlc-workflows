export const TEMPLATE_TOKENS = [
  "HARNESS_DIR",
  "INVOKE",
  "SKILL_INVOKE",
  "OPTION_LETTERS",
  "TRUSTED_NAMESPACE",
  "TOOL_PREFIX",
] as const;

export type TemplateToken = (typeof TEMPLATE_TOKENS)[number];

export type TokenBindings = Readonly<Record<TemplateToken, string | null>>;

export type HostBoundToken = Exclude<TemplateToken, "HARNESS_DIR">;

export type HostTokenBindings = Readonly<Record<HostBoundToken, string | null>>;

export type HostTokenChoices = Pick<HostTokenBindings, "SKILL_INVOKE" | "OPTION_LETTERS">;

export type ChannelTokens = Pick<HostTokenBindings, "INVOKE" | "TOOL_PREFIX" | "TRUSTED_NAMESPACE">;
