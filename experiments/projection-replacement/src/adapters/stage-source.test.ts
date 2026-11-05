import { expect, test } from "bun:test";
import { parseStageSource } from "./stage-source.ts";
import { stageText, stageOrigin, authoredStage } from "../../__tests__/stage-fixtures.ts";
test("composition: authored stage metadata and body survive identity parsing unchanged", () => {
  expect(parseStageSource({ text: stageText, origin: stageOrigin })).toEqual({ status: "ok", value: authoredStage });
});
test("composition: duplicate authored slug keys refuse before placement", () => {
  expect(parseStageSource({ text: "---\nslug: code-generation\nslug: elsewhere\n---\nBody\n", origin: stageOrigin })).toEqual({ status: "invalid", findings: [{ code: "invalid-input", subject: "core/aidlc-common/stages/construction/code-generation.md", detail: "authored stage requires one top-level native slug, closed frontmatter and nonempty Markdown body; native compilation owns the remaining metadata grammar" }] });
});
test("native quoted identities and colon-containing prose survive without imposing general YAML grammar", () => {
  expect(parseStageSource({ text: "---\nslug: 'code-generation'\ncondition: Always: preserve this native prose\nmode: subagent\n---\nBody\n", origin: stageOrigin })).toEqual({ status: "ok", value: { origin: stageOrigin, slug: "code-generation", phase: "construction", markdown: "---\nslug: 'code-generation'\ncondition: Always: preserve this native prose\nmode: subagent\n---\nBody\n" } });
});
test("composition: a slug alias cannot redirect the source phase/filename identity", () => {
  expect(parseStageSource({ text: "---\nslug: elsewhere\n---\nBody\n", origin: stageOrigin })).toEqual({ status: "invalid", findings: [{ code: "invalid-path", subject: "core/aidlc-common/stages/construction/code-generation.md", detail: "core stage path must declare a native phase directory and match the authored slug; plugin stage sources require their own composition contract" }] });
});
test("composition: unsupported phase directories are explicit source failures", () => {
  expect(parseStageSource({ text: stageText, origin: { ...stageOrigin, path: "core/aidlc-common/stages/operations/code-generation.md" } })).toEqual({ status: "invalid", findings: [{ code: "invalid-path", subject: "core/aidlc-common/stages/operations/code-generation.md", detail: "core stage path must declare a native phase directory and match the authored slug; plugin stage sources require their own composition contract" }] });
});
