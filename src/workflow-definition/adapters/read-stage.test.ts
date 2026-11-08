import { accept } from "../../kernel/fixtures/accept.ts";
import { expect, test } from "bun:test";
import { methodSource } from "../fixtures/method-source.fixture.ts";
import { readStage } from "./read-stage.ts";

const source = { owner: { kind: "core" } as const,
  path: methodSource({ kind: "stage", within: "inception/requirements-analysis.md" }) };
const raw = `---
slug: requirements-analysis
phase: inception
execution: ALWAYS
condition: A new feature
lead_agent: aidlc-product-agent
support_agents: []
mode: inline
produces: [requirements]
consumes: []
requires_stage: []
scopes: [feature]
inputs: Intent
outputs: Requirements
---
# Requirements
`;
const outliner = { outline: (text: string) => ({ text, headings: [] }) };

test("a stage has one method source and emits membership declarations separately", () => {
  const admission = accept(readStage({ source, raw, outliner }));
  expect(admission.stage.source).toBe(source.path);
  expect(admission.stage.workspace).toBe("read-only");
  expect(admission.stage.briefing.instructions.text).toBe("# Requirements\n");
  expect(admission.memberships).toEqual<readonly { scope: string; stage: string; declaredBy: {kind: string} }[]>([{ scope: "feature", stage: "requirements-analysis",
    declaredBy: { kind: "core" } }]);
});

test("a mismatched source filename refuses the stage identity", () => {
  const otherSource = { ...source,
    path: methodSource({ kind: "stage", within: "inception/other.md" }) };
  expect(readStage({ source: otherSource, raw, outliner })).toMatchObject({
    ok: false, refusal: [{ kind: "slug-differs-from-file", source: otherSource,
      slug: "requirements-analysis" }],
  });
});
