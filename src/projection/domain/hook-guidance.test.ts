import { expect, test } from "bun:test";
import { accepted, refused } from "../../kernel/result.ts";
import { admitHookGuidance, hookGuidanceFills } from "./hook-guidance.ts";

test.each(["custom text", "{{SLOT:framework_hook_runtime}}", "{{SLOT:framework_hook_runtime}}{{SLOT:framework_hook_runtime}}"])(
  "legacy admission does not interpret %s", (skeleton) => {
    expect(admitHookGuidance("legacy-authored", skeleton)).toEqual(accepted("legacy-authored"));
  });
test.each(["custom text", "{{SLOT:framework_hook_runtime}", "{{SLOT:framework_hook_runtime}}{{SLOT:framework_hook_runtime}}"])(
  "declared guidance refuses absent, malformed or duplicate marker: %s", (skeleton) => {
    expect(admitHookGuidance("framework-hooks", skeleton)).toEqual(refused(
      "Declared framework Hook guidance requires exactly one {{SLOT:framework_hook_runtime}} marker."));
  });
test("declared guidance admits its exact position without rewriting the source", () => {
  expect(admitHookGuidance("framework-hooks", "Before\r\n{{SLOT:framework_hook_runtime}}\r\nAfter"))
    .toEqual(accepted("framework-hooks"));
});
test.each(["copy", "native"] as const)("legacy %s fills retain identity and custom marker value", (channel) => {
  const fills = { invoke: "/custom", slots: { framework_hook_runtime: "Custom", other: "Other" } };
  expect(hookGuidanceFills("legacy-authored", channel, fills)).toBe(fills);
});
test("declared copy binds exact authored guidance and retains unrelated slots and invocation", () => {
  expect(hookGuidanceFills("framework-hooks", "copy", { invoke: "/custom", slots: { other: "Other" } }))
    .toEqual({ invoke: "/custom", slots: { other: "Other", framework_hook_runtime:
      "- **Hook permissions**: All 17 hooks are TypeScript (`.ts`) and run via `bun`. No executable bits required — works identically on macOS, Linux, and native Windows PowerShell." } });
});
test("declared native binds exact runtime guidance and owns only its declared slot", () => {
  const fills = { invoke: "/custom", slots: { other: "Other", framework_hook_runtime: "Not the declared meaning" } };
  expect(hookGuidanceFills("framework-hooks", "native", fills)).toEqual({ invoke: "/custom", slots: {
    other: "Other", framework_hook_runtime: "- **Hook permissions**: Framework hooks run through the self-contained `aidlc` binary. No separate script runtime or executable bits are required." } });
  expect(fills).toEqual({ invoke: "/custom", slots: { other: "Other", framework_hook_runtime: "Not the declared meaning" } });
});
