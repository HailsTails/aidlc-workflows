import { expect, test } from "bun:test";
import { z } from "zod";
import { accepted, refused } from "../../kernel/result.ts";
import { methodSource } from "../fixtures/method-source.fixture.ts";
import { authoredValue, decodeMarkdown, translated } from "./authored-markdown.ts";

const source = {
  owner: { kind: "core" } as const,
  path: methodSource({ kind: "stage", within: "inception/example.md" }),
};

const decode = (raw: string) => decodeMarkdown({
  source, raw, schema: z.strictObject({ title: z.string() }), strings: ["title"],
});

test("frontmatter strings preserve colons and body text", () => {
  expect(decode("---\ntitle: A title: with a colon\n---\n\n# Body\n"))
    .toEqual(accepted({ file: { title: "A title: with a colon" }, body: "\n# Body\n" }));
});

test("missing frontmatter is a located refusal", () => {
  expect(decode("# Body\n")).toEqual(refused([{
    kind: "invalid-file", location: { kind: "method-source", ...source },
    issues: ["Missing YAML frontmatter"],
  }]));
});

test("invalid YAML never reaches domain translation", () => {
  expect(decode("---\ntitle: \"unclosed\n---\n").ok).toBe(false);
});

test("reserved declarations name their future owner", () => {
  const admission = decodeMarkdown({ source, raw: "---\ntimeout: 3\n---\n",
    schema: z.object({}), strings: [], reserved: { timeout: "sensor binding" } });
  expect(admission).toEqual(refused([{
    kind: "reserved-key", location: { kind: "method-source", ...source },
    key: "timeout", reservedFor: "sensor binding",
  }]));
});

test("translation failures retain source identity", () => {
  expect(translated(source, () => JSON.parse("invalid")))
    .toMatchObject({ ok: false, refusal: [{ kind: "invalid-file",
      location: { kind: "method-source", ...source } }] });
});

test("authoredValue unwraps only accepted values", () => {
  expect(authoredValue(accepted("feature"))).toBe("feature");
  expect(() => authoredValue(refused("invalid"))).toThrow("Invalid authored value");
});


