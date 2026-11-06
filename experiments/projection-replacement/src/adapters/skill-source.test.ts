import { expect, mock, test } from "bun:test";
import { authoredSkill, skillDecoded, skillOrigin, skillFrame, safeSkillPaths } from "../../__tests__/skill-fixtures.ts";
import { parseSkillSource } from "./skill-source.ts";

test("skill metadata is decoded once by its reader and becomes a separate authored model", () => {
  const read = mock().mockReturnValue({ status: "ok", value: skillFrame });
  expect(parseSkillSource({ text: "authored text", origin: skillOrigin, reader: { read }, rules: safeSkillPaths })).toEqual({ status: "ok", value: authoredSkill });
  expect(read).toHaveBeenCalledWith({ text: "authored text" });
  expect(read).toHaveBeenCalledTimes(1);
});
test("classification labels stay annotations and do not create permission behavior", () => {
  const read = mock().mockReturnValue({ status: "ok", value: { ...skillFrame, decoded: { ...skillDecoded, classification: "custom-audit" }, body: "Write OUTCOMES.md." } });
  expect(parseSkillSource({ text: "source", origin: skillOrigin, reader: { read }, rules: safeSkillPaths })).toEqual({ status: "ok", value: { ...authoredSkill, classification: "custom-audit", body: "Write OUTCOMES.md." } });
});
test.each([
  { decoded: { ...skillDecoded, name: "../escape" }, field: "name" },
  { decoded: { ...skillDecoded, description: "" }, field: "description" },
  { decoded: { ...skillDecoded, "user-invocable": "true" }, field: "user-invocable" },
  { decoded: { ...skillDecoded, classification: 42 }, field: "classification" },
])("unsupported skill metadata refuses with a specific boundary finding: $field", ({ decoded, field }) => {
  const read = mock().mockReturnValue({ status: "ok", value: { ...skillFrame, decoded } });
  expect(parseSkillSource({ text: "source", origin: skillOrigin, reader: { read }, rules: safeSkillPaths })).toEqual({ status: "invalid", findings: [{ code: "invalid-input", subject: skillOrigin.path, detail: expect.stringContaining(field) }] });
});
test("unverified native permission fields are unavailable rather than silently copied", () => {
  const read = mock().mockReturnValue({ status: "ok", value: { ...skillFrame, decoded: { ...skillDecoded, "allowed-tools": "Bash" } } });
  expect(parseSkillSource({ text: "source", origin: skillOrigin, reader: { read }, rules: safeSkillPaths })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: skillOrigin.path, detail: "unsupported authored skill metadata: allowed-tools; provide a verified native policy before projecting these fields" }] });
});
test("absent optional annotations remain unknown or native-default instead of invented", () => {
  const header = "name: aidlc-session-cost\ndescription: Report";
  const read = mock().mockReturnValue({ status: "ok", value: { ...skillFrame, header, decoded: { name: "aidlc-session-cost", description: "Report" } } });
  expect(parseSkillSource({ text: "source", origin: skillOrigin, reader: { read }, rules: safeSkillPaths })).toEqual({ status: "ok", value: { ...authoredSkill, header, description: "Report", argumentHint: null, classification: null, userInvocation: "native-default" } });
});
test.each(["core/skills/other/SKILL.md", "plugins/demo/skills/aidlc-session-cost/SKILL.md", "core/skills/aidlc-session-cost/skill.md"])("a native skill name cannot escape its source path: %s", (path) => {
  const read = mock().mockReturnValue({ status: "ok", value: skillFrame });
  expect(parseSkillSource({ text: "source", origin: { ...skillOrigin, path }, reader: { read }, rules: safeSkillPaths })).toEqual({ status: "invalid", findings: [{ code: "invalid-path", subject: path, detail: "skill path must agree with its source owner and authored name" }] });
});
test("owned plugin paths use the supplied owner without invented plugin frontmatter", () => {
  const origin = { ...skillOrigin, source: { kind: "plugin", id: "demo" } as const, path: "plugins/demo/skills/aidlc-session-cost/SKILL.md" };
  const read = mock().mockReturnValue({ status: "ok", value: skillFrame });
  expect(parseSkillSource({ text: "source", origin, reader: { read }, rules: safeSkillPaths })).toEqual({ status: "ok", value: { ...authoredSkill, origin } });
});
test("reader refusals propagate without decoding again", () => {
  const refusal = { status: "invalid", findings: [{ code: "invalid-input", subject: "frontmatter", detail: "duplicate YAML key" }] } as const;
  const read = mock().mockReturnValue(refusal);
  expect(parseSkillSource({ text: "source", origin: skillOrigin, reader: { read }, rules: safeSkillPaths })).toEqual(refusal);
});
