import { expect, mock, test } from "bun:test";
import { accept } from "../../kernel/fixtures/accept.ts";
import { accepted, refused } from "../../kernel/result.ts";
import type { FrontmatterParser } from "../application/ports.ts";
import { methodSource } from "../fixtures/method-source.fixture.ts";
import { authoredValue, decodeMarkdown, translated } from "./authored-markdown.ts";

const source = { owner: { kind: "core" } as const,
  path: methodSource({ kind: "stage", within: "inception/example.md" }) };
const schema = { safeParse: () => ({ success: true as const,
  data: { title: "A title: with a colon" } }) };

test("frontmatter strings preserve colons and pass only protected YAML to the parser", () => {
  const parse = mock<FrontmatterParser["parse"]>(() => accepted({ title: "A title: with a colon" }));
  expect(decodeMarkdown({ source,
    raw: "---\ntitle: A title: with a colon\n---\n\n# Body\n",
    schema, strings: ["title"], parser: { parse } }))
    .toEqual(accepted({ file: { title: "A title: with a colon" }, body: "\n# Body\n" }));
  expect(parse).toHaveBeenCalledWith({ text: 'title: "A title: with a colon"' });
});

test("missing frontmatter refuses without calling the parser", () => {
  const parse = mock<FrontmatterParser["parse"]>(() => accepted({}));
  expect(decodeMarkdown({ source, raw: "# Body\n", schema, strings: [], parser: { parse } }))
    .toEqual(refused([{ kind: "invalid-file",
      location: { kind: "method-source", ...source }, issues: ["Missing YAML frontmatter"] }]));
  expect(parse).not.toHaveBeenCalled();
});

test("a parser refusal retains the actual source and never reaches the schema", () => {
  const safeParse = mock(schema.safeParse);
  expect(decodeMarkdown({ source, raw: "---\ntitle: invalid\n---\n", schema: { safeParse },
    strings: [], parser: { parse: () => refused({ kind: "invalid-yaml", reason: "Invalid quoted title." }) } }))
    .toEqual(refused([{ kind: "invalid-file",
      location: { kind: "method-source", ...source }, issues: ["Invalid quoted title."] }]));
  expect(safeParse).not.toHaveBeenCalled();
});

test("reserved declarations name their future owner", () => {
  expect(decodeMarkdown({ source, raw: "---\ntimeout: 3\n---\n", schema, strings: [],
    parser: { parse: () => accepted({ timeout: 3 }) }, reserved: { timeout: "sensor binding" } }))
    .toEqual(refused([{ kind: "reserved-key", location: { kind: "method-source", ...source },
      key: "timeout", reservedFor: "sensor binding" }]));
});

test("translation failures retain source identity", () => {
  const translate = mock<() => string>()
    .mockImplementationOnce(() => accept<string, string>(refused("translation failed")));
  expect(translated(source, translate)).toEqual(refused([{ kind: "invalid-file",
    location: { kind: "method-source", ...source },
    issues: ['Fixture value refused: "translation failed"'] }]));
});

test("authoredValue unwraps only accepted values", () => {
  expect(authoredValue(accepted("feature"))).toBe("feature");
  expect(() => authoredValue(refused("invalid"))).toThrow("Invalid authored value");
});
