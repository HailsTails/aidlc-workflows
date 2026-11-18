import { PERMISSION_POLICIES_FIXTURE } from "../fixtures/onboarding-permissions.fixture.ts";
import { expect, mock, test } from "bun:test";
import { accepted, refused, type Result } from "../../kernel/result.ts";
import { nativePermissionsLine, onboardingContext, prepareOnboardingContext, type NativePermissionFacts, type OnboardingContext } from "./onboarding-context.ts";
import { accept } from "../../kernel/fixtures/accept.ts";

test("an authored policy preserves opaque permission prose exactly", () => {
  const authored = "- **Permissions**: opaque $& `quoted`\r\n";
  expect(nativePermissionsLine({ policy: { kind: "authored" }, prefix: "unused", authored }))
    .toBe(authored);
});

test("admission retains the actual host callback without calling or replacing it", () => {
  const line = mock(() => "Host-owned exact permission sentence");
  const policy = { kind: "host-line" as const, line };
  const context = accept(onboardingContext({ channel: "native", permissions: policy, prefix: "custom worker" }));
  if (context.channel !== "native") throw new Error("Expected native context");
  expect(context.permissions.policy).toBe(policy);
  expect(line).not.toHaveBeenCalled();
  expect(nativePermissionsLine({ ...context.permissions, authored: "Copy wording" }))
    .toBe("Host-owned exact permission sentence");
  expect(line).toHaveBeenCalledWith("custom worker");
});

test("a non-callable host line is refused before a malformed prefix", () => {
  expect(onboardingContext({ channel: "native", permissions: { kind: "host-line", line: 17 }, prefix: 17 }))
    .toEqual(refused("Native onboarding requires the distribution's declared permission policy."));
});

test("host permission callback exceptions retain their identity", () => {
  const failure = new Error("Host-owned failure");
  const line = mock((): string => { throw failure; });
  let thrown: unknown;
  try {
    nativePermissionsLine({ policy: { kind: "host-line", line }, prefix: "aidlc engine", authored: "Copy wording" });
  } catch (error) {
    thrown = error;
  }
  expect(thrown).toBe(failure);
});

test("copy needs no unused native facts", () => {
  expect(onboardingContext({ channel: "copy", permissions: undefined, prefix: undefined }))
    .toEqual(accepted({ channel: "copy" }));
});

test.each([
  { policy: PERMISSION_POLICIES_FIXTURE["prefix-only"], prefix: "custom worker" },
  { policy: PERMISSION_POLICIES_FIXTURE["exact-reads"], prefix: "another dispatch" },
  { policy: PERMISSION_POLICIES_FIXTURE["prefix-only"], prefix: "" },
  { policy: PERMISSION_POLICIES_FIXTURE["exact-reads"], prefix: "custom\nworker" },
])("native binds the existing facts verbatim: %j", ({ policy, prefix }) => {
  expect(onboardingContext({ channel: "native", permissions: policy, prefix }))
    .toEqual<Result<{ readonly channel: "native"; readonly permissions: NativePermissionFacts }, string>>(
      accepted({ channel: "native", permissions: { policy, prefix } }));
});

test.each([
  { channel: undefined, permissions: PERMISSION_POLICIES_FIXTURE["prefix-only"], prefix: "aidlc engine" },
  { channel: "unknown", permissions: PERMISSION_POLICIES_FIXTURE["prefix-only"], prefix: "aidlc engine" },
])("an invalid channel is refused: %j", (input) => {
  expect(onboardingContext(input)).toEqual(refused("The onboarding channel must be copy or native."));
});

test.each([
  { channel: "native", permissions: undefined, prefix: "aidlc engine" },
  { channel: "native", permissions: "unknown", prefix: "aidlc engine" },
])("an absent or unknown distribution policy is refused: %j", (input) => {
  expect(onboardingContext(input)).toEqual(refused("Native onboarding requires the distribution's declared permission policy."));
});

test.each([
  { channel: "native", permissions: PERMISSION_POLICIES_FIXTURE["exact-reads"], prefix: undefined },
  { channel: "native", permissions: PERMISSION_POLICIES_FIXTURE["exact-reads"], prefix: 17 },
])("an absent or non-string route prefix is refused: %j", (input) => {
  expect(onboardingContext(input)).toEqual(refused("Native onboarding requires the bound command route prefix."));
});

test.each<{ readonly policy: NativePermissionFacts["policy"]; readonly expected: string }>([
  { policy: PERMISSION_POLICIES_FIXTURE["prefix-only"], expected: "- **Permissions**: the `aidlc` agent pre-approves only the native `custom worker` command prefix and its listed read-only tools; everything else prompts." },
  { policy: PERMISSION_POLICIES_FIXTURE["exact-reads"], expected: "- **Permissions**: the `aidlc` agent pre-approves only the native `custom worker` command prefix, the read-only `aidlc doctor`, `status`, `version` and `config <section> --show` (with or without `--json`) and `--help` forms, turning a check back on (`aidlc config flags --clear-bypass <switch> --yes`), and its listed read-only tools; everything else prompts, including any other `config` change." },
])("the $policy prose preserves its complete native contract", ({ policy, expected }) => {
  expect(nativePermissionsLine({ policy, prefix: "custom worker" , authored: "Authored permission prose" })).toBe(expected);
});

test("copy preparation preserves the original context without native admission", () => {
  const context: OnboardingContext = { channel: "copy" };
  expect(prepareOnboardingContext({ context, skeleton: "> {{SLOT:prereq_bullets_tail}}" })).toBe(context);
});

test.each([
  { skeleton: "{{SLOT:prereq_bullets}}\n{{SLOT:prereq_bullets_tail}}\n" },
  { skeleton: "{{SLOT:prereq_bullets_tail}}\r\n" },
  { skeleton: "{{SLOT:prereq_bullets_tail}}\n{{SLOT:prereq_bullets_tail}}" },
])("whole-line slot occurrences can bind native prose: %j", ({ skeleton }) => {
  const context = accept(onboardingContext({ channel: "native", permissions: PERMISSION_POLICIES_FIXTURE["prefix-only"], prefix: "custom worker" }));
  expect(prepareOnboardingContext({ context, skeleton }))
    .toEqual<{ readonly channel: "native"; readonly permissions: NativePermissionFacts;
      readonly permissionSource: { readonly kind: "line-slots"; readonly skeleton: string } }>({
      channel: "native", permissions: { policy: PERMISSION_POLICIES_FIXTURE["prefix-only"], prefix: "custom worker" },
      permissionSource: { kind: "line-slots", skeleton },
    });
});

test.each([
  { skeleton: "" },
  { skeleton: "> {{SLOT:prereq_bullets_tail}}" },
  { skeleton: " {{SLOT:prereq_bullets_tail}}\n" },
  { skeleton: "{{SLOT:prereq_bullets_tail}} suffix" },
  { skeleton: "{{SLOT:prereq_bullets_tail}}\n> {{SLOT:prereq_bullets_tail}}" },
])("unbound, inline or mixed source keeps its legacy policy meaning: %j", ({ skeleton }) => {
  const context = accept(onboardingContext({ channel: "native", permissions: PERMISSION_POLICIES_FIXTURE["exact-reads"], prefix: "custom worker" }));
  expect(prepareOnboardingContext({ context, skeleton }))
    .toEqual<{ readonly channel: "native"; readonly permissions: NativePermissionFacts;
      readonly permissionSource: { readonly kind: "legacy-template" } }>({
      channel: "native", permissions: { policy: PERMISSION_POLICIES_FIXTURE["exact-reads"], prefix: "custom worker" },
      permissionSource: { kind: "legacy-template" },
    });
});

test.each(["custom\nworker", "custom\rworker", "custom\u2028worker", "custom\u2029worker", "custom\n", "custom\r", "custom\u2028", "custom\u2029", "$&", "'''", "$`", "$'", "$$", "{{INVOKE}}", "`", "\\", "\"", "custom—worker"])("an opaque prefix retains the legacy serialization and replacement path: %j", (prefix) => {
  const context = accept(onboardingContext({ channel: "native", permissions: PERMISSION_POLICIES_FIXTURE["prefix-only"], prefix }));
  expect(prepareOnboardingContext({ context, skeleton: "{{SLOT:prereq_bullets_tail}}\n" }))
    .toEqual<{ readonly channel: "native"; readonly permissions: NativePermissionFacts;
      readonly permissionSource: { readonly kind: "legacy-template" } }>({
      channel: "native", permissions: { policy: PERMISSION_POLICIES_FIXTURE["prefix-only"], prefix },
      permissionSource: { kind: "legacy-template" },
    });
});
