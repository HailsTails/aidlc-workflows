import { prepareHarnessSettings, type HarnessSettingsServices } from "../src/application/prepare-harness-settings.ts";
import { createSourceHarnessSettingsPreparer } from "../src/adapters/source-harness-settings.ts";
import { createDistributionAssemblyRules } from "../src/adapters/distribution-source.ts";
import { planPreparedRuntimeFiles } from "../src/domain/prepared-runtime-files.ts";
import type { PreparedDistributionSource } from "../src/adapters/prepared-distribution-source.ts";
import { continuePreparation } from "../src/application/preparation-result.ts";

export const createHarnessSettingsServices = (): HarnessSettingsServices => ({ preparer: createSourceHarnessSettingsPreparer(), admit: planPreparedRuntimeFiles, rules: createDistributionAssemblyRules() });
export const createHarnessSettingsDistributionSource = ({ source, mode, services = createHarnessSettingsServices(), prepare = prepareHarnessSettings }: { readonly source: PreparedDistributionSource; readonly mode: number; readonly services?: HarnessSettingsServices; readonly prepare?: typeof prepareHarnessSettings }): PreparedDistributionSource => ({ load: (request) => continuePreparation({ previous: source.load(request), consume: ({ prepared: seed }) => prepare({ request: { sourceRoot: request.location.sourceRoot, root: request.location.root, seed, mode }, services }) }) });
