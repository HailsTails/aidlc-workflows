import { expect, test } from "bun:test";
import { accepted, type Result } from "../../../kernel/result.ts";
import type { ProjectionRefusal } from "../../../projection/domain/projection.ts";
import type { DistributionId, ProjectPath, SourcePath } from "../../../kernel/values.ts";
import { brand } from "../../../kernel/brand.ts";
import type { MethodSourcePath } from "../../../workflow-definition/domain/method-source.ts";
import type { FileContent } from "../../../kernel/file-content.ts";
import { prepareKiroAgentDocument, type KiroModelDecision } from "./prepared-agent-document.ts";

const host = { distribution: brand<DistributionId>("kiro"), directory: brand<ProjectPath>(".kiro") };
const source = brand<SourcePath>("agents/aidlc.json");

const prepare = (text: string, model: KiroModelDecision = { kind: "preserve" }): Result<FileContent, ProjectionRefusal> =>
  prepareKiroAgentDocument({ host, source, content: { kind: "text", text }, model,
    knowledge: { documents: [], formatDocuments: new Set() }, hookCommandSuffix: " suffix" });

const withoutHooks = (content: FileContent): Result<FileContent, ProjectionRefusal> => prepareKiroAgentDocument({ host, source,
  content, model: { kind: "preserve" },
  knowledge: { documents: [], formatDocuments: new Set() }, hookCommandSuffix: undefined,
});

test("no-op retains original content and bytes without mutating the capture", () => {
  const bytes = new Uint8Array([32, 91, 93, 13, 10]);
  const content: FileContent = { kind: "bytes", bytes };
  expect(withoutHooks(content)).toEqual(accepted(content));
  expect(bytes).toEqual(new Uint8Array([32, 91, 93, 13, 10]));
});

test("model, repeated globs and hooks share one document and preserve unknown fields", () => {
  expect(prepare(
    '{"x":{"nested":[null,3]},"resources":[false,"file://.kiro/knowledge/aidlc-shared/*.md",' +
    '{"custom":2},"file://.kiro/knowledge/aidlc-shared/*.md"],"model":"old",' +
    '"hooks":{"pre":[{"extra":7,"command":"run"},{"command":false}]}}',
    { kind: "project", model: "new" },
  )).toEqual(accepted({ kind: "text", text:
    '{\n  "x": {\n    "nested": [\n      null,\n      3\n    ]\n  },\n' +
    '  "resources": [\n    false,\n    {\n      "custom": 2\n    }\n  ],\n' +
    '  "model": "new",\n  "hooks": {\n    "pre": [\n      {\n' +
    '        "extra": 7,\n        "command": "run suffix"\n      },\n' +
    '      {\n        "command": false\n      }\n    ]\n  }\n}\n',
  }));
});

test("model assignment always formats and model removal retains key order", () => {
  expect(prepare('{ "z":1,"model":"same","a":2 }', { kind: "project", model: "same" }))
    .toEqual(accepted({ kind: "text", text: '{\n  "z": 1,\n  "model": "same",\n  "a": 2\n}\n' }));
  expect(prepare('{ "z":1,"model":"old","a":2 }', { kind: "project", model: undefined }))
    .toEqual(accepted({ kind: "text", text: '{\n  "z": 1,\n  "a": 2\n}\n' }));
});

test("unknown prototype-named fields and overflow values survive the decoding boundary", () => {
  expect(prepare('{"__proto__":{"retained":true},"unknown":1e400}',
    { kind: "project", model: undefined })).toEqual(accepted({ kind: "text", text:
    '{\n  "__proto__": {\n    "retained": true\n  },\n  "unknown": null\n}\n' }));
  expect(prepare(' 1e400\n')).toEqual(accepted({ kind: "text", text: ' 1e400\n' }));
});

test.each(['[]', 'true', '3', '"text"'])("conductor accepts inherited primitive %s", (text) => {
  expect(prepare(text)).toEqual(accepted({ kind: "text", text }));
});

test("arrays survive model projection and primitives survive model deletion", () => {
  expect(prepare('[ 1 ]', { kind: "project", model: "chosen" }))
    .toEqual(accepted({ kind: "text", text: '[\n  1\n]\n' }));
  expect(prepare(' 3 ', { kind: "project", model: undefined }))
    .toEqual(accepted({ kind: "text", text: '3\n' }));
});

test.each(['null', 'malformed', '{"hooks":null}', '{"hooks":{"pre":{}}}',
  '{"hooks":{"pre":[null]}}'])("inherited preparation failure remains a failure: %s", (text) => {
  expect(prepare(text)).toMatchObject({ ok: false, refusal: { kind: "host-source-unreadable" } });
});

test("primitive model assignment and formatted numeric overflow fail before later steps", () => {
  expect(prepare('3', { kind: "project", model: "chosen" })).toMatchObject({ ok: false, refusal: { kind: "host-source-unreadable" } });
  expect(prepare('1e400', { kind: "project", model: undefined })).toMatchObject({ ok: false, refusal: { kind: "host-source-unreadable" } });
});

test("undefined suffix bypasses malformed hooks without formatting", () => {
  expect(withoutHooks({ kind: "text", text: '{ "hooks": null }' }))
    .toEqual(accepted({ kind: "text", text: '{ "hooks": null }' }));
});

test.each(['true', '3', '"abc"', '{}', '[]'])("present hooks %s format even without commands", (hooks) => {
  expect(prepare(`{ "hooks": ${hooks} }`)).toEqual(accepted({
    kind: "text", text: `{\n  "hooks": ${hooks}\n}\n`,
  }));
});

test("string hook groups and primitive rows retain inherited acceptance", () => {
  expect(prepare('{"hooks":{"pre":"abc","post":[3,false,"x",[]]}}'))
    .toEqual(accepted({ kind: "text", text: '{\n  "hooks": {\n    "pre": "abc",\n' +
      '    "post": [\n      3,\n      false,\n      "x",\n      []\n    ]\n  }\n}\n' }));
});

test("array-shaped hooks append once and do not mutate the raw input", () => {
  const content: FileContent = { kind: "text", text: '{"hooks":[[{"command":"run"}]]}' };
  expect(prepareKiroAgentDocument({ host, source, content, model: { kind: "preserve" },
    knowledge: { documents: [], formatDocuments: new Set() }, hookCommandSuffix: " suffix" }))
    .toEqual(accepted({ kind: "text", text: '{\n  "hooks": [\n    [\n      {\n' +
      '        "command": "run suffix"\n      }\n    ]\n  ]\n}\n' }));
  expect(content.text).toBe('{"hooks":[[{"command":"run"}]]}');
});


test("legacy intermediate-serialization quirk turns overflow rows null before hooks", () => {
  expect(prepare('{"hooks":{"pre":[1e400]}}',
    { kind: "project", model: undefined })).toMatchObject({ ok: false, refusal: { kind: "host-source-unreadable" } });
  expect(prepare('{"resources":["file://.kiro/knowledge/aidlc-shared/*.md"],' +
    '"hooks":{"pre":[1e400]}}')).toMatchObject({ ok: false, refusal: { kind: "host-source-unreadable" } });
});

test("byte decoding preserves the legacy BOM refusal", () => {
  expect(withoutHooks({ kind: "bytes",
    bytes: new Uint8Array([239, 187, 191, 123, 125]) })).toMatchObject({ ok: false, refusal: { kind: "host-source-unreadable" } });
});

test("defined empty suffix still formats hooks and an existing suffix receives one append", () => {
  expect(prepareKiroAgentDocument({ host, source, content: { kind: "text", text: '{ "hooks": {} }' },
    model: { kind: "preserve" }, knowledge: { documents: [], formatDocuments: new Set() },
    hookCommandSuffix: "" })).toEqual(accepted({ kind: "text", text: '{\n  "hooks": {}\n}\n' }));
  expect(prepare('{"hooks":{"pre":[{"command":"run suffix"}]}}'))
    .toEqual(accepted({ kind: "text", text: '{\n  "hooks": {\n    "pre": [\n      {\n' +
      '        "command": "run suffix suffix"\n      }\n    ]\n  }\n}\n' }));
});


test("conductor expands every glob in place using deterministic resource order", () => {
  expect(prepareKiroAgentDocument({ host, source,
    content: { kind: "text", text: '{"resources":["file://.kiro/knowledge/aidlc-shared/*.md",' +
      'false,"file://.kiro/knowledge/aidlc-shared/*.md"]}' },
    model: { kind: "preserve" }, hookCommandSuffix: undefined,
    knowledge: { formatDocuments: new Set(), documents: [
      { source: brand<MethodSourcePath>("knowledge/aidlc-shared/z.md"),
        owner: { kind: "core" }, audience: { kind: "shared" } },
      { source: brand<MethodSourcePath>("knowledge/aidlc-shared/a.md"),
        owner: { kind: "core" }, audience: { kind: "shared" } },
    ] },
  })).toEqual(accepted({ kind: "text", text: '{\n  "resources": [\n' +
    '    "file://.kiro/knowledge/aidlc-shared/a.md",\n' +
    '    "file://.kiro/knowledge/aidlc-shared/z.md",\n    false,\n' +
    '    "file://.kiro/knowledge/aidlc-shared/a.md",\n' +
    '    "file://.kiro/knowledge/aidlc-shared/z.md"\n  ]\n}\n' }));
});

test("formatting a byte capture leaves its original buffer untouched", () => {
  const bytes = new Uint8Array([123, 125]);
  expect(prepareKiroAgentDocument({ host, source, content: { kind: "bytes", bytes },
    model: { kind: "project", model: "pin" },
    knowledge: { documents: [], formatDocuments: new Set() }, hookCommandSuffix: undefined }))
    .toEqual(accepted({ kind: "text", text: '{\n  "model": "pin"\n}\n' }));
  expect(bytes).toEqual(new Uint8Array([123, 125]));
});


test("named preparation failures retain host, source and stage without exception transport", () => {
  expect(prepare("null", { kind: "project", model: "pin" })).toEqual({ ok: false,
    refusal: { kind: "host-source-unreadable", host, source,
      reason: "Kiro model projection: the document cannot be null." },
  });
  expect(prepare("null")).toEqual({ ok: false,
    refusal: { kind: "host-source-unreadable", host, source,
      reason: "Kiro shared-resource preparation: the document cannot be null." },
  });
  expect(prepare("malformed", { kind: "project", model: "pin" })).toEqual({ ok: false,
    refusal: { kind: "host-source-unreadable", host, source,
      reason: "Kiro JSON decoding: the captured document is not valid JSON." },
  });
});

test("prototype-named hook events and row fields remain opaque retained properties", () => {
  expect(prepare('{"hooks":{"__proto__":[{"__proto__":{"keep":1},"command":"run"}]}}'))
    .toEqual(accepted({ kind: "text", text: '{\n  "hooks": {\n    "__proto__": [\n' +
      '      {\n        "__proto__": {\n          "keep": 1\n        },\n' +
      '        "command": "run suffix"\n      }\n    ]\n  }\n}\n' }));
});
