import { describe, expect, test } from "vitest";
import {
  closedTokenOf,
  headingOf,
  markdownLinesOf,
  proseOf,
  sectionsAtLevel,
  statedTokenOf,
} from "./rin-gates-markdown-lines.ts";

const CLOSED_TOKENS = ["holds", "fails"] as const;

describe("closedTokenOf", () => {
  test.each([
    ["holds", "holds"],
    ["  **fails**  ", "fails"],
    ["`holds`.", "holds"],
  ] as const)("reads %j as %s", (text, token) => {
    expect(closedTokenOf({ text, tokens: CLOSED_TOKENS })).toBe(token);
  });

  test.each([
    "holds (assumed)",
    "holds — 250ms",
    "Holds",
    "hold",
    "",
  ])("reads the near-miss %j as no token", (text) => {
    expect(closedTokenOf({ text, tokens: CLOSED_TOKENS })).toBeUndefined();
  });
});

describe("statedTokenOf", () => {
  test.each([
    ["B", "B"],
    ["B.", "B"],
    ["**B**.", "B"],
    [" `storage` ", "storage"],
    ["in-force.", "in-force"],
  ] as const)("reads %j as %s", (text, token) => {
    expect(statedTokenOf({ text })).toBe(token);
  });
});

describe("headingOf", () => {
  test("reads a prose heading's level and title", () => {
    expect(
      headingOf({
        markdownLine: {
          lineNumber: 1,
          text: "#### Retry policy",
          region: { kind: "prose" },
        },
      }),
    ).toEqual({ level: 4, title: "Retry policy" });
  });

  test("reads no heading from a fenced line", () => {
    expect(
      headingOf({
        markdownLine: {
          lineNumber: 1,
          text: "# comment",
          region: { kind: "fence-body", language: "sh", openingLineNumber: 0 },
        },
      }),
    ).toBeUndefined();
  });

  test("reads no heading from plain prose", () => {
    expect(
      headingOf({
        markdownLine: {
          lineNumber: 2,
          text: "plain",
          region: { kind: "prose" },
        },
      }),
    ).toBeUndefined();
  });
});

describe("markdownLinesOf fence tags", () => {
  test("reads a tag carrying metadata by its language alone", () => {
    expect(
      markdownLinesOf({ markdownText: "```ts:src/a.ts\n```\n```mts,title=b" }),
    ).toEqual([
      {
        lineNumber: 1,
        text: "```ts:src/a.ts",
        region: { kind: "fence-open", language: "ts" },
      },
      { lineNumber: 2, text: "```", region: { kind: "fence-close" } },
      {
        lineNumber: 3,
        text: "```mts,title=b",
        region: { kind: "fence-open", language: "mts" },
      },
    ]);
  });
});

const MARKDOWN_WITH_FRONTMATTER = `---
title: x
---
# Heading
\`\`\`ts
const a = 1;
\`\`\`
after`;

const UNCLOSED_FRONTMATTER_MARKDOWN = `---
title: x`;

const LONGER_FENCE_MARKDOWN = `\`\`\`\`text
\`\`\`
inside
\`\`\`\`
prose`;

const TILDE_FENCE_MARKDOWN = `~~~{.Python}
x
~~~`;

const MIXED_MARKER_FENCE_MARKDOWN = `~~~ts
\`\`\`
x
~~~`;

const SECTIONED_MARKDOWN = `# Top
## Alpha
alpha body
### Inner
inner body
## Beta
beta body
\`\`\`text
## not a heading
\`\`\`
# Next top
`;

describe("markdownLinesOf", () => {
  test("classifies frontmatter, prose and fence lines", () => {
    expect(
      markdownLinesOf({ markdownText: MARKDOWN_WITH_FRONTMATTER }),
    ).toEqual([
      { lineNumber: 1, text: "---", region: { kind: "frontmatter" } },
      { lineNumber: 2, text: "title: x", region: { kind: "frontmatter" } },
      { lineNumber: 3, text: "---", region: { kind: "frontmatter" } },
      { lineNumber: 4, text: "# Heading", region: { kind: "prose" } },
      {
        lineNumber: 5,
        text: "```ts",
        region: { kind: "fence-open", language: "ts" },
      },
      {
        lineNumber: 6,
        text: "const a = 1;",
        region: { kind: "fence-body", language: "ts", openingLineNumber: 5 },
      },
      { lineNumber: 7, text: "```", region: { kind: "fence-close" } },
      { lineNumber: 8, text: "after", region: { kind: "prose" } },
    ]);
  });

  test("reads an unclosed frontmatter block as prose", () => {
    expect(
      markdownLinesOf({ markdownText: UNCLOSED_FRONTMATTER_MARKDOWN }),
    ).toEqual([
      { lineNumber: 1, text: "---", region: { kind: "prose" } },
      { lineNumber: 2, text: "title: x", region: { kind: "prose" } },
    ]);
  });

  test("closes a fence only on a marker at least as long as its opener", () => {
    expect(markdownLinesOf({ markdownText: LONGER_FENCE_MARKDOWN })).toEqual([
      {
        lineNumber: 1,
        text: "````text",
        region: { kind: "fence-open", language: "text" },
      },
      {
        lineNumber: 2,
        text: "```",
        region: { kind: "fence-body", language: "text", openingLineNumber: 1 },
      },
      {
        lineNumber: 3,
        text: "inside",
        region: { kind: "fence-body", language: "text", openingLineNumber: 1 },
      },
      { lineNumber: 4, text: "````", region: { kind: "fence-close" } },
      { lineNumber: 5, text: "prose", region: { kind: "prose" } },
    ]);
  });

  test("normalises a braced tilde info string to a lower-case language and closes the fence on a tilde marker", () => {
    expect(markdownLinesOf({ markdownText: TILDE_FENCE_MARKDOWN })).toEqual([
      {
        lineNumber: 1,
        text: "~~~{.Python}",
        region: { kind: "fence-open", language: "python" },
      },
      {
        lineNumber: 2,
        text: "x",
        region: {
          kind: "fence-body",
          language: "python",
          openingLineNumber: 1,
        },
      },
      { lineNumber: 3, text: "~~~", region: { kind: "fence-close" } },
    ]);
  });

  test("closes a fence only on a marker of the same character as its opener", () => {
    expect(
      markdownLinesOf({ markdownText: MIXED_MARKER_FENCE_MARKDOWN }),
    ).toEqual([
      {
        lineNumber: 1,
        text: "~~~ts",
        region: { kind: "fence-open", language: "ts" },
      },
      {
        lineNumber: 2,
        text: "```",
        region: { kind: "fence-body", language: "ts", openingLineNumber: 1 },
      },
      {
        lineNumber: 3,
        text: "x",
        region: { kind: "fence-body", language: "ts", openingLineNumber: 1 },
      },
      { lineNumber: 4, text: "~~~", region: { kind: "fence-close" } },
    ]);
  });
});

describe("sectionsAtLevel", () => {
  test("ends a section at the next heading of the same or higher level", () => {
    const sections = sectionsAtLevel({
      lines: markdownLinesOf({ markdownText: SECTIONED_MARKDOWN }),
      level: 2,
    });
    expect(sections).toEqual([
      {
        title: "Alpha",
        headingLineNumber: 2,
        sectionLines: [
          { lineNumber: 3, text: "alpha body", region: { kind: "prose" } },
          { lineNumber: 4, text: "### Inner", region: { kind: "prose" } },
          { lineNumber: 5, text: "inner body", region: { kind: "prose" } },
        ],
      },
      {
        title: "Beta",
        headingLineNumber: 6,
        sectionLines: [
          { lineNumber: 7, text: "beta body", region: { kind: "prose" } },
          {
            lineNumber: 8,
            text: "```text",
            region: { kind: "fence-open", language: "text" },
          },
          {
            lineNumber: 9,
            text: "## not a heading",
            region: {
              kind: "fence-body",
              language: "text",
              openingLineNumber: 8,
            },
          },
          { lineNumber: 10, text: "```", region: { kind: "fence-close" } },
        ],
      },
    ]);
  });
});

describe("proseOf", () => {
  test("keeps only prose lines", () => {
    expect(
      proseOf({
        lines: markdownLinesOf({ markdownText: MARKDOWN_WITH_FRONTMATTER }),
      }),
    ).toEqual([
      { lineNumber: 4, text: "# Heading", region: { kind: "prose" } },
      { lineNumber: 8, text: "after", region: { kind: "prose" } },
    ]);
  });
});
