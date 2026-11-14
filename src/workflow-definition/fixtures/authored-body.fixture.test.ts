import { describe, expect, test } from "bun:test";
import { authoredBody } from "./authored-body.fixture.ts";

type PlainHeading = {
  readonly level: number;
  readonly title: string;
  readonly start: number;
  readonly contentStart: number;
};

type PlainBody = { readonly text: string; readonly headings: readonly PlainHeading[] };

describe("authoredBody", () => {
  test("writes each section as a heading line followed by its prose", () => {
    expect(
      authoredBody([
        { level: 1, title: "Code Generation", prose: "\n" },
        { level: 2, title: "Steps", prose: "\nPlan first.\n" },
      ]),
    ).toEqual<PlainBody>({
      text: "# Code Generation\n\n## Steps\n\nPlan first.\n",
      headings: [
        { level: 1, title: "Code Generation", start: 0, contentStart: 18 },
        { level: 2, title: "Steps", start: 19, contentStart: 28 },
      ],
    });
  });

  test("returns an empty body for no sections", () => {
    expect(authoredBody([])).toEqual<PlainBody>({ text: "", headings: [] });
  });
});
