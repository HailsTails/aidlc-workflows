import { brand, type Brand } from "../../kernel/brand.ts";
import { accepted, refused, type Result } from "../../kernel/result.ts";
import type { OnboardingTemplates } from "./neutral-surface.ts";
import type { DistributionChannel } from "./projected-file.ts";

export type HookGuidanceSource = "legacy-authored" | "framework-hooks";
export type ToolsGuidanceSource = "legacy-authored" | "framework-tools";
export type AuthoredOnboardingSource = OnboardingTemplates & {
  readonly hookGuidance: HookGuidanceSource;
  readonly toolsGuidance: ToolsGuidanceSource;
};
export type AdmittedOnboardingTemplates = Brand<Readonly<AuthoredOnboardingSource>, "AdmittedOnboardingTemplates">;

const HOOK_SLOT = "{{SLOT:framework_hook_runtime}}";
const TOOLS_SLOT = "{{SLOT:framework_tools_runtime}}";
const HOOK_COPY = "- **Hook permissions**: All 17 hooks are TypeScript (`.ts`) and run via `bun`. No executable bits required — works identically on macOS, Linux, and native Windows PowerShell.";
const HOOK_NATIVE = "- **Hook permissions**: Framework hooks run through the self-contained `aidlc` binary. No separate script runtime or executable bits are required.";

export const admitOnboardingSource = (source: AuthoredOnboardingSource): Result<AdmittedOnboardingTemplates, string> => {
  if (!(source.hookGuidance === "legacy-authored" || (source.hookGuidance === "framework-hooks" && source.harnessSkeleton.split(HOOK_SLOT).length === 2))) {
    return refused("Declared framework Hook guidance requires exactly one {{SLOT:framework_hook_runtime}} marker.");
  }
  if (!(source.toolsGuidance === "legacy-authored" || (source.toolsGuidance === "framework-tools" && source.harnessSkeleton.split(TOOLS_SLOT).length === 2))) {
    return refused("Declared framework Tools guidance requires exactly one {{SLOT:framework_tools_runtime}} marker.");
  }
  return accepted(brand<AdmittedOnboardingTemplates>(Object.freeze({ neutral: source.neutral,
    harnessSkeleton: source.harnessSkeleton, hookGuidance: source.hookGuidance, toolsGuidance: source.toolsGuidance })));
};

export const bindOnboardingSource = (source: AdmittedOnboardingTemplates, channel: DistributionChannel): OnboardingTemplates => {
  if (source.hookGuidance === "legacy-authored" && source.toolsGuidance === "legacy-authored") return source;
  const hooks = source.hookGuidance === "framework-hooks" ? source.harnessSkeleton.replace(HOOK_SLOT,
    channel === "copy" ? HOOK_COPY : HOOK_NATIVE) : source.harnessSkeleton;
  return { neutral: source.neutral, harnessSkeleton: source.toolsGuidance === "framework-tools" ? hooks.replace(TOOLS_SLOT,
    channel === "copy" ? "TypeScript, run via bun" : "TypeScript sources invoked through the self-contained `aidlc` runtime") : hooks };
};
