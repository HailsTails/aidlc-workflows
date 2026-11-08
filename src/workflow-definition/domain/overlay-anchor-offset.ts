import type { StageAnchor } from "./contribution.ts";
import type { AuthoredBody, OutlineHeading } from "./outline.ts";

const sectionEnd = (request: { readonly body: AuthoredBody; readonly heading: OutlineHeading;
  readonly levels: readonly number[] }): number => request.body.headings.find((candidate) =>
  candidate.start > request.heading.start && request.levels.includes(candidate.level))?.start
  ?? request.body.text.length;

export const stageAnchorOffset = (instructions: AuthoredBody, anchor: StageAnchor): number | null => {
  if (anchor.kind === "in-section" || anchor.kind === "end-of-steps") {
    const title = anchor.kind === "in-section" ? anchor.section : "Steps";
    const section = instructions.headings.find((heading) => heading.level === 2 && heading.title === title);
    return section ? sectionEnd({ body: instructions, heading: section, levels: [2] }) : null;
  }
  const heading = instructions.headings.find((candidate) => {
    if (candidate.level !== 3) return false;
    const step = /^Step (\d+)(?:-(\d+))?\b/.exec(candidate.title);
    return step && anchor.step >= Number(step[1]) && anchor.step <= Number(step[2] ?? step[1]);
  });
  return heading ? anchor.kind === "before-step" ? heading.start
    : sectionEnd({ body: instructions, heading, levels: [2, 3] }) : null;
};
