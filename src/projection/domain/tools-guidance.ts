import { accepted, refused, type Result } from "../../kernel/result.ts";
import type { OnboardingTemplates } from "./neutral-surface.ts";
import type { DistributionChannel } from "./projected-file.ts";

export type ToolsGuidanceSource = "legacy-authored" | "framework-tools";

const SLOT = "{{SLOT:framework_tools_runtime}}";

export const admitToolsGuidance = (source: ToolsGuidanceSource, skeleton: string): Result<ToolsGuidanceSource, string> =>
  source === "legacy-authored" || (source === "framework-tools" && skeleton.split(SLOT).length === 2) ? accepted(source)
    : refused("Declared framework Tools guidance requires exactly one {{SLOT:framework_tools_runtime}} marker.");

export const bindToolsGuidance = (templates: OnboardingTemplates, channel: DistributionChannel): OnboardingTemplates =>
  templates.toolsGuidance === "legacy-authored" ? templates
    : { ...templates, harnessSkeleton: templates.harnessSkeleton.replace(SLOT, channel === "copy"
      ? "TypeScript, run via bun" : "TypeScript sources invoked through the self-contained `aidlc` runtime") };
