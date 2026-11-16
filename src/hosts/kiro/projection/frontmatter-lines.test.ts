import { describe, expect, test } from "bun:test";
import { withFrontmatterLines } from "./frontmatter-lines.ts";

describe("withFrontmatterLines", () => {
  test("adds the lines just before the frontmatter closes", () => {
    expect(withFrontmatterLines("---\nname: a\n---\nbody\n", ["tools: []", "  - nested"])).toEqual({
      ok: true,
      value: "---\nname: a\ntools: []\n  - nested\n---\nbody\n",
    });
  });

  test("keeps Windows line endings in the file it extends", () => {
    expect(withFrontmatterLines("---\r\nname: a\r\n---\r\nbody\r\n", ["tools: []"])).toEqual({
      ok: true,
      value: "---\r\nname: a\r\ntools: []\n---\r\nbody\r\n",
    });
  });

  test.each([
    { text: "body only\n", lines: ["tools: []"], refusal: { kind: "no-frontmatter" } },
    { text: "---\nname: a\n---\n", lines: ["- not a key"], refusal: { kind: "not-a-key", line: "- not a key" } },
    { text: "---\nname: a\n---\n", lines: ["tools: []", "tools: [x]"], refusal: { kind: "key-added-twice", key: "tools" } },
    { text: "---\nname: a\n---\n", lines: ["name: b"], refusal: { kind: "key-already-present", key: "name" } },
  ] as const)("refuses: $refusal.kind", ({ text, lines, refusal }) => {
    expect(withFrontmatterLines(text, lines)).toEqual({ ok: false, refusal });
  });
});
