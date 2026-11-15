import { expect, test } from "bun:test";
import { accepted, refused } from "../../kernel/result.ts";
import { admitToolsGuidance, bindToolsGuidance } from "./tools-guidance.ts";
import { renderOnboarding } from "./onboarding.ts";

test.each(["TypeScript, run via bun", "{{SLOT:framework_tools_runtime}}", "{{SLOT:framework_tools_runtime}}{{SLOT:framework_tools_runtime}}"])(
  "legacy admission leaves %s uninterpreted", (skeleton) => {
    expect(admitToolsGuidance("legacy-authored", skeleton)).toEqual(accepted("legacy-authored"));
  });
test.each(["{{SLOT:framework_hook_runtime}}", "{{SLOT:framework_tools_runtime}", "{{SLOT:framework_tools_runtime}}{{SLOT:framework_tools_runtime}}"])(
  "declared Tools refuses missing, malformed or duplicate position: %s", (skeleton) => {
    expect(admitToolsGuidance("framework-tools", skeleton)).toEqual(refused(
      "Declared framework Tools guidance requires exactly one {{SLOT:framework_tools_runtime}} marker."));
  });
test("declared Tools admits its exact position without changing surrounding raw bytes", () => {
  expect(admitToolsGuidance("framework-tools", "Before\r\n{{SLOT:framework_tools_runtime}}\r\nAfter"))
    .toEqual(accepted("framework-tools"));
});
test.each(["copy", "native"] as const)("legacy %s preserves raw template identity without interpreting its Tools marker", (channel) => {
  const templates = { neutral: "N", harnessSkeleton: "{{SLOT:framework_tools_runtime}}",
    hookGuidance: "legacy-authored" as const, toolsGuidance: "legacy-authored" as const };
  expect(bindToolsGuidance(templates, channel)).toBe(templates);
});
test("declared copy binds only its captured position and preserves other raw markers", () => {
  expect(bindToolsGuidance({ neutral: "N", harnessSkeleton: "{{SLOT:framework_hook_runtime}}\r\n({{SLOT:framework_tools_runtime}}) {{SKILL_INVOKE}}",
    hookGuidance: "legacy-authored", toolsGuidance: "framework-tools" }, "copy"))
    .toEqual({ neutral: "N", harnessSkeleton: "{{SLOT:framework_hook_runtime}}\r\n(TypeScript, run via bun) {{SKILL_INVOKE}}",
      hookGuidance: "legacy-authored", toolsGuidance: "framework-tools" });
});
test("declared native leaves the original cached raw template unchanged", () => {
  const templates = { neutral: "N", harnessSkeleton: "({{SLOT:framework_tools_runtime}})",
    hookGuidance: "framework-hooks" as const, toolsGuidance: "framework-tools" as const };
  expect(bindToolsGuidance(templates, "native")).toEqual({ neutral: "N",
    harnessSkeleton: "(TypeScript sources invoked through the self-contained `aidlc` runtime)",
    hookGuidance: "framework-hooks", toolsGuidance: "framework-tools" });
  expect(templates.harnessSkeleton).toBe("({{SLOT:framework_tools_runtime}})");
});
test("custom host fills cannot gain new authority from a declared Tools marker", () => {
  const bound = bindToolsGuidance({ neutral: "N", harnessSkeleton: "{{SLOT:title_block}}\n({{SLOT:framework_tools_runtime}})",
    hookGuidance: "legacy-authored", toolsGuidance: "framework-tools" }, "copy");
  expect(renderOnboarding(bound.harnessSkeleton, { invoke: "/custom", slots: { title_block: "{{SLOT:framework_tools_runtime}}" } }))
    .toEqual(refused('onboarding render incomplete: marker {{SLOT:framework_tools_runtime}} survived for invoke="/custom". Every {{SLOT:...}} the skeleton declares must be fillable.'));
});
