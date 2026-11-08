import { brand } from "../../kernel/brand.ts";
import type { AuthoredBody, OutlineHeading, TextOffset } from "../domain/outline.ts";

export type FixtureSection = {
  readonly level: OutlineHeading["level"];
  readonly title: string;
  readonly prose: string;
};

type Building = { readonly text: string; readonly headings: readonly OutlineHeading[] };

const offset = (raw: number): TextOffset => brand<TextOffset>(raw);

const appendSection = ({
  built,
  section,
}: {
  readonly built: Building;
  readonly section: FixtureSection;
}): Building => {
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
  sections.reduce<Building>((built, section) => appendSection({ built, section }), {
    text: "",
    headings: [],
  });
