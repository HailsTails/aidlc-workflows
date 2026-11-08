import { expect, test } from "bun:test";
import { accept } from "../../kernel/fixtures/accept.ts";
import { source } from "../../kernel/fixtures/values.fixture.ts";
import type { CapturedSourceFile, SourceFiles } from "../application/source-files.ts";
import { compileCoreMethod } from "../domain/compile-core-method.ts";
import { createSourceFiles } from "./source-files.ts";
import { readAuthoredCore } from "./authored-core-reader.ts";

const stageContent = { kind: "text" as const, text: `---
slug: example
phase: inception
execution: ALWAYS
condition: An example request
lead_agent: orchestrator
support_agents: []
mode: inline
produces: []
consumes: []
requires_stage: []
scopes: []
inputs: none
outputs: none
---
# Steps
` };
const captures: Readonly<Record<string, readonly CapturedSourceFile[]>> = {
  "aidlc-common/stages": [{ within: source("inception/example.md"), content: stageContent }],
};
const sourceFiles: SourceFiles = { read: async (directory) => captures[directory] ?? [] };
const outliner = { outline: (text: string) => ({ text, headings: [] }) };

test("authored loading shares the captured bytes with the Method source inventory", async () => {
  const reading = accept(await readAuthoredCore({ sourceFiles, outliner, hooks: [] }));
  expect(reading.core.stages).toMatchObject([{ slug: "example",
    source: "aidlc-common/stages/inception/example.md" }]);
  expect(reading.files[0]?.content).toBe(stageContent);
  expect(reading.files[0]?.path).toBe<string>("aidlc-common/stages/inception/example.md");
});

test("malformed UTF-8 refuses at its captured source location", async () => {
  const invalidCaptures: Readonly<Record<string, readonly CapturedSourceFile[]>> = {
    "aidlc-common/stages": [{ within: source("invalid.md"),
      content: { kind: "bytes", bytes: new Uint8Array([255]) } }],
  };
  const invalidFiles: SourceFiles = { read: async (directory) => invalidCaptures[directory] ?? [] };
  expect(await readAuthoredCore({ sourceFiles: invalidFiles, outliner, hooks: [] }))
    .toMatchObject({ ok: false, refusal: [{ kind: "invalid-file", location: {
      kind: "method-source", owner: { kind: "core" }, path: "aidlc-common/stages/invalid.md",
    } }] });
});

test("the real authored core retains the complete fresh stage numbering", async () => {
  const reading = accept(await readAuthoredCore({
    sourceFiles: createSourceFiles(new URL("../../../core/", import.meta.url)),
    outliner, hooks: [],
  }));
  const compilation = accept(compileCoreMethod(reading.core));
  expect(compilation.graph.nodes).toMatchObject([
    { stage: "workspace-scaffold", number: "0.1" },
    { stage: "workspace-detection", number: "0.2" },
    { stage: "state-init", number: "0.3" },
    { stage: "intent-capture", number: "1.1" },
    { stage: "market-research", number: "1.2" },
    { stage: "feasibility", number: "1.3" },
    { stage: "scope-definition", number: "1.4" },
    { stage: "team-formation", number: "1.5" },
    { stage: "rough-mockups", number: "1.6" },
    { stage: "approval-handoff", number: "1.7" },
    { stage: "reverse-engineering", number: "2.1" },
    { stage: "practices-discovery", number: "2.2" },
    { stage: "requirements-analysis", number: "2.3" },
    { stage: "user-stories", number: "2.4" },
    { stage: "refined-mockups", number: "2.5" },
    { stage: "domain-design", number: "2.6" },
    { stage: "units-generation", number: "2.7" },
    { stage: "contract-design", number: "2.8" },
    { stage: "delivery-planning", number: "2.9" },
    { stage: "functional-design", number: "3.1" },
    { stage: "nfr-requirements", number: "3.2" },
    { stage: "nfr-design", number: "3.3" },
    { stage: "infrastructure-design", number: "3.4" },
    { stage: "code-generation", number: "3.5" },
    { stage: "build-and-test", number: "3.6" },
    { stage: "ci-pipeline", number: "3.7" },
    { stage: "deployment-pipeline", number: "4.1" },
    { stage: "environment-provisioning", number: "4.2" },
    { stage: "deployment-execution", number: "4.3" },
    { stage: "observability-setup", number: "4.4" },
    { stage: "incident-response", number: "4.5" },
    { stage: "performance-validation", number: "4.6" },
    { stage: "feedback-optimization", number: "4.7" },
  ]);
});
