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

  test("allows the shebang an executable script starts with", () => {
    const messages = new Linter({ configType: "flat" }).verify(
      "#!/usr/bin/env bun\nexport const answer = 42;\n",
      NO_COMMENTS,
    );

    expect(messages).toEqual([]);
  });

  test("still reports a comment on the line after a shebang", () => {
    const messages = new Linter({ configType: "flat" }).verify(
      "#!/usr/bin/env bun\n// the answer\nexport const answer = 42;\n",
      NO_COMMENTS,
    );

    expect(messages).toEqual([expect.objectContaining({ ruleId: "aidlc/no-comments", line: 2 })]);
  });
});
