import { expect, test } from "bun:test";
import { runnerCompositionCases } from "../__tests__/runner-composition-cases.ts";
import { runner, runnerFailure } from "../__tests__/runner-fixtures.ts";
import { skillContext } from "../__tests__/skill-fixtures.ts";
import { projectGeneratedRunners, projectGeneratedRunnerDefinitions } from "./generated-runners.ts";
import { createLegacyRunnerCompiler } from "../src/adapters/legacy-runner-compiler.ts";
import { rinRunnerRefusalCases } from "../__tests__/rin-runner-source-cases.ts";
test.each(runnerCompositionCases)("$baseline/$context.harness/$definition compiler response parsing and projection preserve source references and explicit policies", ({ context, requests, compiler, replies, expected, expectedDefinitions }) => {
  const boundary = createLegacyRunnerCompiler({ runtime: { root: "isolated/source-runtime", binding: context }, compiler, process: { execute: () => ({ status: "ok", value: replies }) } });
  const projected = projectGeneratedRunners({ compiler: boundary, requests, context });
  expect(projected).toMatchObject({ status: "ok", value: { resources: expected } });
  expect(projected).toMatchObject({ status: "ok", value: { runners: expectedDefinitions } });
});
test("compiler failure retains actionable guidance", () => {
  expect(projectGeneratedRunners({ compiler: { compile: () => runnerFailure }, requests: [], context: skillContext })).toEqual(runnerFailure);
});
test.each(rinRunnerRefusalCases)("$context.harness respects actual source availability: $name", ({ context, compiler, requests, response, expected }) => {
  const boundary = createLegacyRunnerCompiler({ runtime: { root: "isolated/source-runtime", binding: context }, compiler, process: { execute: () => ({ status: "ok", value: response }) } });
  expect(projectGeneratedRunners({ compiler: boundary, requests, context })).toEqual(expected);
});
test("repeated compiler products cannot overwrite a destination", () => {
  expect(projectGeneratedRunners({ compiler: { compile: () => ({ status: "ok", value: [runner, runner] }) }, requests: [], context: skillContext })).toEqual({ status: "invalid", findings: [{ code: "destination-collision", subject: ".claude/skills/aidlc-init/SKILL.md", detail: "native file set must emit each destination once" }] });
});
test("injected compiler cannot bypass safe output destinations", () => {
  expect(projectGeneratedRunners({ compiler: { compile: () => ({ status: "ok", value: [{ ...runner, name: "../../../outside" }] }) }, requests: [], context: skillContext })).toEqual({ status: "invalid", findings: [{ code: "invalid-destination", subject: ".claude/skills/../../../outside/SKILL.md", detail: "generated runner resources require safe relative paths" }] });
});
test("host binding failure blocks the whole set", () => {
  expect(projectGeneratedRunners({ compiler: { compile: () => ({ status: "ok", value: [runner, { ...runner, binding: { harness: "codex", directory: ".codex" } }] }) }, requests: [], context: skillContext })).toEqual({ status: "invalid", findings: [{ code: "harness-mismatch", subject: "aidlc-init", detail: "generated runner text is already bound to its compiler's harness; regenerate it for this target" }] });
});
test("composition: already compiled definitions reuse destination collision protection", () => {
  expect(projectGeneratedRunnerDefinitions({ runners: [runner, runner], context: skillContext })).toEqual({ status: "invalid", findings: [{ code: "destination-collision", subject: ".claude/skills/aidlc-init/SKILL.md", detail: "native file set must emit each destination once" }] });
});
