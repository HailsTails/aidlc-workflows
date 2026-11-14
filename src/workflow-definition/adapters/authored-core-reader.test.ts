import { expect, test } from "bun:test";
import { accept } from "../../kernel/fixtures/accept.ts";
import { source } from "../../kernel/fixtures/values.fixture.ts";
import { accepted } from "../../kernel/result.ts";
import type { CapturedMethodFiles } from "../application/ports.ts";
import { decodeAuthoredCore } from "./authored-core-reader.ts";

const stageContent = { kind: "text" as const, text: "---\nslug: example\nphase: inception\n---\n# Steps\n" };
const files: CapturedMethodFiles = {
  stages: [{ within: source("inception/example.md"), content: stageContent }],
  agents: [], scopes: [], sensors: [], rules: [], knowledge: [],
};
const outliner = { outline: (text: string) => ({ text, headings: [] }) };
const parser = { parse: () => accepted({
  slug: "example", phase: "inception", execution: "ALWAYS", condition: "An example request",
  ["lead_agent"]: "orchestrator", ["support_agents"]: [], mode: "inline", produces: [], consumes: [],
  ["requires_stage"]: [], scopes: [], inputs: "none", outputs: "none",
}) };

test("decoding retains the exact captured content and method source identity", () => {
  const reading = accept(decodeAuthoredCore({ files, parser, outliner, hooks: [] }));
  expect(reading.core.stages).toMatchObject([{ slug: "example",
    source: "aidlc-common/stages/inception/example.md" }]);
  expect(reading.files).toEqual<unknown>([{
    owner: { kind: "core" }, path: "aidlc-common/stages/inception/example.md", content: stageContent,
  }]);
  expect(reading.files[0]?.content).toBe(stageContent);
});

test("malformed UTF-8 refuses at the captured source without a repository read", () => {
  expect(decodeAuthoredCore({ files: { ...files,
    stages: [{ within: source("invalid.md"), content: { kind: "bytes", bytes: new Uint8Array([255]) } }],
  }, parser, outliner, hooks: [] })).toMatchObject({
    ok: false, refusal: [{ kind: "invalid-file", location: {
      kind: "method-source", owner: { kind: "core" }, path: "aidlc-common/stages/invalid.md",
    } }],
  });
});
