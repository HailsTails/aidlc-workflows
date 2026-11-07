import { continuePreparation } from "./preparation-result.ts";
import type { DistributionSeed } from "../domain/distribution-artifact.ts";
import type { HarnessSettingsPreparer } from "../domain/harness-settings.ts";
import type { planPreparedRuntimeFiles } from "../domain/prepared-runtime-files.ts";
import type { DistributionAssemblyRules } from "./distribution-assembly.ts";
import { finding, type Outcome } from "../domain/model.ts";

export type HarnessSettingsPreparationRequest = { readonly sourceRoot: string; readonly root: string; readonly seed: DistributionSeed; readonly mode: number; readonly onboarding?: string };
export type HarnessSettingsServices = { readonly preparer: HarnessSettingsPreparer; readonly admit: typeof planPreparedRuntimeFiles; readonly rules: Pick<DistributionAssemblyRules, "path"> };
const admitPreparedSettingsContext = ({ request }: { readonly request: HarnessSettingsPreparationRequest }): Outcome<HarnessSettingsPreparationRequest> => !request.seed.inputPreparations?.some((preparation) => preparation.kind === "runtime-modules" && preparation.paths.includes(`${request.seed.binding.directory}/tools/aidlc.ts`))
  ? { status: "invalid", findings: [finding({ code: "capability-gap", subject: "harness-settings", detail: "harness settings require the source-prepared runtime dispatcher; permissions are not inferred from arbitrary files" })] }
  : { status: "ok", value: request };
export const prepareHarnessSettings = ({ request, services }: { readonly request: HarnessSettingsPreparationRequest; readonly services: HarnessSettingsServices }): Promise<Outcome<DistributionSeed>> => continuePreparation({ previous: admitPreparedSettingsContext({ request }), consume: ({ prepared: admitted }) => continuePreparation({
  previous: services.preparer.prepare({ sourceRoot: admitted.sourceRoot, root: admitted.root, basis: admitted.seed.basis, binding: admitted.seed.binding, invocation: admitted.seed.invocation, mode: admitted.mode, ...(admitted.seed.preparationStage === undefined ? {} : { preparationStage: admitted.seed.preparationStage }), files: admitted.seed.files.map((file) => file.path), ...(admitted.onboarding === undefined ? {} : { onboarding: admitted.onboarding }) }), consume: ({ prepared }) => continuePreparation({ previous: services.admit({ candidates: prepared.files, inventory: admitted.seed, rules: services.rules }), consume: ({ prepared: additions }) => ({ status: "ok", value: { ...admitted.seed, files: [...admitted.seed.files, ...additions.additions], inputPreparations: [...(admitted.seed.inputPreparations ?? []), prepared.preparation] } }) }),
}) });
