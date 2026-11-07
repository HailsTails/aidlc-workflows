import { readSourceKiroPreparation } from "./source-kiro-preparation.ts";
import { createKiroAgentEmitter, parseKiroAgentProfile, prepareKiroAgentProfile } from "./kiro-agent.ts";
import type { ProjectionSetRequest } from "../application/projection-set.ts";
import type { SourceBasis, SourceContentDigest } from "../domain/source-origin.ts";
import { finding, type Outcome } from "../domain/model.ts";

export function prepareCoreKiroAgents({ sourceRoot, workRoot, basis, selection }: { readonly sourceRoot: string; readonly workRoot?: string; readonly basis: SourceBasis; readonly selection: ProjectionSetRequest }): Outcome<{ readonly selection: ProjectionSetRequest; readonly inputs: readonly SourceContentDigest[] }> {
  if (selection.target.harness !== "kiro") return { status: "ok", value: { selection, inputs: [] } };
  const unit = selection.units[0];
  if (unit?.kind !== "compiled-agent" || selection.units.some(unit => unit.kind !== "compiled-agent")) return { status: "invalid", findings: [finding({ code: "capability-gap", subject: "core-kiro-agents", detail: "Kiro preparation requires complete compiled persona definitions" })] };
  if (workRoot === undefined) return { status: "invalid", findings: [finding({ code: "capability-gap", subject: "core-kiro-agents", detail: "Kiro source policy requires the assembly working root" })] };
  const preparation = readSourceKiroPreparation({ sourceRoot, workRoot, invocation: unit.input.context.invocation });
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
