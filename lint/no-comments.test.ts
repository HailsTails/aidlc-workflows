import { describe, expect, test } from "bun:test";
import { Linter } from "./eslint-port.ts";
import { noComments } from "./no-comments.ts";

const NO_COMMENTS: Linter.Config[] = [
  {
    plugins: { aidlc: { rules: { "no-comments": noComments } } },
    rules: { "aidlc/no-comments": "error" },
  },
];

describe("no-comments", () => {
  test("reports an explaining comment", () => {
    const messages = new Linter({ configType: "flat" }).verify(
      "// the answer\nexport const answer = 42;\n",
      NO_COMMENTS,
    );

    expect(messages).toEqual([expect.objectContaining({ ruleId: "aidlc/no-comments", line: 1 })]);
  });

  test("allows a TODO that points at an issue", () => {
    const messages = new Linter({ configType: "flat" }).verify(
      "// TODO(#12)\nexport const answer = 42;\n",
      NO_COMMENTS,
    );

    expect(messages).toEqual([]);
  });
});
