import type { RelativePath } from "../../kernel/values.ts";
import type { FileContent } from "./projected-file.ts";

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

export const NEUTRAL_DOCUMENT_ROLES = [
  "protocol",
  "stage",
  "scope",
  "agent",
  "rule",
  "sensor",
  "knowledge",
  "template",
  "session-skill",
] as const;

export type NeutralDocumentRole = (typeof NEUTRAL_DOCUMENT_ROLES)[number];

export type NeutralDocument = {
  readonly source: RelativePath;
  readonly role: NeutralDocumentRole;
  readonly content: FileContent;
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
  readonly documents: readonly NeutralDocument[];
  readonly skills: readonly SessionSkill[];
  readonly hooks: readonly HookEntry[];
  readonly onboarding: OnboardingTemplates;
};
