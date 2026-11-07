import type { KnowledgeProjection } from "../domain/knowledge-definition.ts";
import type { SensorProjection, SensorProjectionInput } from "../domain/sensor-definition.ts";
import type { GuidanceProjection, GuidanceProjectionInput } from "../domain/core-guidance.ts";
import type { HarnessDocumentProjection, HarnessDocumentProjectionInput } from "../domain/harness-document.ts";
import type { AuthoredKnowledge } from "../domain/core-knowledge-sources.ts";
import type { AuthoredProseContext } from "../domain/authored-prose.ts";
import type { AgentDefinitionProjection, AuthoredSkillProjection, CompiledAgentProjectionRequest, GeneratedRunnerProjectionRequest, GeneratedRunnerSet } from "./surface-projection.ts";
import type { AgentProjection } from "../domain/agent-definition.ts";
import type { SkillProjection } from "../domain/skill-definition.ts";
import type { AuthoredScope, ScopeContext, ScopeProjection } from "../domain/scope-definition.ts";
import type { AuthoredStage, StageProjection, StageContext } from "../domain/stage-definition.ts";
import type { HarnessBinding } from "../domain/harness-binding.ts";
import type { NativeResource } from "../domain/native-rendering.ts";
import { collectNativeFiles } from "../domain/native-file-set.ts";
import { finding, pathStatus, type Outcome, type Finding } from "../domain/model.ts";
import { residue } from "../domain/projection-content.ts";

export type ProjectionSetUnit =
  | { readonly kind: "sensor"; readonly key: string; readonly input: SensorProjectionInput }
  | { readonly kind: "harness-document"; readonly key: string; readonly input: HarnessDocumentProjectionInput }
  | { readonly kind: "guidance"; readonly key: string; readonly input: GuidanceProjectionInput }
  | { readonly kind: "knowledge"; readonly key: string; readonly input: { readonly document: AuthoredKnowledge; readonly context: AuthoredProseContext } }
  | { readonly kind: "stage"; readonly key: string; readonly input: { readonly stage: AuthoredStage; readonly context: StageContext } }
  | { readonly kind: "scope"; readonly key: string; readonly input: { readonly scope: AuthoredScope; readonly context: ScopeContext } }
  | { readonly kind: "agent"; readonly key: string; readonly input: AgentDefinitionProjection }
  | { readonly kind: "compiled-agent"; readonly key: string; readonly input: CompiledAgentProjectionRequest }
  | { readonly kind: "skill"; readonly key: string; readonly input: AuthoredSkillProjection }
  | { readonly kind: "runners"; readonly key: string; readonly input: GeneratedRunnerProjectionRequest };
export type ProjectedSetUnit =
  | { readonly kind: "sensor"; readonly key: string; readonly projection: SensorProjection }
  | { readonly kind: "harness-document"; readonly key: string; readonly projection: HarnessDocumentProjection }
  | { readonly kind: "guidance"; readonly key: string; readonly projection: GuidanceProjection }
  | { readonly kind: "knowledge"; readonly key: string; readonly projection: KnowledgeProjection }
  | { readonly kind: "stage"; readonly key: string; readonly projection: StageProjection }
  | { readonly kind: "scope"; readonly key: string; readonly projection: ScopeProjection }
  | { readonly kind: "agent" | "compiled-agent"; readonly key: string; readonly projection: AgentProjection }
  | { readonly kind: "skill"; readonly key: string; readonly projection: SkillProjection }
  | { readonly kind: "runners"; readonly key: string; readonly projection: GeneratedRunnerSet };
export type ProjectionSet = { readonly scope: "selected-surfaces"; readonly target: HarnessBinding; readonly units: readonly ProjectedSetUnit[]; readonly resources: readonly NativeResource[] };
export type ProjectionSetRequest = { readonly units: readonly ProjectionSetUnit[]; readonly target: HarnessBinding };
export type ProjectionSetProjector = { readonly project: (input: ProjectionSetRequest) => Outcome<ProjectionSet> };
export type ProjectionSetServices = {
  readonly sensor: (input: SensorProjectionInput) => Outcome<SensorProjection>;
  readonly harnessDocument: (input: HarnessDocumentProjectionInput) => Outcome<HarnessDocumentProjection>;
  readonly guidance: (input: GuidanceProjectionInput) => Outcome<GuidanceProjection>;
  readonly knowledge: (input: { readonly document: AuthoredKnowledge; readonly context: AuthoredProseContext }) => Outcome<KnowledgeProjection>;
  readonly stage: (input: { readonly stage: AuthoredStage; readonly context: StageContext }) => Outcome<StageProjection>;
  readonly scope: (input: { readonly scope: AuthoredScope; readonly context: ScopeContext }) => Outcome<ScopeProjection>;
  readonly agent: (input: AgentDefinitionProjection) => Outcome<AgentProjection>;
  readonly compiledAgent: (input: CompiledAgentProjectionRequest) => Outcome<AgentProjection>;
  readonly skill: (input: AuthoredSkillProjection) => Outcome<SkillProjection>;
  readonly runners: (input: GeneratedRunnerProjectionRequest) => Outcome<GeneratedRunnerSet>;
};
export type ProjectionSetValidation = { readonly collect: typeof collectNativeFiles; readonly path: typeof pathStatus; readonly residue: typeof residue };
export const createProjectionSetValidation = (): ProjectionSetValidation => ({ collect: collectNativeFiles, path: pathStatus, residue });
const selectionFindings = ({ units, target }: { readonly units: readonly ProjectionSetUnit[]; readonly target: HarnessBinding }): readonly Finding[] => [
  ...(units.length === 0 ? [finding({ code: "invalid-input", subject: "projection-set", detail: "select at least one projection unit" })] : []),
  ...units.flatMap((unit, index) => [
    ...(!/^[a-z][a-z0-9-]*$/.test(unit.key) ? [finding({ code: "invalid-identifier", subject: unit.key, detail: "projection unit keys must be canonical identifiers" })] : []),
    ...(units.findIndex((candidate) => candidate.key === unit.key) !== index ? [finding({ code: "duplicate", subject: unit.key, detail: "projection unit keys must be unique" })] : []),
    ...(unit.input.context.harness !== target.harness || unit.input.context.directory !== target.directory ? [finding({ code: "harness-mismatch", subject: unit.key, detail: "every selected unit must target the assembly's harness binding" })] : []),
  ]),
];
const retainProjectedUnit = <Projection>({ projected, identify }: { readonly projected: Outcome<Projection>; readonly identify: (input: { readonly projection: Projection }) => ProjectedSetUnit }): Outcome<ProjectedSetUnit> => projected.status === "invalid" ? projected : { status: "ok", value: identify({ projection: projected.value }) };
const projectUnit = ({ unit, services }: { readonly unit: ProjectionSetUnit; readonly services: ProjectionSetServices }): Outcome<ProjectedSetUnit> => {
  switch (unit.kind) {
    case "sensor": return retainProjectedUnit({ projected: services.sensor(unit.input), identify: ({ projection }) => ({ kind: unit.kind, key: unit.key, projection }) });
    case "harness-document": return retainProjectedUnit({ projected: services.harnessDocument(unit.input), identify: ({ projection }) => ({ kind: unit.kind, key: unit.key, projection }) });
    case "guidance": return retainProjectedUnit({ projected: services.guidance(unit.input), identify: ({ projection }) => ({ kind: unit.kind, key: unit.key, projection }) });
    case "knowledge": return retainProjectedUnit({ projected: services.knowledge(unit.input), identify: ({ projection }) => ({ kind: unit.kind, key: unit.key, projection }) });
    case "stage": return retainProjectedUnit({ projected: services.stage(unit.input), identify: ({ projection }) => ({ kind: unit.kind, key: unit.key, projection }) });
    case "scope": return retainProjectedUnit({ projected: services.scope(unit.input), identify: ({ projection }) => ({ kind: unit.kind, key: unit.key, projection }) });
    case "agent": return retainProjectedUnit({ projected: services.agent(unit.input), identify: ({ projection }) => ({ kind: unit.kind, key: unit.key, projection }) });
    case "compiled-agent": return retainProjectedUnit({ projected: services.compiledAgent(unit.input), identify: ({ projection }) => ({ kind: unit.kind, key: unit.key, projection }) });
    case "skill": return retainProjectedUnit({ projected: services.skill(unit.input), identify: ({ projection }) => ({ kind: unit.kind, key: unit.key, projection }) });
    case "runners": return retainProjectedUnit({ projected: services.runners(unit.input), identify: ({ projection }) => ({ kind: unit.kind, key: unit.key, projection }) });
  }
};
const outputFindings = ({ unit, target }: { readonly unit: ProjectedSetUnit; readonly target: HarnessBinding }): readonly Finding[] => {
  const harnesses = unit.kind === "runners" ? unit.projection.runners.map((entry) => entry.harness) : [unit.projection.harness];
  return [
    ...(harnesses.some((harness) => harness !== target.harness) ? [finding({ code: "harness-mismatch", subject: unit.key, detail: "projected unit returned content for another harness" })] : []),
    ...(unit.projection.resources.length === 0 ? [finding({ code: "missing-body", subject: unit.key, detail: "a selected projection unit must produce native files" })] : []),
  ];
};
const assemble = ({ projected, target, validation }: { readonly projected: readonly Outcome<ProjectedSetUnit>[]; readonly target: HarnessBinding; readonly validation: ProjectionSetValidation }): Outcome<ProjectionSet> => {
  const failures = projected.flatMap((entry) => entry.status === "invalid" ? entry.findings : []);
  if (failures.length > 0) return { status: "invalid", findings: failures };
  const units = projected.flatMap((entry) => entry.status === "ok" ? [entry.value] : []);
  const invalidUnits = units.flatMap((unit) => outputFindings({ unit, target }));
  if (invalidUnits.length > 0) return { status: "invalid", findings: invalidUnits };
  const collected = validation.collect({ resources: units.flatMap((unit) => unit.projection.resources) });
  if (collected.status === "invalid") return collected;
  const findings = collected.value.flatMap((resource) => [
    ...(validation.path({ path: resource.path }) === "unsafe" ? [finding({ code: "invalid-destination", subject: resource.path, detail: "projection assembly requires safe relative file destinations" })] : []),
    ...validation.residue({ text: resource.body, subject: resource.path }),
  ]);
  if (findings.length > 0) return { status: "invalid", findings };
  return { status: "ok", value: { scope: "selected-surfaces", target, units, resources: collected.value } };
};
export const createProjectionSet = ({ services, validation = createProjectionSetValidation() }: { readonly services: ProjectionSetServices; readonly validation?: ProjectionSetValidation }): ProjectionSetProjector => ({
  project: ({ units, target }) => {
    const findings = selectionFindings({ units, target });
    if (findings.length > 0) return { status: "invalid", findings };
    return assemble({ projected: units.map((unit) => projectUnit({ unit, services })), target, validation });
  },
});
