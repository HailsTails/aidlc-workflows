import type { ProjectionSet } from "./projection-set.ts";
import type { DistributionSeed } from "../domain/distribution-artifact.ts";
import { planPreparedFileAdditions } from "../domain/prepared-file-additions.ts";
import { finding, sourceKey, type Outcome, type pathStatus } from "../domain/model.ts";
import { collectNativeFiles } from "../domain/native-file-set.ts";
export type PreparedWorkflowDefinitions = { readonly seed: DistributionSeed; readonly projection: ProjectionSet };
export const prepareWorkflowDefinitions = ({ seed, projection, mode, rules }: { readonly seed: DistributionSeed; readonly projection: ProjectionSet; readonly mode: number; readonly rules: { readonly path: typeof pathStatus; readonly encode: (input: { readonly text: string }) => Uint8Array } }): Outcome<PreparedWorkflowDefinitions> => {
  if (seed.basis.source.kind !== "core" || projection.target.harness !== seed.binding.harness || projection.target.directory !== seed.binding.directory || projection.units.length === 0 || projection.units.some((unit) => unit.kind !== "scope" && unit.kind !== "stage" || unit.projection.harness !== seed.binding.harness || sourceKey(unit.projection.origin.source) !== sourceKey(seed.basis.source) || unit.projection.origin.pin !== seed.basis.pin)) return { status: "invalid", findings: [finding({ code: "foreign-content", subject: "workflow-definitions", detail: "workflow definition preparation requires nonempty projected stages or scopes matching the core runtime source basis and binding" })] };
  const admitted = planPreparedFileAdditions({ candidates: projection.resources, inventory: seed, mode, rules });
  return admitted.status === "invalid" ? admitted : { status: "ok", value: { seed: { ...seed, files: [...seed.files, ...admitted.value.additions] }, projection } };
};
export const mergeWorkflowDefinitions = ({ first, second }: { readonly first: ProjectionSet; readonly second: ProjectionSet }): Outcome<ProjectionSet> => {
  if (first.target.harness !== second.target.harness || first.target.directory !== second.target.directory || [...first.units, ...second.units].some((unit) => unit.kind !== "scope" && unit.kind !== "stage")) return { status: "invalid", findings: [finding({ code: "foreign-content", subject: "workflow-definitions", detail: "combine only authored stage/scope projections for the same harness binding" })] };
  const collected = collectNativeFiles({ resources: [...first.resources, ...second.resources] });
  return collected.status === "invalid" ? collected : { status: "ok", value: { scope: "selected-surfaces", target: first.target, units: [...first.units, ...second.units], resources: collected.value } };
};
