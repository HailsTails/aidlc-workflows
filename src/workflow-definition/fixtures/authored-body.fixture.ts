import type { AuthoredBody, OutlineHeading, TextOffset } from "../domain/outline.ts";

export type FixtureSection = {
  readonly level: OutlineHeading["level"];
  readonly title: string;
  readonly prose: string;
};

type Building = { readonly text: string; readonly headings: readonly OutlineHeading[] };

const offset = (raw: number): TextOffset => raw as TextOffset;

const appendSection = (built: Building, section: FixtureSection): Building => {
  const line = `${"#".repeat(section.level)} ${section.title}\n`;
  const start = built.text.length;
  const heading: OutlineHeading = {
    level: section.level,
    title: section.title,
    start: offset(start),
    contentStart: offset(start + line.length),
  };
  return { text: `${built.text}${line}${section.prose}`, headings: [...built.headings, heading] };
};

export const authoredBody = (sections: readonly FixtureSection[]): AuthoredBody =>
  sections.reduce(appendSection, { text: "", headings: [] });
