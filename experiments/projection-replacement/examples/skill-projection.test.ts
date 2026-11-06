import { expect, test } from "bun:test";
import { skillSourceCases } from "../__tests__/skill-source-cases.ts";
import { successful } from "../__tests__/support.ts";
import { projectAuthoredSkill } from "./skill-projection.ts";
import { indentedSkillCase, duplicateSkillCase } from "../__tests__/skill-boundary-cases.ts";

test("composition: legitimate skill indentation preserves the actual native byte reference", () => {
  expect(successful(projectAuthoredSkill(indentedSkillCase)).resources).toEqual(indentedSkillCase.expected);
});
test("composition: conflicting skill invocation metadata refuses before native emission", () => {
  expect(projectAuthoredSkill(duplicateSkillCase)).toEqual({ status: "invalid", findings: [{ code: "invalid-input", subject: "frontmatter", detail: "expected valid YAML with unique mapping keys" }] });
});

test.each(skillSourceCases)("composition: $baseline $context.harness authored skill matches packaged native resources: $origin.path", (entry) => {
  const projected = successful(projectAuthoredSkill(entry));
  expect(projected.resources).toEqual(entry.expected);
  expect(projected.origin).toEqual(entry.origin);
});
