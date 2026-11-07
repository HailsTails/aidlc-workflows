import { observeSourceDependencies } from "./source-input-contract.ts";
export { ordinarySourcePath as ordinaryCopilotPath, observeProductionInputs as observeCopilotProductionInputs, verifyProductionInputs as verifyCopilotProductionInputs } from "./source-input-contract.ts";
export const observeCopilotSettingsInputs = (sourceRoot: string) => observeSourceDependencies(sourceRoot, ["harness/copilot/settings.ts", "harness/copilot/manifest.ts", "core/templates/onboarding.md", "core/templates/onboarding-harness.md", "package.json", "bun.lock"]);
