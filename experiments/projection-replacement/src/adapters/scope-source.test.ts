import { expect, test } from "bun:test";
import { parseScopeSource } from "./scope-source.ts";
import { authoredScope, scopeText, scopeOrigin } from "../../__tests__/scope-fixtures.ts";
test("composition: scope projection preserves authored metadata and Markdown without interpreting workflow policy", () => {
  expect(parseScopeSource({ text: scopeText, origin: scopeOrigin })).toEqual({ status: "ok", value: authoredScope });
});
test("composition: duplicate YAML identity keys cannot bypass source-name validation", () => {
  expect(parseScopeSource({ text: "---\nname: bugfix\nname: feature\n---\nBody\n", origin: scopeOrigin })).toEqual({ status: "invalid", findings: [{ code: "invalid-input", subject: "frontmatter", detail: "expected valid YAML with unique mapping keys" }] });
});
test("composition: a legitimate YAML indentation preserves original bytes", () => {
  expect(parseScopeSource({ text: "---\n name: bugfix\n runner: true\n---\nBody\n", origin: scopeOrigin })).toEqual({ status: "ok", value: { origin: scopeOrigin, name: "bugfix", markdown: "---\n name: bugfix\n runner: true\n---\nBody\n" } });
});
test("composition: a source name cannot redirect scope placement", () => {
  expect(parseScopeSource({ text: "---\nname: feature\n---\nBody\n", origin: scopeOrigin })).toEqual({ status: "invalid", findings: [{ code: "invalid-path", subject: "core/scopes/aidlc-bugfix.md", detail: "this core scope source path must match its authored name; plugin scope composition requires its own source contract" }] });
});
test("composition: missing semantic identity is refused without inventing a scope", () => {
  expect(parseScopeSource({ text: "---\nrunner: true\n---\nBody\n", origin: scopeOrigin })).toEqual({ status: "invalid", findings: [{ code: "invalid-input", subject: "core/scopes/aidlc-bugfix.md", detail: "authored scope requires a canonical name and nonempty Markdown body" }] });
});
