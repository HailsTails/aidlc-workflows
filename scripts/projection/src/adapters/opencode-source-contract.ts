import { observeSourceDependencies } from "./source-input-contract.ts";
export const observeOpenCodeInputs = (sourceRoot: string) => observeSourceDependencies(sourceRoot, [
  "harness/opencode/settings.ts", "harness/opencode/manifest.ts", "harness/opencode/plugin/aidlc-opencode-adapter.ts", "harness/opencode/command/aidlc.md", "harness/opencode/opencode.json",
  "scripts/projection/src/adapters/qualified-delivery-policy.ts", "scripts/projection/src/adapters/qualified-harness-profile.ts", "scripts/projection/src/adapters/plain-source-data.ts", "scripts/projection/src/adapters/manifest-capabilities.ts",
  "core/templates/onboarding.md", "core/templates/onboarding-harness.md", "package.json", "bun.lock",
]);
