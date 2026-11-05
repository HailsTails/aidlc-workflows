import type { GeneratedRunner, GeneratedRunnerProjection, GeneratedRunnerContext } from "../domain/generated-runner.ts";
import { finding, type Outcome } from "../domain/model.ts";
import { nativeSkillDiscovery, codexInvocationGuard } from "./skill-native-layout.ts";

export const emitGeneratedRunner = ({ runner, context }: { readonly runner: GeneratedRunner; readonly context: GeneratedRunnerContext }): Outcome<GeneratedRunnerProjection> => {
  if (runner.binding.harness !== context.harness || runner.binding.directory !== context.directory)
    return { status: "invalid", findings: [finding({ code: "harness-mismatch", subject: runner.name, detail: "generated runner text is already bound to its compiler's harness; regenerate it for this target" })] };
  const inlineGuardSupported = ["claude", "cursor", "copilot"].includes(context.harness);
  if (runner.frontmatterInvocation !== "unspecified" && !inlineGuardSupported)
    return { status: "invalid", findings: [finding({ code: "capability-gap", subject: runner.name, detail: "generated runner carries invocation frontmatter without a verified native encoding for this harness" })] };
  if (context.modelInvocation === "disabled" && runner.frontmatterInvocation === "enabled")
    return { status: "invalid", findings: [finding({ code: "capability-gap", subject: runner.name, detail: "generated runner explicitly enables model invocation; do not add a contradictory suppression policy" })] };
  if (context.modelInvocation === "disabled" && context.harness !== "codex" && runner.frontmatterInvocation !== "disabled")
    return { status: "invalid", findings: [finding({ code: "capability-gap", subject: runner.name, detail: "compiler-prepared runner does not carry the requested native invocation suppression" })] };
  const discovery = nativeSkillDiscovery[context.harness];
  const entrypoint = `${discovery.root}/${runner.name}/SKILL.md`;
  const resources = [{ kind: "file" as const, path: entrypoint, body: runner.markdown }, ...(context.harness === "codex" && context.modelInvocation === "disabled" ? [{ kind: "file" as const, path: `${discovery.root}/${runner.name}/agents/openai.yaml`, body: codexInvocationGuard }] : [])];
  return { status: "ok", value: { compiler: runner.compiler, owner: runner.owner, request: runner.request, harness: context.harness, entrypoint, resources, discovery, modelInvocation: context.modelInvocation === "disabled" || runner.frontmatterInvocation === "disabled" ? "disabled" : "native-default" } };
};
