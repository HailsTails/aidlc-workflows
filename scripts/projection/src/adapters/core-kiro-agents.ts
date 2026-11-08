import type { DistributionDirectoryFactory } from "./distribution-directory.ts";
import { createNativeCompilerProcessOperations, type NativeCompilerProcessFactory } from "./native-compiler-process.ts";
import { readSourceKasPreparation } from "./source-kas-preparation.ts";
import { parseKasWorkerPolicy, createKasAgentEmitter } from "./kas-agent.ts";
import { readSourceKiroPreparation } from "./source-kiro-preparation.ts";
import { createKiroAgentEmitter, parseKiroAgentProfile, prepareKiroAgentProfile } from "./kiro-agent.ts";
import type { ProjectionSetRequest } from "../application/projection-set.ts";
import type { SourceBasis, SourceContentDigest } from "../domain/source-origin.ts";
import { finding, type Outcome } from "../domain/model.ts";

export function prepareCoreKiroAgents({ sourceRoot, workRoot, basis, selection, processes = createNativeCompilerProcessOperations, directories }: { readonly directories?: DistributionDirectoryFactory | undefined; readonly processes?: NativeCompilerProcessFactory; readonly sourceRoot: string; readonly workRoot?: string; readonly basis: SourceBasis; readonly selection: ProjectionSetRequest }): Outcome<{ readonly selection: ProjectionSetRequest; readonly inputs: readonly SourceContentDigest[]; readonly namespaceLiterals?: readonly { readonly path: string; readonly text: string }[] }> {
  if (selection.target.harness !== "kiro" && selection.target.harness !== "kiro-ide") return { status: "ok", value: { selection, inputs: [] } };
  const unit = selection.units[0];
  if (unit?.kind !== "compiled-agent" || selection.units.some(unit => unit.kind !== "compiled-agent")) return { status: "invalid", findings: [finding({ code: "capability-gap", subject: "core-kiro-agents", detail: "Kiro preparation requires complete compiled persona definitions" })] };
  if (workRoot === undefined) return { status: "invalid", findings: [finding({ code: "capability-gap", subject: "core-kiro-agents", detail: "Kiro source policy requires the assembly working root" })] };
  if (selection.target.harness === "kiro-ide") {
    const preparation = readSourceKasPreparation({ sourceRoot, workRoot, processes, directories, invocation: unit.input.context.invocation });
    if (preparation.status === "invalid") return preparation;
    const { agents, inputs } = preparation.value;
    if (agents.length !== selection.units.length || selection.units.some(unit => unit.kind !== "compiled-agent" || agents.filter(agent => agent.name === unit.input.agent.name).length !== 1)) return { status: "invalid", findings: [finding({ code: "foreign-content", subject: "core-kas-agents", detail: "KAS policies require exactly one qualified persona definition" })] };
    const units = [];
    for (const unit of selection.units) {
      if (unit.kind !== "compiled-agent") continue;
      const policy = parseKasWorkerPolicy({ input: agents.find(agent => agent.name === unit.input.agent.name)!.lines, name: unit.input.agent.name, origin: { ...basis, path: "harness/kiro-ide/manifest.ts" } });
      if (policy.status === "invalid") return policy;
      units.push({ ...unit, input: { ...unit.input, emitter: createKasAgentEmitter({ policy: policy.value, inlinePersona: unit.input.catalogue.stages.some(stage => (stage.mode === "inline" && (stage.lead === unit.input.agent.name || stage.supports.includes(unit.input.agent.name))) || (stage.mode === "mob" && stage.lead === unit.input.agent.name)) }) } });
    }
    return { status: "ok", value: { selection: { ...selection, units }, inputs, namespaceLiterals: agents.flatMap(agent => agent.namespaceLiteral === null ? [] : [{ path: `.kiro/agents/${agent.name}.md`, text: agent.namespaceLiteral }]) } };
  }
  const preparation = readSourceKiroPreparation({ sourceRoot, workRoot, processes, directories, invocation: unit.input.context.invocation });
  if (preparation.status === "invalid") return preparation;
  const { agents, shellCommands, sharedResources, hookSuffix, inputs } = preparation.value;
  if (agents.length !== selection.units.length || selection.units.some(unit => unit.kind !== "compiled-agent" || agents.filter(agent => agent.path === `harness/kiro/agents/${unit.input.agent.name}.json`).length !== 1)) return { status: "invalid", findings: [finding({ code: "foreign-content", subject: "core-kiro-agents", detail: "Kiro requires exactly one qualified native profile for every core persona" })] };
  const units = [];
  for (const unit of selection.units) {
    if (unit.kind !== "compiled-agent") continue;
    const source = agents.find(agent => agent.path === `harness/kiro/agents/${unit.input.agent.name}.json`)!;
    const parsed = parseKiroAgentProfile({ text: source.text, origin: { ...basis, path: source.path } });
    if (parsed.status === "invalid") return parsed;
    const prepared = prepareKiroAgentProfile({ profile: parsed.value, shellCommands, sharedResources, invocation: unit.input.context.invocation, hookSuffix });
    if (prepared.status === "invalid") return prepared;
    units.push({ ...unit, input: { ...unit.input, emitter: createKiroAgentEmitter({ profile: prepared.value, promptAdditions: source.additions }) } });
  }
  return { status: "ok", value: { selection: { ...selection, units }, inputs } };
}
