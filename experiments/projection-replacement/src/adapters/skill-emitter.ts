import type { Harness } from "../domain/harness-binding.ts";
import type { SkillNativeEmitter } from "../domain/skill-definition.ts";
import { finding } from "../domain/model.ts";
import { nativeSkillDiscovery, codexInvocationGuard } from "./skill-native-layout.ts";
export const createSkillEmitter = ({ harness }: { readonly harness: Harness }): SkillNativeEmitter => ({
  emit: ({ skill, context, markdown }) => {
    if (context.harness !== harness)
      return { status: "invalid", findings: [finding({ code: "harness-mismatch", subject: skill.name, detail: `skill emitter for ${harness} cannot emit ${context.harness}` })] };
    if (context.modelInvocation === "disabled" && harness !== "codex")
      return { status: "invalid", findings: [finding({ code: "capability-gap", subject: skill.name, detail: `${harness} has no implemented native skill invocation guard in this slice` })] };
    const discovery = nativeSkillDiscovery[harness];
    const root = discovery.root;
    const entrypoint = `${root}/${skill.name}/SKILL.md`;
    const skillText = harness === "codex" ? markdown.replace(/(^|[\s(`"])\/(aidlc(?:-[a-z][a-z0-9-]*)?)(?![a-z0-9-]*\.[a-z])/gm, "$1$$$2") : markdown;
    const resources = [
      { kind: "file" as const, path: entrypoint, body: skillText },
      ...(context.modelInvocation === "disabled" ? [{ kind: "file" as const, path: `${root}/${skill.name}/agents/openai.yaml`, body: codexInvocationGuard }] : []),
    ];
    return { status: "ok", value: { entrypoint, resources, discovery, modelInvocation: context.modelInvocation } };
  },
});
