import type { DistributionProduct } from "../domain/distribution-products.ts";
import type { DistributionFile } from "../domain/distribution-artifact.ts";
import type { ProjectionSet } from "./projection-set.ts";
import type { NativeResource } from "../domain/native-rendering.ts";
import type { SourceBasis } from "../domain/source-origin.ts";
import { finding, sourceKey, type Outcome } from "../domain/model.ts";
export type ProjectedProductRules = { readonly encode: (input: { readonly text: string }) => Uint8Array };
export const requiredProjectedRunnerPaths = ({ projection }: { readonly projection: ProjectionSet }): readonly string[] => projection.units.flatMap((unit) => unit.kind === "runners" ? unit.projection.runners.map((runner) => runner.entrypoint) : []);
const encodeProductFiles = ({ resources, mode, rules }: { readonly resources: readonly NativeResource[]; readonly mode: number; readonly rules: ProjectedProductRules }): readonly DistributionFile[] => resources.map((resource) => ({ path: resource.path, bytes: rules.encode({ text: resource.body }), mode }));
export const prepareProjectedProducts = ({ projection, sources, compiler, mode, rules }: { readonly projection: ProjectionSet; readonly sources: readonly SourceBasis[]; readonly compiler: SourceBasis; readonly mode: number; readonly rules: ProjectedProductRules }): Outcome<readonly DistributionProduct[]> => {
  const runners = projection.units.flatMap((unit) => unit.kind === "runners" ? unit.projection.runners : []);
  const products: readonly DistributionProduct[] = projection.units.flatMap((unit) => {
    if (unit.kind !== "runners") return [{ key: unit.key, owner: { source: unit.projection.origin.source, pin: unit.projection.origin.pin }, binding: projection.target, inputs: [unit.projection.origin, ...(unit.kind === "stage" || unit.kind === "guidance" || unit.kind === "harness-document" ? unit.projection.authoring : []), ...(unit.kind === "agent" || unit.kind === "compiled-agent" || unit.kind === "knowledge" || unit.kind === "sensor" || unit.kind === "skill" ? unit.projection.dependencies ?? [] : [])], requiredByProducer: unit.kind === "scope" || unit.kind === "stage" || unit.kind === "harness-document" ? unit.projection.resources.map((resource) => resource.path) : [], files: encodeProductFiles({ resources: unit.projection.resources, mode, rules }) }];
    return unit.projection.runners.flatMap((runner) => {
      const basis = sources.find((source) => sourceKey(source.source) === sourceKey(runner.owner));
      if (basis === undefined) return [];
      return [{ key: runner.entrypoint.split("/").at(-2) ?? "", owner: basis, binding: projection.target, inputs: [runner.compiler], requiredByProducer: [runner.entrypoint], files: encodeProductFiles({ resources: runner.resources, mode, rules }) }];
    });
  });
  const unboundRunners = runners.filter((runner) => sources.filter((basis) => sourceKey(basis.source) === sourceKey(runner.owner)).length !== 1);
  const resources = projection.units.flatMap((unit) => unit.kind === "runners" ? unit.projection.runners.flatMap((runner) => runner.resources) : unit.projection.resources);
  const findings = [
    ...unboundRunners.map((runner) => finding({ code: "foreign-content", subject: runner.entrypoint, detail: "declare exactly one plugin or core source basis; a compiler pin cannot supply runner ownership" })),
    ...runners.filter((runner) => sourceKey(runner.compiler.source) !== sourceKey(compiler.source) || runner.compiler.pin !== compiler.pin).map((runner) => finding({ code: "foreign-content", subject: runner.compiler.path, detail: "runner compiler must match the prepared seed's compiler source basis" })),
    ...resources.filter((resource) => resource.kind !== "file").map((resource) => finding({ code: "capability-gap", subject: resource.path, detail: "shared registration fragments need their native owner before becoming distribution products" })),
    ...(!Number.isInteger(mode) || mode < 0 || mode > 0o777 ? [finding({ code: "invalid-input", subject: "distribution-mode", detail: "projected text files require an explicit permission mode between 0 and 0777" })] : []),
  ];
  return findings.length > 0 ? { status: "invalid", findings } : { status: "ok", value: products };
};
