import { expect, test } from "bun:test";
import { runner } from "../../__tests__/runner-fixtures.ts";
import { skillContext, codexSkillContext } from "../../__tests__/skill-fixtures.ts";
import { emitGeneratedRunner } from "./generated-runner-emitter.ts";
test("Codex preserves already compiled slash commands and adds its native guard", () => {
  expect(emitGeneratedRunner({ runner: { ...runner, binding: { harness: "codex", directory: ".codex" } }, context: codexSkillContext })).toEqual({ status: "ok", value: { compiler: runner.compiler, owner: { kind: "core", id: "framework" }, request: { kind: "init" }, harness: "codex", entrypoint: ".agents/skills/aidlc-init/SKILL.md", resources: [{ kind: "file", path: ".agents/skills/aidlc-init/SKILL.md", body: "---\nname: aidlc-init\n---\nRun /aidlc" }, { kind: "file", path: ".agents/skills/aidlc-init/agents/openai.yaml", body: "policy:\n  allow_implicit_invocation: false\n" }], discovery: { kind: "native-directory", root: ".agents/skills" }, modelInvocation: "disabled" } });
});
test("host-bound text cannot be relabelled", () => {
  expect(emitGeneratedRunner({ runner, context: codexSkillContext })).toEqual({ status: "invalid", findings: [{ code: "harness-mismatch", subject: "aidlc-init", detail: "generated runner text is already bound to its compiler's harness; regenerate it for this target" }] });
});
test("native naming does not determine definition ownership", () => {
  expect(emitGeneratedRunner({ runner: { ...runner, owner: { kind: "plugin", id: "aidlc-tools" } }, context: skillContext })).toEqual({ status: "ok", value: { compiler: runner.compiler, owner: { kind: "plugin", id: "aidlc-tools" }, request: { kind: "init" }, harness: "claude", entrypoint: ".claude/skills/aidlc-init/SKILL.md", resources: [{ kind: "file", path: ".claude/skills/aidlc-init/SKILL.md", body: "---\nname: aidlc-init\n---\nRun /aidlc" }], discovery: { kind: "native-directory", root: ".claude/skills" }, modelInvocation: "native-default" } });
});
test("requested suppression cannot contradict explicit source enablement", () => {
  expect(emitGeneratedRunner({ runner: { ...runner, frontmatterInvocation: "enabled" }, context: { ...skillContext, modelInvocation: "disabled" } })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "aidlc-init", detail: "generated runner explicitly enables model invocation; do not add a contradictory suppression policy" }] });
});
test("unverified inline flags on Kiro do not establish suppression", () => {
  expect(emitGeneratedRunner({ runner: { ...runner, binding: { harness: "kiro", directory: ".kiro" }, frontmatterInvocation: "disabled" }, context: { ...skillContext, harness: "kiro", directory: ".kiro" } })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "aidlc-init", detail: "generated runner carries invocation frontmatter without a verified native encoding for this harness" }] });
});
test("missing native suppression refuses requested policy", () => {
  expect(emitGeneratedRunner({ runner, context: { ...skillContext, modelInvocation: "disabled" } })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "aidlc-init", detail: "compiler-prepared runner does not carry the requested native invocation suppression" }] });
});
