import { expect, test } from "bun:test";
import { authoredSkill, skillContext, skillRootCases, codexSkillContext } from "../../__tests__/skill-fixtures.ts";
import { createSkillEmitter } from "./skill-emitter.ts";

test.each(skillRootCases)("native skill discovery follows $context.harness rather than assuming its engine directory", ({ context, expected }) => {
  expect(createSkillEmitter({ harness: context.harness }).emit({ skill: authoredSkill, context, markdown: "Native text /aidlc" })).toEqual({ status: "ok", value: expected });
});
test("Codex emits its invocation policy and rewrites skill calls while preserving file paths", () => {
  expect(createSkillEmitter({ harness: "codex" }).emit({ skill: authoredSkill, context: codexSkillContext, markdown: "Run /aidlc and `/aidlc-replay`. Read /aidlc-state.md and .codex/tools/aidlc.ts." })).toEqual({ status: "ok", value: { entrypoint: ".agents/skills/aidlc-session-cost/SKILL.md", resources: [{ kind: "file", path: ".agents/skills/aidlc-session-cost/SKILL.md", body: "Run $aidlc and `$aidlc-replay`. Read /aidlc-state.md and .codex/tools/aidlc.ts." }, { kind: "file", path: ".agents/skills/aidlc-session-cost/agents/openai.yaml", body: "policy:\n  allow_implicit_invocation: false\n" }], discovery: { kind: "native-directory", root: ".agents/skills" }, modelInvocation: "disabled" } });
});
test("a factory bound to another harness refuses", () => {
  expect(createSkillEmitter({ harness: "codex" }).emit({ skill: authoredSkill, context: skillContext, markdown: "text" })).toEqual({ status: "invalid", findings: [{ code: "harness-mismatch", subject: "aidlc-session-cost", detail: "skill emitter for codex cannot emit claude" }] });
});
test("unimplemented invocation guards refuse rather than silently weaken the requested policy", () => {
  expect(createSkillEmitter({ harness: "claude" }).emit({ skill: authoredSkill, context: { ...skillContext, modelInvocation: "disabled" }, markdown: "text" })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "aidlc-session-cost", detail: "claude has no implemented native skill invocation guard in this slice" }] });
});
