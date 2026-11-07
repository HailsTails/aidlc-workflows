import type { AuthoredSkill, SkillContext, SkillNativeEmitter, SkillProjection } from "./skill-definition.ts";
import { finding, pathStatus, type Outcome } from "./model.ts";
import { renderTokens, residue } from "./projection-content.ts";

export type SkillRenderingRules = { readonly text: typeof renderTokens; readonly residue: typeof residue; readonly path: typeof pathStatus };
export const createSkillRenderingRules = (): SkillRenderingRules => ({ text: renderTokens, residue, path: pathStatus });
export type SkillRenderer = { readonly render: (input: { readonly skill: AuthoredSkill; readonly context: SkillContext }) => Outcome<SkillProjection> };
export const createSkillRenderer = ({ emitter, rules = createSkillRenderingRules() }: { readonly emitter: SkillNativeEmitter; readonly rules?: SkillRenderingRules }): SkillRenderer => ({
  render: ({ skill, context }) => {
    if (context.invocation.trim().length === 0)
      return { status: "invalid", findings: [finding({ code: "invalid-invocation", subject: skill.name, detail: "skill projection requires an invocation" })] };
    const markdown = rules.text({ text: `---\n${skill.header}\n---\n${skill.body}`, contract: { harness: context.harness, harnessDir: context.directory, invocation: context.invocation, rulesSubdir: context.rulesSubdir, memoryRoot: context.memoryRoot } });
    const emitted = emitter.emit({ skill, context, markdown });
    if (emitted.status === "invalid") return emitted;
    if (!emitted.value.resources.some((resource) => resource.kind === "file" && resource.path === emitted.value.entrypoint))
      return { status: "invalid", findings: [finding({ code: "missing-body", subject: skill.name, detail: "native skill emission must include its declared SKILL.md entrypoint" })] };
    const findings = emitted.value.resources.flatMap((resource) => [
      ...(rules.path({ path: resource.path }) === "unsafe" ? [finding({ code: "invalid-destination", subject: resource.path, detail: "native skill resources require safe relative paths" })] : []),
      ...rules.residue({ text: resource.body, subject: resource.path }),
    ]);
    if (findings.length > 0) return { status: "invalid", findings };
    return { status: "ok", value: { ...emitted.value, origin: skill.origin, harness: context.harness, userInvocation: skill.userInvocation } };
  },
});
