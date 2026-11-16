import { expect, test } from "bun:test";
import { accept } from "../../kernel/fixtures/accept.ts";
import type { CompileMethodRequest } from "./use-cases.ts";
import { stageNumber } from "../domain/stage-graph.ts";
import { stage } from "../fixtures/identities.fixture.ts";
import { createMethodCompiler } from "./create-method-compiler.ts";

const request: CompileMethodRequest = {
  core: { stages: [], agents: [], scopes: [], memberships: [], freeformDefaults: [],
    sensors: [], rules: [], knowledge: [], hooks: [] },
  contributions: [], saved: [], pins: [], selection: { kind: "every-installed" },
};
const compiler = createMethodCompiler({ outline: (text) => ({ text, headings: [] }) });

test("the fresh application compiler admits an empty authored Method", () => {
  const method = accept(compiler.compile(request));
  expect(method.stages).toEqual([]);
  expect(method.installedPlugins).toEqual([]);
  expect(method.graph.nodes).toEqual([]);
});

test("installed pins are refused instead of silently compiled as fresh content", () => {
  expect(compiler.compile({ ...request, pins: [{ stage: stage("prepare"),
    number: accept(stageNumber("3.1")) }] })).toEqual({
    ok: false, refusal: [{ kind: "invalid-file", location: { kind: "stage-pins" },
      issues: ["The fresh compiler does not apply installed stage pins."] }],
  });
});
