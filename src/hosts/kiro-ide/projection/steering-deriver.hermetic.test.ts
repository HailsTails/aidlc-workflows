import { afterAll, expect, test } from "bun:test";
import { path } from "../../../kernel/fixtures/values.fixture.ts";
import { accepted } from "../../../kernel/result.ts";
import type { ProjectedFile } from "../../../projection/domain/projected-file.ts";
import { deriveKiroIdeSteering } from "./steering-deriver.ts";


import { accept } from "../../../kernel/fixtures/accept.ts";
import { createNodeFileSystem } from "../../../kernel/file-system.ts";
import { createCapturedFileFrame, CAPTURED_FRAME_NATIVE_PATH } from "../../../projection/adapters/captured-file-frame.ts";
import { projectWorkspace } from "../../../projection/application/project-workspace.ts";
import { tokenBindingsFixture } from "../../../projection/fixtures/token-bindings.fixture.ts";
import { methodSource } from "../../../workflow-definition/fixtures/method-source.fixture.ts";
import { kiroIdeHostIdentity } from "../host-data.ts";
import { kiroIdeHost } from "../host.ts";
import { kiroAgentRenderer } from "../../kiro/projection/agent-renderer.ts";
import { kiroNativePermissionsLine } from "../../kiro/distribution.ts";

const scratch = createNodeFileSystem();
const frames = accept(await scratch.makeScratchFolder({ parent: new URL("../../../../.cache/", import.meta.url) }));
const frame = createCapturedFileFrame({ scratch, frames, nativePath: CAPTURED_FRAME_NATIVE_PATH });
afterAll(async () => {
  expect(await scratch.listFolder({ folder: frames })).toEqual(accepted([]));
  expect(await scratch.removeFolder({ folder: frames })).toEqual(accepted(frames));
  expect(await scratch.listFolder({ folder: frames }))
    .toEqual({ ok: false, refusal: { kind: "unreadable", code: "not-found" } });
});

const REFERENCE_FORM = `---
inclusion: always
---

# AI-DLC Active Memory

The following live workspace files are the active AI-DLC method and policy
layers. They apply to the conductor and delegated agents.

#[[file:aidlc/spaces/default/memory/org.md]]
#[[file:aidlc/spaces/default/memory/team.md]]
#[[file:aidlc/spaces/default/memory/project.md]]
#[[file:aidlc/spaces/default/memory/phases/ideation.md]]
#[[file:aidlc/spaces/default/memory/phases/inception.md]]
#[[file:aidlc/spaces/default/memory/phases/construction.md]]
#[[file:aidlc/spaces/default/memory/phases/operation.md]]
`;
const INLINE_FORM = `---
inclusion: always
---

# AI-DLC Active Memory

<!-- AI-DLC writes this file from aidlc/spaces/default/memory/ for every chat. Do not edit it: edit those files instead. -->

The text of each file below is the active AI-DLC method and policy layers. They apply to the
conductor and delegated agents.

<memory-file path="aidlc/spaces/default/memory/org.md">
O
</memory-file>

<memory-file path="aidlc/spaces/default/memory/team.md">
T
</memory-file>

<memory-file path="aidlc/spaces/default/memory/phases/operation.md">
OP
</memory-file>

<memory-file path="aidlc/spaces/default/memory/alpha.md">
A
</memory-file>

<memory-file path="aidlc/spaces/default/memory/zeta.md">
Z
</memory-file>

<memory-file path="aidlc/spaces/default/memory/phases/extra.md">
X
</memory-file>
`;

const memory = (name: string, text: string): ProjectedFile => ({
  path: path(`aidlc/spaces/default/memory/${name}`), content: { kind: "text", text }, mode: "regular",
  origin: { kind: "active-space" } });
const steeringFile = (text: string): ProjectedFile => ({
  path: path(".kiro/steering/aidlc-active-memory.md"), mode: "regular",
  content: { kind: "text", text },
  origin: { kind: "rendered", concept: "onboarding", name: ".kiro/steering/aidlc-active-memory.md" } });

test("the memory layers are inlined in layer order, extras after them sorted, other files ignored", async () => {
  const files = [memory("zeta.md", "Z"), memory("phases/operation.md", "OP\n"), memory("team.md", "T"),
    memory("alpha.md", "A"), memory("org.md", "O"), memory("phases/extra.md", "X"), memory("notes.txt", "ignored"),
    memory("deep/nested.md", "ignored")];
  expect(await deriveKiroIdeSteering({ files, frame })).toEqual(accepted([steeringFile(INLINE_FORM)]));
});

test("no memory file leaves the reference form", async () => {
  expect(await deriveKiroIdeSteering({ files: [], frame })).toEqual(accepted([steeringFile(REFERENCE_FORM)]));
});

test("a memory file that is not UTF-8 leaves the reference form", async () => {
  const bytes: ProjectedFile = { ...memory("org.md", ""), content: { kind: "bytes", bytes: new Uint8Array([0xff, 0xfe]) } };
  expect(await deriveKiroIdeSteering({ files: [bytes], frame })).toEqual(accepted([steeringFile(REFERENCE_FORM)]));
});

test("a memory larger than the inline limit leaves the reference form", async () => {
  const oversized: ProjectedFile = { ...memory("org.md", ""), content: { kind: "bytes", bytes: new Uint8Array(65537) } };
  expect(await deriveKiroIdeSteering({ files: [oversized], frame })).toEqual(accepted([steeringFile(REFERENCE_FORM)]));
});

const SHORT_INLINE = `---
inclusion: always
---

# AI-DLC Active Memory

<!-- AI-DLC writes this file from aidlc/spaces/default/memory/ for every chat. Do not edit it: edit those files instead. -->

The text of each file below is the active AI-DLC method and policy layers. They apply to the
conductor and delegated agents.

<memory-file path="aidlc/spaces/default/memory/org.md">
a
</memory-file>
`;

test.each([
  { count: 1, expected: SHORT_INLINE.replace("\na\n", "\n\uFEFFa\n"), bytes: 379 },
  { count: 65534, expected: REFERENCE_FORM, bytes: 559 },
])("actual captured rule producer preserves text BOM and cutoff: $count", async ({ count, expected, bytes }) => {
  const text = `\uFEFF${"a".repeat(count)}`;
  const files = accept(projectWorkspace({ host: accept(kiroIdeHostIdentity()),
    tokens: tokenBindingsFixture({ harnessDir: ".kiro" }), companions: [],
    rules: [{ owner: { kind: "core" }, path: methodSource({ kind: "rule", within: "org.md" }),
      content: { kind: "bytes", bytes: new TextEncoder().encode(text) } }] }));
  expect(files[0]?.content).toEqual({ kind: "text", text });
  const derived = await deriveKiroIdeSteering({ files, frame });
  expect(derived).toEqual(accepted([steeringFile(expected)]));
  expect(new TextEncoder().encode(expected)).toHaveLength(bytes);
  expect(files[0]?.content).toEqual({ kind: "text", text });
});

test("raw byte BOM keeps frozen filesystem decoding instead of decoded-text encoding", async () => {
  const bytes = new TextEncoder().encode("\uFEFFa");
  const result = await deriveKiroIdeSteering({ files: [{ ...memory("org.md", ""),
    content: { kind: "bytes", bytes } }], frame });
  expect(result).toEqual(accepted([steeringFile(SHORT_INLINE)]));
  expect(new TextEncoder().encode(SHORT_INLINE)).toHaveLength(376);
});

test.each([
  { text: "", expected: SHORT_INLINE.replace("\na\n", "\n\n") },
  { text: "é\n", expected: SHORT_INLINE.replace("\na\n", "\né\n") },
  { text: "a".repeat(65536), expected: SHORT_INLINE.replace("\na\n", `\n${"a".repeat(65536)}\n`) },
  { text: "a".repeat(65537), expected: REFERENCE_FORM },
])("frozen owner preserves empty, multibyte, newline and exact byte boundary: %#", async ({ text, expected }) => {
  expect(await deriveKiroIdeSteering({ files: [memory("org.md", text)], frame }))
    .toEqual(accepted([steeringFile(expected)]));
});

test("kiroIde derives only steering after its complete record was already constructed", async () => {
  const record: ProjectedFile = { path: path(".kiro/tools/data/harness.json"), content: {
    kind: "text", text: '{\n  "newChatStep": 1\n}\n' }, mode: "regular",
    origin: { kind: "rendered", concept: "host-data", name: "kiro-ide" } };
  const module = accept(kiroIdeHost({ personas: kiroAgentRenderer, permissionsLine: kiroNativePermissionsLine }));
  expect(await module.projection.derive({ files: [record], frame }))
    .toEqual(accepted([steeringFile(REFERENCE_FORM)]));
  expect(record.content).toEqual({ kind: "text", text: '{\n  "newChatStep": 1\n}\n' });
});

test.each([
  { org: "a".repeat(65535), team: "b", inline: true },
  { org: "a".repeat(65536), team: "b", inline: false },
  { org: "é".repeat(32767), team: "é", inline: true },
  { org: "é".repeat(32767), team: "éb", inline: false },
])("aggregate cutoff counts decoded bytes across memory files: %#", async ({ org, team, inline }) => {
  const expected = inline ? SHORT_INLINE.replace("\na\n</memory-file>\n",
    `\n${org}\n</memory-file>\n\n<memory-file path="aidlc/spaces/default/memory/team.md">\n${team}\n</memory-file>\n`)
    : REFERENCE_FORM;
  expect(new TextEncoder().encode(org).length + new TextEncoder().encode(team).length)
    .toBe(inline ? 65536 : 65537);
  expect(await deriveKiroIdeSteering({ files: [memory("team.md", team), memory("org.md", org)], frame }))
    .toEqual(accepted([steeringFile(expected)]));
});

test("the actual filesystem capture gives projected memory scalar text even for a lone-surrogate write", async () => {
  const input = new URL("scalar-text-source.md", frames);
  try {
    accept(await scratch.writeFile({ file: input, content: { kind: "text", text: "\uD800" } }));
    const captured = accept(await scratch.readFile({ file: input }));
    expect(captured).toEqual({ kind: "bytes", bytes: new Uint8Array([0xef, 0xbf, 0xbd]) });
    const files = accept(projectWorkspace({ host: accept(kiroIdeHostIdentity()),
      tokens: tokenBindingsFixture({ harnessDir: ".kiro" }), companions: [], rules: [{ owner: { kind: "core" },
        path: methodSource({ kind: "rule", within: "org.md" }), content: captured }] }));
    expect(files[0]?.content).toEqual({ kind: "text", text: "\uFFFD" });
    const text = files[0]?.content;
    if (text?.kind !== "text") throw new Error("The captured rule must be decoded before derivation.");
    expect(text.text.isWellFormed()).toBe(true);
    expect(await deriveKiroIdeSteering({ files, frame }))
      .toEqual(accepted([steeringFile(SHORT_INLINE.replace("\na\n", "\n\uFFFD\n"))]));
    expect(files[0]?.content).toEqual({ kind: "text", text: "\uFFFD" });
  } finally {
    expect(await scratch.removeEntry({ entry: input })).toEqual(accepted(input));
  }
});
