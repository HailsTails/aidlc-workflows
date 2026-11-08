import type { DistributionDirectoryFactory } from "../src/adapters/distribution-directory.ts";
import type { Tier } from "../src/domain/model.ts";
import { createNativeCompilerProcessOperations, type NativeCompilerProcessFactory } from "../src/adapters/native-compiler-process.ts";
import { qualifiedHarnessProfile } from "../src/adapters/qualified-harness-profile.ts";
import { mergeSourceDigests } from "../src/domain/source-origin.ts";
import { prepareHarnessSettings, type HarnessSettingsServices } from "../src/application/prepare-harness-settings.ts";
import { createSourceHarnessSettingsPreparer } from "../src/adapters/source-harness-settings.ts";
import { createDistributionAssemblyRules } from "../src/adapters/distribution-source.ts";
import { planPreparedRuntimeFiles } from "../src/domain/prepared-runtime-files.ts";
import type { PreparedDistributionSource } from "../src/adapters/prepared-distribution-source.ts";
import { continuePreparation } from "../src/application/preparation-result.ts";

export const createHarnessSettingsServices = (environmentCap: Tier | null = null, { processes = createNativeCompilerProcessOperations, directories }: { readonly processes?: NativeCompilerProcessFactory; readonly directories?: DistributionDirectoryFactory | undefined } = {}): HarnessSettingsServices => ({ preparer: createSourceHarnessSettingsPreparer({ environmentCap, processes, directories }), admit: planPreparedRuntimeFiles, rules: createDistributionAssemblyRules() });
import type { OnboardingPreparer } from "../src/adapters/onboarding-source.ts";
import { finding } from "../src/domain/model.ts";

export const createHarnessSettingsDistributionSource = ({ source, mode, onboarding, environmentCap = null, processes = createNativeCompilerProcessOperations, directories, services = createHarnessSettingsServices(environmentCap, { processes, directories }), prepare = prepareHarnessSettings }: { readonly source: PreparedDistributionSource; readonly mode: number; readonly onboarding?: OnboardingPreparer; readonly environmentCap?: Tier | null; readonly processes?: NativeCompilerProcessFactory; readonly directories?: DistributionDirectoryFactory | undefined; readonly services?: HarnessSettingsServices; readonly prepare?: typeof prepareHarnessSettings }): PreparedDistributionSource => ({ load: (request) => continuePreparation({ previous: source.load(request), consume: async ({ prepared: seed }) => {
  const base = { sourceRoot: request.location.sourceRoot, root: request.location.root, seed, mode };
  const onboardingPath = qualifiedHarnessProfile(seed.binding)?.settingsOnboardingPath;
  if (onboardingPath === null || onboardingPath === undefined) return prepare({ request: base, services });
  if (onboarding === undefined) return { status: "invalid", findings: [finding({ code: "capability-gap", subject: "harness-settings", detail: "Codex settings require the assembly's shared onboarding preparation" })] };
  return continuePreparation({ previous: onboarding.prepare({ sourceRoot: base.sourceRoot, workRoot: base.root, basis: seed.basis, context: { ...seed.binding, invocation: seed.invocation, rulesSubdir: seed.rulesSubdir } }), consume: ({ prepared }) => {
    const documents = prepared.documents.filter(document => document.destination === onboardingPath);
    if (documents.length !== 1) return { status: "invalid", findings: [finding({ code: "foreign-content", subject: "harness-settings", detail: "Codex settings require exactly one prepared native onboarding document" })] };
    return continuePreparation({ previous: prepare({ request: { ...base, onboarding: documents[0]!.text }, services }), consume: ({ prepared: result }) => {
      const preparations = result.inputPreparations ?? [];
      const settings = preparations.findLast(preparation => preparation.kind === "harness-settings");
      if (settings === undefined) return { status: "invalid", findings: [finding({ code: "foreign-content", subject: "harness-settings", detail: "prepared host settings must retain their source evidence" })] };
      const inputs = mergeSourceDigests({ groups: [settings.inputs, prepared.inputs] });
      return inputs.status === "invalid" ? inputs : { status: "ok", value: { ...result, inputPreparations: preparations.map(preparation => preparation === settings ? { ...settings, inputs: inputs.value } : preparation) } };
    } });
  } });
} }) });
