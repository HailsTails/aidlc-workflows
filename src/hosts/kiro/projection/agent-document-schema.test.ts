import { expect, test } from "bun:test";
import { decodeKiroAgentDocument } from "./agent-document-schema.ts";

const decode = (text: string) => decodeKiroAgentDocument({ kind: "text", text });

test("edge decoding retains prototype-named and opaque nested fields", () => {
  expect(decode('{"__proto__":{"keep":1},"custom":{"nested":[1e400]}}'))
    .toMatchObject({ ok: true, value: { kind: "object", fields: [
      { name: "__proto__", value: { keep: 1 } },
      { name: "custom", value: { nested: [Infinity] } },
    ], resources: { kind: "other-resources" }, hooks: { kind: "absent-hooks" } } });
});

test("edge decoding names each used resource and hook shape without refusing unused invalid hooks", () => {
  expect(decode('{"resources":[false,"file://.kiro/knowledge/aidlc-shared/*.md"],' +
    '"hooks":{"pre":[{"command":"run"},null,1e400],"post":{}}}'))
    .toMatchObject({ ok: true, value: { kind: "object",
      resources: { kind: "resource-list", entries: [
        { kind: "retained", value: false }, { kind: "shared-glob" },
      ] },
      hooks: { kind: "object-hooks", groups: [
        { name: "pre", value: { kind: "rows", rows: [
          { kind: "command", command: "run" }, { kind: "null-row" },
          { kind: "legacy-overflow-row", value: Infinity },
        ] } },
        { name: "post", value: { kind: "invalid-rows" } },
      ] },
    } });
});

test.each([
  { text: "null", kind: "null" }, { text: "[]", kind: "array" },
  { text: "true", kind: "scalar" }, { text: "1e400", kind: "legacy-overflow" },
])("edge decoding preserves primitive admission: $text", ({ text, kind }) => {
  expect(decode(text)).toMatchObject({ ok: true, value: { kind } });
});

test("malformed JSON returns a named refusal rather than throwing", () => {
  expect(decode("malformed")).toEqual({ ok: false, refusal: { kind: "kiro-json-invalid" } });
});
