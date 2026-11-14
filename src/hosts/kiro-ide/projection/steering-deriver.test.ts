import { expect, test } from "bun:test";
import { path } from "../../../kernel/fixtures/values.fixture.ts";
import { accepted } from "../../../kernel/result.ts";
import type { ProjectedFile } from "../../../projection/domain/projected-file.ts";
import { deriveKiroIdeSteering } from "./steering-deriver.ts";

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

test("the memory layers are inlined in layer order, extras after them sorted, other files ignored", () => {
  const files = [memory("zeta.md", "Z"), memory("phases/operation.md", "OP\n"), memory("team.md", "T"),
    memory("alpha.md", "A"), memory("org.md", "O"), memory("phases/extra.md", "X"), memory("notes.txt", "ignored"),
    memory("deep/nested.md", "ignored")];
  expect(deriveKiroIdeSteering({ files })).toEqual(accepted([steeringFile(INLINE_FORM)]));
});

test("no memory file leaves the reference form", () => {
  expect(deriveKiroIdeSteering({ files: [] })).toEqual(accepted([steeringFile(REFERENCE_FORM)]));
});

test("a memory file that is not UTF-8 leaves the reference form", () => {
  const bytes: ProjectedFile = { ...memory("org.md", ""), content: { kind: "bytes", bytes: new Uint8Array([0xff, 0xfe]) } };
  expect(deriveKiroIdeSteering({ files: [bytes] })).toEqual(accepted([steeringFile(REFERENCE_FORM)]));
});

test("a memory larger than the inline limit leaves the reference form", () => {
  const oversized: ProjectedFile = { ...memory("org.md", ""), content: { kind: "bytes", bytes: new Uint8Array(65537) } };
  expect(deriveKiroIdeSteering({ files: [oversized] })).toEqual(accepted([steeringFile(REFERENCE_FORM)]));
});
