import { expect, mock, test } from "bun:test";
import { authoredSkill, skillContext, skillEmission, skillSourceText } from "../../__tests__/skill-fixtures.ts";
import { createSkillRenderer } from "./skill-rendering.ts";

test("rendering supplies canonical Markdown and preserves native discovery and invocation policy", () => {
  const text = mock().mockReturnValue("Projected text");
  const residue = mock().mockReturnValue([]);
  const path = mock().mockReturnValue("safe");
  const emit = mock().mockReturnValue({ status: "ok", value: skillEmission });
  expect(createSkillRenderer({ emitter: { emit }, rules: { text, residue, path } }).render({ skill: authoredSkill, context: skillContext })).toEqual({ status: "ok", value: { ...skillEmission, origin: authoredSkill.origin, harness: "claude", userInvocation: "enabled" } });
  expect(text).toHaveBeenCalledWith({ text: skillSourceText, contract: { harness: "claude", harnessDir: ".claude", invocation: "bun .claude/tools/aidlc.ts", rulesSubdir: "rules", memoryRoot: "aidlc/spaces/default/memory" } });
  expect(emit).toHaveBeenCalledWith({ skill: authoredSkill, context: skillContext, markdown: "Projected text" });
  expect(residue).toHaveBeenCalledWith({ text: "Native skill", subject: skillEmission.entrypoint });
});
test("a sidecar alone cannot hide a missing skill entrypoint", () => {
  const text = mock().mockReturnValue("text");
  const residue = mock();
  const path = mock();
  const emit = mock().mockReturnValue({ status: "ok", value: { ...skillEmission, resources: [] } });
  expect(createSkillRenderer({ emitter: { emit }, rules: { text, residue, path } }).render({ skill: authoredSkill, context: skillContext })).toEqual({ status: "invalid", findings: [{ code: "missing-body", subject: "aidlc-session-cost", detail: "native skill emission must include its declared SKILL.md entrypoint" }] });
  expect(residue).not.toHaveBeenCalled();
});
test("unsafe native destinations refuse the complete emission", () => {
  const text = mock().mockReturnValue("text");
  const residue = mock().mockReturnValue([]);
  const path = mock().mockReturnValue("unsafe");
  const emit = mock().mockReturnValue({ status: "ok", value: skillEmission });
  expect(createSkillRenderer({ emitter: { emit }, rules: { text, residue, path } }).render({ skill: authoredSkill, context: skillContext })).toEqual({ status: "invalid", findings: [{ code: "invalid-destination", subject: skillEmission.entrypoint, detail: "native skill resources require safe relative paths" }] });
});
test("native refusals propagate before resource validation", () => {
  const text = mock().mockReturnValue("text");
  const residue = mock();
  const path = mock();
  const refusal = { status: "invalid", findings: [{ code: "capability-gap", subject: "aidlc-session-cost", detail: "native skill policy unavailable" }] } as const;
  const emit = mock().mockReturnValue(refusal);
  expect(createSkillRenderer({ emitter: { emit }, rules: { text, residue, path } }).render({ skill: authoredSkill, context: skillContext })).toEqual(refusal);
  expect(path).not.toHaveBeenCalled();
});
test("unresolved native tokens refuse the complete emission", () => {
  const text = mock().mockReturnValue("text");
  const refusal = { code: "unresolved-token", subject: skillEmission.entrypoint, detail: "{{INVOKE}} at line 1" } as const;
  const residue = mock().mockReturnValue([refusal]);
  const path = mock().mockReturnValue("safe");
  const emit = mock().mockReturnValue({ status: "ok", value: skillEmission });
  expect(createSkillRenderer({ emitter: { emit }, rules: { text, residue, path } }).render({ skill: authoredSkill, context: skillContext })).toEqual({ status: "invalid", findings: [refusal] });
});
test("empty invocation refuses before text or native work", () => {
  const text = mock();
  const residue = mock();
  const path = mock();
  const emit = mock();
  expect(createSkillRenderer({ emitter: { emit }, rules: { text, residue, path } }).render({ skill: authoredSkill, context: { ...skillContext, invocation: " " } })).toEqual({ status: "invalid", findings: [{ code: "invalid-invocation", subject: "aidlc-session-cost", detail: "skill projection requires an invocation" }] });
  expect(emit).not.toHaveBeenCalled();
  expect(text).not.toHaveBeenCalled();
});
