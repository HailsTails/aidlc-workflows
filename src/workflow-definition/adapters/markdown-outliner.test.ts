import { expect, test } from "bun:test";
import { createMarkdownOutliner } from "./markdown-outliner.ts";

const headings = createMarkdownOutliner(() => ({ lines: [
  { kind: "heading", block: 0, containers: [] },
  { kind: "blank", block: -1, containers: [] },
  { kind: "heading", block: 1, containers: [] },
  { kind: "paragraph", block: 2, containers: [] },
] }));
const fencedAndQuoted = createMarkdownOutliner(() => ({ lines: [
  { kind: "codeFenced", block: 0, containers: [] },
  { kind: "codeFenced", block: 0, containers: [] },
  { kind: "codeFenced", block: 0, containers: [] },
  { kind: "blank", block: -1, containers: [] },
  { kind: "heading", block: 1, containers: [{ kind: "blockQuote" }] },
] }));

test("block facts become authored headings with original text offsets", () => {
  expect(headings.outline("# Steps\n\n## First\nText\n")).toMatchObject({
    text: "# Steps\n\n## First\nText\n", headings: [
      { level: 1, title: "Steps", start: 0, contentStart: 8 },
      { level: 2, title: "First", start: 9, contentStart: 18 },
    ],
  });
});

test("fenced and quoted headings do not become overlay anchors", () => {
  expect(fencedAndQuoted.outline("```md\n# Hidden\n```\n\n> # Quoted\n")).toMatchObject({
    headings: [],
  });
});
