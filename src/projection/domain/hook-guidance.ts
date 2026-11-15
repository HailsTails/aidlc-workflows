import { accepted, refused, type Result } from "../../kernel/result.ts";
import type { OnboardingFills } from "./neutral-surface.ts";
import type { DistributionChannel } from "./projected-file.ts";

export type HookGuidanceSource = "legacy-authored" | "framework-hooks";

const SLOT = "{{SLOT:framework_hook_runtime}}";
const COPY = "- **Hook permissions**: All 17 hooks are TypeScript (`.ts`) and run via `bun`. No executable bits required — works identically on macOS, Linux, and native Windows PowerShell.";
const NATIVE = "- **Hook permissions**: Framework hooks run through the self-contained `aidlc` binary. No separate script runtime or executable bits are required.";

export const admitHookGuidance = (source: HookGuidanceSource, skeleton: string): Result<HookGuidanceSource, string> =>
  source === "legacy-authored" || (source === "framework-hooks" && skeleton.split(SLOT).length === 2) ? accepted(source)
    : refused("Declared framework Hook guidance requires exactly one {{SLOT:framework_hook_runtime}} marker.");

export const hookGuidanceFills = (source: HookGuidanceSource, channel: DistributionChannel,
  fills: OnboardingFills): OnboardingFills => source === "legacy-authored" ? fills
  : { ...fills, slots: { ...fills.slots, framework_hook_runtime: channel === "copy" ? COPY : NATIVE } };
