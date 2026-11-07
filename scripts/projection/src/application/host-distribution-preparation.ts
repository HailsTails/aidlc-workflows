import type { ProjectionDistributionRequest } from "./projection-distribution-request.ts";
import type { ProjectionSet, ProjectedSetUnit } from "./projection-set.ts";
import type { DistributionRoot, PreparedHostRoot } from "../domain/prepared-host-root.ts";
import { admitPreparedHostRoot } from "../domain/prepared-host-root.ts";
import type { SourceOrigin } from "../domain/source-origin.ts";
import type { Outcome } from "../domain/model.ts";
import type { NativeResource } from "../domain/native-rendering.ts";

export type HostDistributionPreparer = { readonly prepare: (request: ProjectionDistributionRequest & { readonly root: string }) => Promise<Outcome<ProjectionDistributionRequest>> };
export function assembledProjectionRoot(request: ProjectionDistributionRequest): DistributionRoot {
  const files = request.seed.files.map(file => { const projected = request.projection.resources.find(resource => resource.path === file.path); return projected === undefined ? file : { ...file, bytes: new TextEncoder().encode(projected.body) }; });
  return { files: [...files, ...request.projection.resources.filter(resource => !files.some(file => file.path === resource.path)).map(resource => ({ path: resource.path, bytes: new TextEncoder().encode(resource.body), mode: request.mode }))], directories: request.seed.directories };
}
function retainProjection(projection: ProjectionSet, changed: ReadonlySet<string>): ProjectionSet {
  const keep = (resource: NativeResource) => !changed.has(resource.path);
  const units = projection.units.flatMap((unit): ProjectedSetUnit[] => {
    if (unit.kind !== "runners") { const resources = unit.projection.resources.filter(keep); return resources.length === 0 ? [] : [{ ...unit, projection: { ...unit.projection, resources } } as ProjectedSetUnit]; }
    const runners = unit.projection.runners.flatMap(runner => { const resources = runner.resources.filter(keep); return resources.length === 0 ? [] : [{ ...runner, resources }]; });
    return runners.length === 0 ? [] : [{ ...unit, projection: { ...unit.projection, runners, resources: unit.projection.resources.filter(keep) } }];
  });
  return { ...projection, units, resources: projection.resources.filter(keep) };
}
export function applyPreparedHostRoot({ request, before, prepared, origin }: { readonly request: ProjectionDistributionRequest; readonly before: DistributionRoot; readonly prepared: PreparedHostRoot; readonly origin: SourceOrigin }): Outcome<ProjectionDistributionRequest> {
  const admitted = admitPreparedHostRoot(before, prepared);
  if (admitted.status === "invalid") return admitted;
  const changed = new Set([...prepared.added, ...prepared.replaced, ...prepared.removed]);
  const files = prepared.files.filter(file => changed.has(file.path));
  const origins = [origin, ...prepared.inputs.filter(input => input.path !== origin.path).map(input => ({ ...request.seed.basis, path: input.path }))];
  const product = { key: "manifest-emission", owner: request.seed.basis, binding: request.seed.binding, inputs: origins, requiredByProducer: [], files };
  const { preparationStage: _completed, ...seed } = request.seed;
  const { files: _files, directories: _directories, inputs: _inputs, diagnostics, ...changes } = prepared;
  return { status: "ok", value: {
    ...request,
    seed: { ...seed, files: prepared.files, directories: prepared.directories, structure: { kind: "prepared-root", mode: request.seed.structure?.mode ?? 0o755 }, inputPreparations: [...(request.seed.inputPreparations ?? []), { kind: "host-emission", paths: [...prepared.added, ...prepared.replaced], inputs: prepared.inputs, changes, ...(diagnostics === undefined ? {} : { diagnostics }) }] },
    projection: retainProjection(request.projection, changed),
    preparedProducts: files.length === 0 ? [] : [product],
  } };
}
