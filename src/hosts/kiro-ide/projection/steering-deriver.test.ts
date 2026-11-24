import { expect, test } from "bun:test";
import { refused } from "../../../kernel/result.ts";
import { path } from "../../../kernel/fixtures/values.fixture.ts";
import type { ProjectedFile } from "../../../projection/domain/projected-file.ts";
import type { CapturedFileFrame } from "../../../projection/application/ports/captured-file-frame.ts";
import { deriveKiroIdeSteering } from "./steering-deriver.ts";

const failure = { kind: "render-failed" as const, concept: "onboarding" as const,
  name: "captured-file-frame", reason: "No formatter execution in this adapter unit test." };
const memory = (content: ProjectedFile["content"]): ProjectedFile => ({
  path: path("aidlc/spaces/default/memory/org.md"), content, mode: "regular", origin: { kind: "active-space" },
});

test.each(["", "a", "\uFEFFa", "\uFEFF\uFEFFa", "é", `\uFEFF${"a".repeat(65534)}`])(
  "decoded memory text retains its payload through signed UTF-8 transport: %#", async text => {
    const captured = memory({ kind: "text", text });
    const staged: ProjectedFile[] = [];
    const frame: CapturedFileFrame = { render: async request => {
      staged.push(...request.files);
      return refused(failure);
    } };
    expect(await deriveKiroIdeSteering({ files: [captured], frame })).toEqual(refused(failure));
    expect(staged).toHaveLength(1);
    const content = staged[0]?.content;
    if (content?.kind !== "bytes") throw new Error("The frame requires a byte representation.");
    expect(new TextDecoder("utf-8", { fatal: true }).decode(content.bytes)).toBe(text);
    expect(content.bytes.byteLength).toBe(new TextEncoder().encode(text).length + 3);
    expect(captured.content).toEqual({ kind: "text", text });
  },
);

test("captured bytes remain raw and unrelated projected files never enter the memory frame", async () => {
  const bytes = new Uint8Array([0xef, 0xbb, 0xbf, 97]);
  const captured = memory({ kind: "bytes", bytes });
  const frame: CapturedFileFrame = { render: async request => {
    expect(request.files).toEqual([captured]);
    expect(request.files[0]?.content).toBe(captured.content);
    return refused(failure);
  } };
  expect(await deriveKiroIdeSteering({ files: [captured, { ...captured, path: path("unrelated.md") }], frame }))
    .toEqual(refused(failure));
});
