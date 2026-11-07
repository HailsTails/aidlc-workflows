import { prepareCoreMethodRuntime } from "./core-method-runtime.ts";
import { planPreparedRuntimeFiles } from "../src/domain/prepared-runtime-files.ts";
import { createDistributionAssemblyRules } from "../src/adapters/distribution-source.ts";
import type { DistributionSeed } from "../src/domain/distribution-artifact.ts";
import type { SourceContentDigest } from "../src/domain/source-origin.ts";
import type { Outcome, pathStatus } from "../src/domain/model.ts";
export type AuthoredMethodRuntimePreparation = { readonly kind: "prepared"; readonly paths: readonly string[]; readonly inputs: readonly SourceContentDigest[] };
export type MethodRuntimePreparation = { readonly kind: "native-supplied" } | AuthoredMethodRuntimePreparation;
export type PreparedMethodRuntimeSeed = { readonly seed: DistributionSeed; readonly preparation: AuthoredMethodRuntimePreparation };
export type MethodRuntimeServices = { readonly prepare: typeof prepareCoreMethodRuntime; readonly admit: typeof planPreparedRuntimeFiles; readonly rules: { readonly path: typeof pathStatus } };
export const createMethodRuntimeServices = (): MethodRuntimeServices => ({ prepare: prepareCoreMethodRuntime, admit: planPreparedRuntimeFiles, rules: { path: createDistributionAssemblyRules().path } });
export const prepareAuthoredMethodRuntime = async ({ sourceRoot, seed, mode, services = createMethodRuntimeServices() }: { readonly sourceRoot: string; readonly seed: DistributionSeed; readonly mode: number; readonly services?: MethodRuntimeServices }): Promise<Outcome<PreparedMethodRuntimeSeed>> => {
  const prepared = await services.prepare({ sourceRoot, basis: seed.basis, context: { ...seed.binding, invocation: seed.invocation, rulesSubdir: seed.rulesSubdir }, mode });
  if (prepared.status === "invalid") return prepared;
  const admitted = services.admit({ candidates: prepared.value.files, inventory: seed, rules: services.rules });
  return admitted.status === "invalid" ? admitted : { status: "ok", value: { seed: { ...seed, files: [...seed.files, ...admitted.value.additions] }, preparation: { kind: "prepared", paths: prepared.value.files.map((file) => file.path), inputs: prepared.value.inputs } } };
};
