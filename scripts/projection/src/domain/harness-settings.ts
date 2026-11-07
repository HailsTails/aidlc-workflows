import type { RuntimeInputRequest, PreparedInputEvidence } from "./runtime-inputs.ts";
import type { DistributionFile } from "./distribution-artifact.ts";
import type { Outcome } from "./model.ts";
export type HarnessSettingsRequest = RuntimeInputRequest & { readonly invocation: string; readonly files: readonly string[]; readonly onboarding?: string };
export type PreparedHarnessSettings = { readonly files: readonly DistributionFile[]; readonly preparation: PreparedInputEvidence & { readonly kind: "harness-settings" } };
export type HarnessSettingsPreparer = { readonly prepare: (input: HarnessSettingsRequest) => Promise<Outcome<PreparedHarnessSettings>> };
export const claudeSettingsPaths = (): readonly string[] => [".claude/settings.json", ".claude/settings.local.json.example"];

export const codexSettingsPaths = (): readonly string[] => [".codex/hooks.json", ".codex/config.toml", ".codex/rules/default.rules", ".codex/trust-seed.toml"];

export const cursorSettingsPaths = (): readonly string[] => [".cursor/hooks.json", ".cursor/cli.json"];
