import type { CheckReport } from "./check-report.ts";

export type SectionName = keyof CheckReport;

export type SectionRole = "failing" | "informational";

const SECTION_ROLES: Readonly<Record<SectionName, SectionRole>> = {
  excluded: "informational",
  findings: "failing",
  exempted: "informational",
  uncovered: "failing",
  stale: "failing",
  forfeited: "failing",
  unrecorded: "failing",
  doublyHeld: "failing",
  invalidRecords: "failing",
  unmeasured: "failing",
  projectionProblems: "failing",
};

const isSectionName = (key: string): key is SectionName => Object.hasOwn(SECTION_ROLES, key);

export const SECTION_NAMES: readonly SectionName[] = Object.keys(SECTION_ROLES).filter(isSectionName);

export const sectionRoleOf = (request: { readonly section: SectionName }): SectionRole =>
  SECTION_ROLES[request.section];

export const sectionsWithRole = (request: { readonly role: SectionRole }): readonly SectionName[] =>
  SECTION_NAMES.filter((section) => sectionRoleOf({ section }) === request.role);
