import { expect, test } from "bun:test";
import { accept } from "../../kernel/fixtures/accept.ts";
import { refused } from "../../kernel/result.ts";
import { admitOnboardingSource, bindOnboardingSource } from "./onboarding-source.ts";
import { renderOnboarding } from "./onboarding.ts";

test.each(["Custom", "{{SLOT:framework_hook_runtime}}", "{{SLOT:framework_tools_runtime}}{{SLOT:framework_tools_runtime}}"])(
  "legacy source admits exact raw text without promoting markers: %s", (harnessSkeleton) => {
    expect(accept(admitOnboardingSource({ neutral: "Neutral", harnessSkeleton, hookGuidance: "legacy-authored", toolsGuidance: "legacy-authored" })))
      .toEqual({ neutral: "Neutral", harnessSkeleton, hookGuidance: "legacy-authored", toolsGuidance: "legacy-authored" });
  });
test.each(["Missing", "{{SLOT:framework_hook_runtime}", "{{SLOT:framework_hook_runtime}}{{SLOT:framework_hook_runtime}}"])(
  "invalid declared Hook position refuses before any Tools decision: %s", (harnessSkeleton) => {
    expect(admitOnboardingSource({ neutral: "Neutral", harnessSkeleton, hookGuidance: "framework-hooks", toolsGuidance: "legacy-authored" }))
      .toEqual(refused("Declared framework Hook guidance requires exactly one {{SLOT:framework_hook_runtime}} marker."));
  });
test.each(["{{SLOT:framework_hook_runtime}}", "{{SLOT:framework_hook_runtime}}{{SLOT:framework_tools_runtime}",
  "{{SLOT:framework_hook_runtime}}{{SLOT:framework_tools_runtime}}{{SLOT:framework_tools_runtime}}"])(
  "valid Hook does not authorize invalid Tools: %s", (harnessSkeleton) => {
    expect(admitOnboardingSource({ neutral: "Neutral", harnessSkeleton, hookGuidance: "framework-hooks", toolsGuidance: "framework-tools" }))
      .toEqual(refused("Declared framework Tools guidance requires exactly one {{SLOT:framework_tools_runtime}} marker."));
  });
test("both invalid declarations retain Hook-first precedence", () => {
  expect(admitOnboardingSource({ neutral: "{{UNKNOWN}}", harnessSkeleton: "Missing", hookGuidance: "framework-hooks", toolsGuidance: "framework-tools" }))
    .toEqual(refused("Declared framework Hook guidance requires exactly one {{SLOT:framework_hook_runtime}} marker."));
});
test("admission snapshots the exact text and declarations into one frozen value", () => {
  const source = { neutral: "Neutral\r\n", harnessSkeleton: "{{SLOT:framework_hook_runtime}}\r\n{{SLOT:framework_tools_runtime}}\r\n",
    hookGuidance: "framework-hooks" as const, toolsGuidance: "framework-tools" as const };
  const admitted = accept(admitOnboardingSource(source));
  source.harnessSkeleton = "Changed";
  expect(admitted).toEqual({ neutral: "Neutral\r\n", harnessSkeleton: "{{SLOT:framework_hook_runtime}}\r\n{{SLOT:framework_tools_runtime}}\r\n",
    hookGuidance: "framework-hooks", toolsGuidance: "framework-tools" });
  expect(Object.isFrozen(admitted)).toBe(true);
});
test.each(["copy", "native"] as const)("legacy %s binding preserves the admitted value identity", (channel) => {
  const admitted = accept(admitOnboardingSource({ neutral: "N", harnessSkeleton: "{{SLOT:framework_hook_runtime}}{{SLOT:framework_tools_runtime}}",
    hookGuidance: "legacy-authored", toolsGuidance: "legacy-authored" }));
  expect(bindOnboardingSource(admitted, channel)).toBe(admitted);
});
test.each(["copy", "native"] as const)("legacy %s empty and custom slots keep ordinary interpolation behavior", (channel) => {
  const admitted = accept(admitOnboardingSource({ neutral: "N", harnessSkeleton: "Hook={{SLOT:framework_hook_runtime}}|Tools={{SLOT:framework_tools_runtime}}\n",
    hookGuidance: "legacy-authored", toolsGuidance: "legacy-authored" }));
  expect(renderOnboarding(bindOnboardingSource(admitted, channel).harnessSkeleton, { invoke: "/custom", slots: {} }))
    .toEqual({ ok: true, value: "Hook=|Tools=\n" });
  expect(renderOnboarding(bindOnboardingSource(admitted, channel).harnessSkeleton, { invoke: "/custom",
    slots: { framework_hook_runtime: "Custom Hook", framework_tools_runtime: "Custom Tools" } }))
    .toEqual({ ok: true, value: "Hook=Custom Hook|Tools=Custom Tools\n" });
});
test.each([
  ["framework_hook_runtime", 'onboarding render incomplete: marker {{SLOT:framework_hook_runtime}} survived for invoke="/custom". Every {{SLOT:...}} the skeleton declares must be fillable.'],
  ["framework_tools_runtime", 'onboarding render incomplete: marker {{SLOT:framework_tools_runtime}} survived for invoke="/custom". Every {{SLOT:...}} the skeleton declares must be fillable.'],
])("host-fill marker %s cannot gain authority from admitted guidance", (marker, message) => {
  const admitted = accept(admitOnboardingSource({ neutral: "N", harnessSkeleton: "{{SLOT:title_block}}\n{{SLOT:framework_hook_runtime}}\n{{SLOT:framework_tools_runtime}}\n",
    hookGuidance: "framework-hooks", toolsGuidance: "framework-tools" }));
  const bound = bindOnboardingSource(admitted, "native");
  expect(renderOnboarding(bound.harnessSkeleton, { invoke: "/custom", slots: { title_block: `{{SLOT:${marker}}}` } })).toEqual(refused(message));
});
test("native binding respects reversed authored positions without mutating the shared capture", () => {
  const admitted = accept(admitOnboardingSource({ neutral: "N", harnessSkeleton: "({{SLOT:framework_tools_runtime}})\r\n{{SLOT:framework_hook_runtime}}\r\n",
    hookGuidance: "framework-hooks", toolsGuidance: "framework-tools" }));
  expect(bindOnboardingSource(admitted, "native")).toEqual({ neutral: "N", harnessSkeleton:
    "(TypeScript sources invoked through the self-contained `aidlc` runtime)\r\n- **Hook permissions**: Framework hooks run through the self-contained `aidlc` binary. No separate script runtime or executable bits are required.\r\n" });
  expect(admitted.harnessSkeleton).toBe("({{SLOT:framework_tools_runtime}})\r\n{{SLOT:framework_hook_runtime}}\r\n");
});
