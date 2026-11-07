import type { PreparedDistributionSource } from "./prepared-distribution-source.ts";
import type { RuntimeInputPreparer } from "../domain/runtime-inputs.ts";
import { planPreparedRuntimeFiles } from "../domain/prepared-runtime-files.ts";
import { createDistributionAssemblyRules } from "./distribution-source.ts";
import type { DistributionAssemblyRules } from "../application/distribution-assembly.ts";
export const createPreparedInputDistributionSource = ({ source, mode, preparer, admit = planPreparedRuntimeFiles, rules = createDistributionAssemblyRules() }: { readonly source: PreparedDistributionSource; readonly mode: number; readonly preparer: RuntimeInputPreparer; readonly admit?: typeof planPreparedRuntimeFiles; readonly rules?: Pick<DistributionAssemblyRules, "path"> }): PreparedDistributionSource => ({ load: async (request) => {
  const seed = await source.load(request);
  if (seed.status === "invalid") return seed;
  const prepared = await preparer.prepare({ sourceRoot: request.location.sourceRoot, root: request.location.root, basis: seed.value.basis, binding: seed.value.binding, invocation: seed.value.invocation, mode, ...(seed.value.preparationStage === undefined ? {} : { preparationStage: seed.value.preparationStage }) });
  if (prepared.status === "invalid") return prepared;
  const admitted = admit({ candidates: prepared.value.files, inventory: seed.value, rules });
  return admitted.status === "invalid" ? admitted : { status: "ok", value: { ...seed.value, files: [...seed.value.files, ...admitted.value.additions], inputPreparations: [...(seed.value.inputPreparations ?? []), prepared.value.preparation] } };
} });
