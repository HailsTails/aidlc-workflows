import type { SkillProjection } from "../src/domain/skill-definition.ts";
import type { Outcome } from "../src/domain/model.ts";
import { parseSkillSource } from "../src/adapters/skill-source.ts";
import { createSkillEmitter } from "../src/adapters/skill-emitter.ts";
import { createSkillRenderer } from "../src/domain/skill-rendering.ts";
import type { AuthoredSkillProjection } from "../src/application/surface-projection.ts";

export const projectAuthoredSkill = ({ text, origin, context }: AuthoredSkillProjection): Outcome<SkillProjection> => {
  const skill = parseSkillSource({ text, origin });
  if (skill.status === "invalid") return skill;
  return createSkillRenderer({ emitter: createSkillEmitter({ harness: context.harness }) }).render({ skill: skill.value, context });
};
