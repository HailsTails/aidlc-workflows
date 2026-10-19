import { describe, expect, it } from "vitest";
import { parseInlineConfigComment } from "./inline-config-parser.ts";

describe("parseInlineConfigComment", () => {
  it.each([
    { text: " eslint-disable ", parsed: { kind: "disable", ruleIds: [] } },
    {
      text: " eslint-disable discipline/no-class-authoring, no-console -- generated ",
      parsed: { kind: "disable", ruleIds: ["discipline/no-class-authoring", "no-console"] },
    },
    {
      text: " eslint-disable-line discipline/no-class-authoring",
      parsed: { kind: "disable", ruleIds: ["discipline/no-class-authoring"] },
    },
    {
      text: " eslint-disable-next-line discipline/no-class-authoring",
      parsed: { kind: "disable", ruleIds: ["discipline/no-class-authoring"] },
    },
    {
      text: ' eslint discipline/no-class-authoring: "off", no-console: 0 ',
      parsed: { kind: "rule-config", ruleIds: ["discipline/no-class-authoring", "no-console"] },
    },
  ])("parses the comment '$text' as $parsed.kind", ({ text, parsed }) => {
    expect(parseInlineConfigComment({ text })).toEqual(parsed);
  });

  it.each([
    " eslint-enable discipline/no-class-authoring ",
    " eslint-enable ",
    " global foo ",
    " globals foo ",
    " exported foo ",
    " eslint-env node ",
    " not a directive ",
  ])("parses the comment '%s' as not an exception", (text) => {
    expect(parseInlineConfigComment({ text })).toEqual({ kind: "not-an-exception" });
  });

  it("parses an eslint comment whose configuration does not parse as an unparseable rule config", () => {
    expect(
      parseInlineConfigComment({ text: " eslint discipline/no-class-authoring: [ " }),
    ).toEqual({ kind: "unparseable-rule-config" });
  });
});
