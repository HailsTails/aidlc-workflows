import type { RelativePath } from "../../kernel/values.ts";

export const HOOK_POINTS = [
  "session-start",
  "session-end",
  "user-prompt",
  "before-tool",
  "after-tool",
  "subagent-stop",
  "stop",
  "status-line",
] as const;

export type HookPoint = (typeof HOOK_POINTS)[number];

export type HookEntry = {
  readonly name: string;
  readonly point: HookPoint;
  readonly toolMatcher: string | null;
};

export type NeutralDocument = {
  readonly source: RelativePath;
  readonly text: string;
};

export type SessionSkill = {
  readonly name: string;
  readonly documents: readonly NeutralDocument[];
};

export type OnboardingTemplates = {
  readonly neutral: string;
  readonly harnessSkeleton: string;
};

export type NeutralSurface = {
  readonly protocols: readonly NeutralDocument[];
  readonly skills: readonly SessionSkill[];
  readonly hooks: readonly HookEntry[];
  readonly onboarding: OnboardingTemplates;
};
