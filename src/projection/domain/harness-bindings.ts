import { accepted, refused, type Result } from "../../kernel/result.ts";

type Heading = { readonly line: number; readonly level: number; readonly text: string };
type Section = { readonly text: string; readonly from: number; readonly to: number };
type BindingRun = { readonly sections: readonly Section[]; readonly consumed: number };
type BindingText = {
  readonly content: string;
  readonly file: string;
  readonly ownHeading: string | undefined;
  readonly expectedHeadings: readonly string[];
};

const headingsOutsideFences = (lines: readonly string[]): readonly Heading[] => {
  const headings: Heading[] = [];
  let fence: string | null = null;
  lines.forEach((line, index) => {
    const marker = /^\s*(`{3,}|~{3,})/.exec(line)?.[1];
    if (marker) {
      const delimiter = marker.charAt(0);
      if (fence === null) fence = delimiter;
      else if (delimiter === fence) fence = null;
      return;
    }
    if (fence !== null) return;
    const match = /^(#{1,6})\s+(.*?)\s*$/.exec(line);
    const prefix = match?.[1];
    const text = match?.[2];
    if (prefix !== undefined && text !== undefined) headings.push({ line: index, level: prefix.length, text });
  });
  return headings;
};

const sectionsForRun = (request: {
  readonly headings: readonly Heading[]; readonly start: Heading; readonly endLine: number;
  readonly expectedHeadings: readonly string[];
}): BindingRun => {
  const stop = request.headings.findIndex((heading) => heading.level < request.start.level
    || (heading.level === request.start.level && !request.expectedHeadings.includes(heading.text)));
  const run = stop < 0 ? request.headings : request.headings.slice(0, stop);
  const endLine = stop < 0 ? request.endLine : request.headings[stop]?.line ?? request.endLine;
  const siblings = run.filter((heading) => heading.level === request.start.level);
  return { consumed: run.length, sections: siblings.map((heading, index) => ({
    text: heading.text, from: heading.line, to: siblings[index + 1]?.line ?? endLine,
  })) };
};

const validateRun = (request: {
  readonly sections: readonly Section[]; readonly file: string; readonly line: number;
  readonly expectedHeadings: readonly string[];
}): Result<readonly Section[], string> => {
  const names = request.sections.map((section) => section.text);
  const missing = request.expectedHeadings.filter((name) => !names.includes(name));
  return missing.length > 0 || names.length !== request.expectedHeadings.length ? refused(
    `harness bindings: ${request.file} line ${request.line + 1}: a binding run must name each tool once ` +
    `(found ${names.join(", ")}${missing.length > 0 ? `; missing ${missing.join(", ")}` : ""}).`,
  ) : accepted(request.sections);
};

const excludedSections = (request: {
  readonly headings: readonly Heading[]; readonly endLine: number; readonly binding: BindingText;
}): Result<readonly Section[], string> => {
  const index = request.headings.findIndex((heading) => request.binding.expectedHeadings.includes(heading.text));
  const start = request.headings[index];
  if (!start) return accepted([]);
  const run = sectionsForRun({ ...request, headings: request.headings.slice(index), start,
    expectedHeadings: request.binding.expectedHeadings });
  const checked = validateRun({ sections: run.sections, file: request.binding.file, line: start.line,
    expectedHeadings: request.binding.expectedHeadings });
  if (!checked.ok) return checked;
  const remaining = excludedSections({ ...request, headings: request.headings.slice(index + run.consumed) });
  return remaining.ok ? accepted([
    ...checked.value.filter((section) => section.text !== request.binding.ownHeading), ...remaining.value,
  ]) : remaining;
};

export function keepOwnHarnessBindings(binding: BindingText): Result<string, string> {
  if (binding.ownHeading === undefined) return accepted(binding.content);
  const lines = binding.content.split("\n");
  const excluded = excludedSections({ headings: headingsOutsideFences(lines), binding,
    endLine: lines.at(-1) === "" ? lines.length - 1 : lines.length });
  return excluded.ok ? accepted(lines.filter((_, index) =>
    !excluded.value.some((section) => index >= section.from && index < section.to)).join("\n")) : excluded;
}
