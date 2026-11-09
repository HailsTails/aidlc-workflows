import type { FileContent } from "../../kernel/file-content.ts";
import type { Result } from "../../kernel/result.ts";
import type { SourcePath } from "../../kernel/values.ts";

export const NEUTRAL_DOCUMENT_ROLES = ["protocol", "template", "conductor", "stage", "knowledge"] as const;

export type NeutralDocumentRole = (typeof NEUTRAL_DOCUMENT_ROLES)[number];

export type NeutralDocument = {
  readonly source: SourcePath;
  readonly role: NeutralDocumentRole;
  readonly content: FileContent;
};

export const SESSION_SKILL_NAMES = [
  "aidlc-session-cost",
  "aidlc-replay",
  "aidlc-outcomes-pack",
  "aidlc-knowledge",
  "aidlc-issue-report",
] as const;

export type SessionSkill = {
  readonly name: string;
  readonly files: readonly { readonly source: SourcePath; readonly content: FileContent }[];
};

export type SkillTableVerb = "stage-table" | "scope-table";

export type SkillTableRenderer = (verb: SkillTableVerb) => Result<string, string>;

export type OnboardingTemplates = {
  readonly neutral: string;
  readonly harnessSkeleton: string;
};

export type OnboardingFills = {
  readonly invoke: string;
  readonly slots: Readonly<Record<string, string>>;
};

export type NeutralSurface = {
  readonly documents: readonly NeutralDocument[];
  readonly skills: readonly SessionSkill[];
  readonly onboarding: OnboardingTemplates;
};

export const RUNTIME_FOLDERS = ["tools", "hooks", "sensors", "scopes"] as const;

export type RuntimeFile = {
  readonly source: SourcePath;
  readonly content: FileContent;
};

export type SharedRuntime = {
  readonly files: readonly RuntimeFile[];
  readonly version: FileContent;
  readonly agentTiers: FileContent;
  readonly settingsSchema: FileContent;
};
