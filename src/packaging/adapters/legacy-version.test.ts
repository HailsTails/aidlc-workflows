import { expect, test } from "bun:test";
import { accepted, refused } from "../../kernel/result.ts";
import { createVersionStamp } from "./legacy-version.ts";

test("source-version builds retain even an unmodified version module's original bytes", () => {
  expect(createVersionStamp(accepted("2.11.3"))({ kind: "bytes", bytes: new Uint8Array([0, 255]) }))
    .toEqual(accepted({ kind: "bytes", bytes: new Uint8Array([0, 255]) }));
});

test("a preview stamps exactly the version assignment and preserves adjacent text", () => {
  expect(createVersionStamp(accepted("2.11.4-preview.20261109.1"))({ kind: "text",
    text: '// keep\nexport const AIDLC_VERSION = "2.11.3";\n' }))
    .toEqual(accepted({ kind: "text",
      text: '// keep\nexport const AIDLC_VERSION = "2.11.4-preview.20261109.1";\n' }));
});

test("a preview refuses an absent version assignment without throwing", () => {
  expect(createVersionStamp(accepted("2.11.4-preview.20261109.1"))({ kind: "text", text: "missing" }))
    .toEqual(refused({ kind: "version-unstampable",
      reason: "aidlc-version.ts must declare exactly one AIDLC_VERSION assignment, found 0" }));
});

test("channel refusal remains the stamp refusal", () => {
  expect(createVersionStamp(refused({ kind: "version-unstampable", reason: "Invalid preview" }))(
    { kind: "text", text: "unused" })).toEqual(refused({ kind: "version-unstampable", reason: "Invalid preview" }));
});
