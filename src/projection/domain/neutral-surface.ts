import type { FileContent } from "../../kernel/file-content.ts";
import type { SourcePath } from "../../kernel/values.ts";

export const NEUTRAL_DOCUMENT_ROLES = ["protocol", "template"] as const;

export type NeutralDocumentRole = (typeof NEUTRAL_DOCUMENT_ROLES)[number];

export type NeutralDocument = {
  readonly source: SourcePath;
  readonly role: NeutralDocumentRole;
  readonly content: FileContent;
};

export type SessionSkill = {
  readonly name: string;
  readonly files: readonly { readonly source: SourcePath; readonly content: FileContent }[];
};

export type OnboardingTemplates = {
  readonly neutral: string;
  readonly harnessSkeleton: string;
};

export type NeutralSurface = {
  readonly documents: readonly NeutralDocument[];
  readonly skills: readonly SessionSkill[];
  readonly onboarding: OnboardingTemplates;
};
