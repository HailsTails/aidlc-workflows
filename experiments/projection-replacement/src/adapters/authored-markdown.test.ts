import { expect, mock, test } from "bun:test";
import { createAuthoredMarkdownReader } from "./authored-markdown.ts";

test("framing normalizes line endings, canonicalizes only the header and decodes once", () => {
  const canonical = mock().mockReturnValue("name: example");
  const decode = mock().mockReturnValue({ status: "ok", value: { name: "example" } });
  expect(createAuthoredMarkdownReader({ yaml: { decode }, rules: { canonical } }).read({ text: "---\r\n name: example\r\n---\r\n\r\nBody\r\n---\r\n" })).toEqual({ status: "ok", value: { header: "name: example", body: "\nBody\n---\n", decoded: { name: "example" } } });
  expect(canonical).toHaveBeenCalledWith({ text: " name: example" });
  expect(decode).toHaveBeenCalledWith({ text: "name: example" });
  expect(decode).toHaveBeenCalledTimes(1);
});
test.each(["# no header", "---\nname: example\nbody", "---\nname: example\n---"])("invalid framing refuses before normalization or decoding: %s", (text) => {
  const canonical = mock();
  const decode = mock();
  expect(createAuthoredMarkdownReader({ yaml: { decode }, rules: { canonical } }).read({ text })).toEqual({ status: "invalid", findings: [{ code: "invalid-input", subject: "frontmatter", detail: "expected closed YAML frontmatter and a body" }] });
  expect(canonical).not.toHaveBeenCalled();
  expect(decode).not.toHaveBeenCalled();
});
test("decoder failures remain plain findings", () => {
  const canonical = mock().mockReturnValue("invalid");
  const refusal = { status: "invalid", findings: [{ code: "invalid-input", subject: "frontmatter", detail: "duplicate key" }] } as const;
  const decode = mock().mockReturnValue(refusal);
  expect(createAuthoredMarkdownReader({ yaml: { decode }, rules: { canonical } }).read({ text: "---\nname: example\n---\nBody" })).toEqual(refusal);
});
