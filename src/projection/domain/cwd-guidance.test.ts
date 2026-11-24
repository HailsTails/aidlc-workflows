import { expect, test } from "bun:test";
import { accept } from "../../kernel/fixtures/accept.ts";
import { source } from "../../kernel/fixtures/values.fixture.ts";
import { refused } from "../../kernel/result.ts";
import { admitCwdDocuments, bindCwdDocuments } from "./cwd-guidance.ts";

const target = source("aidlc-common/protocols/custom.md");
const protocol = { source: target, role: "protocol" as const,
  content: { kind: "text" as const, text: "Before\r\n{{SLOT:framework_cwd_guidance}}\r\nAfter\r\n" } };
const other = { source: source("other.md"), role: "knowledge" as const,
  content: { kind: "text" as const, text: "Opaque {{SLOT:framework_cwd_guidance}}" } };

test.each(["{}", '{"kind":"other"}'])("runtime author input never defaults unknown intent: %s", (json) => {
  expect(admitCwdDocuments({ documents: [protocol], guidance: JSON.parse(json) }))
    .toEqual(refused("CWD authoring intent must be declared explicitly."));
});

test("runtime source admission refuses a non-string source", () => {
  expect(admitCwdDocuments({ documents: [protocol], guidance: JSON.parse('{"kind":"framework-cwd","source":null}') }))
    .toEqual(refused("The declared CWD protocol source must be a portable source path."));
});

test.each(["copy", "native"] as const)("legacy %s documents never infer CWD intent from role or marker", (channel) => {
  const captured = accept(admitCwdDocuments({ documents: [protocol, other], guidance: { kind: "legacy-authored" } }));
  expect(bindCwdDocuments({ captured, channel })).toBe(captured.documents);
  expect(captured.documents).toEqual([protocol, other]);
});
test.each(["Missing", "{{SLOT:framework_cwd_guidance}", "{{SLOT:framework_cwd_guidance}}{{SLOT:framework_cwd_guidance}}"])(
  "explicit source refuses missing, malformed or duplicate position: %s", (text) => {
    expect(admitCwdDocuments({ documents: [{ ...protocol, content: { kind: "text", text } }],
      guidance: { kind: "framework-cwd", source: target } })).toEqual(refused(
      "Declared CWD guidance requires exactly one {{SLOT:framework_cwd_guidance}} position."));
  });
test("a declared source must be portable before matching any document", () => {
  expect(admitCwdDocuments({ documents: [protocol], guidance: { kind: "framework-cwd", source: "../bad" } }))
    .toEqual(refused("The declared CWD protocol source must be a portable source path."));
});
test.each([{ documents: [] }, { documents: [protocol, protocol] }, { documents: [other] }] as const)("declaration requires one captured protocol, not a guessed path or role", (capture) => {
  expect(admitCwdDocuments({ documents: capture.documents, guidance: { kind: "framework-cwd", source: target } }))
    .toEqual(refused("Declared CWD guidance requires exactly one captured protocol at its authored source."));
});
test("the declared record cannot relabel knowledge as an admitted protocol", () => {
  expect(admitCwdDocuments({ documents: [{ ...protocol, role: "knowledge" }], guidance: { kind: "framework-cwd", source: target } }))
    .toEqual(refused("Declared CWD guidance requires exactly one captured protocol at its authored source."));
});
test("native binding touches only the declared raw position and retains source order", () => {
  const captured = accept(admitCwdDocuments({ documents: [other, protocol], guidance: { kind: "framework-cwd", source: target } }));
  expect(bindCwdDocuments({ captured, channel: "native" })).toEqual([other, { ...protocol, content: { kind: "text", text:
    "Before\r\n**CWD drift warning**: Native release commands resolve `aidlc` from `PATH`, so changing directories does not change the engine path. Keep project-relative file arguments anchored to the project root, or run `cd` commands in subshells: `(cd subdir && npm install)`.\r\nAfter\r\n" } }]);
  expect(captured.documents).toEqual([other, protocol]);
});
test("capture detaches source bytes and freezes the admitted document relationship", () => {
  const bytes = new Uint8Array([123, 123, 83, 76, 79, 84, 58, 102, 114, 97, 109, 101, 119, 111, 114, 107, 95, 99, 119, 100, 95, 103, 117, 105, 100, 97, 110, 99, 101, 125, 125]);
  const captured = accept(admitCwdDocuments({ documents: [{ ...protocol, content: { kind: "bytes", bytes } }], guidance: { kind: "framework-cwd", source: target } }));
  bytes[0] = 0;
  expect(captured.documents[0]?.content).toEqual({ kind: "bytes", bytes: new Uint8Array([123, 123, 83, 76, 79, 84, 58, 102, 114, 97, 109, 101, 119, 111, 114, 107, 95, 99, 119, 100, 95, 103, 117, 105, 100, 97, 110, 99, 101, 125, 125]) });
  expect(Object.isFrozen(captured)).toBe(true);
  expect(Object.isFrozen(captured.documents)).toBe(true);
});
