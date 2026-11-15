import { expect, test } from "bun:test";
import { accepted, refused, type Result } from "../../kernel/result.ts";
import { nativePermissionsLine, onboardingContext, type NativePermissionFacts } from "./onboarding-context.ts";

test("copy needs no unused native facts", () => {
  expect(onboardingContext({ channel: "copy", permissionsLine: undefined, prefix: undefined }))
    .toEqual(accepted({ channel: "copy" }));
});

test.each([
  { policy: "prefix-only", prefix: "custom worker" },
  { policy: "exact-reads", prefix: "another dispatch" },
  { policy: "prefix-only", prefix: "" },
  { policy: "exact-reads", prefix: "custom\nworker" },
])("native binds the existing facts verbatim: %j", ({ policy, prefix }) => {
  expect(onboardingContext({ channel: "native", permissionsLine: policy, prefix }))
    .toEqual<Result<{ readonly channel: "native"; readonly permissions: { readonly policy: string; readonly prefix: string } }, string>>(
      accepted({ channel: "native", permissions: { policy, prefix } }));
});

test.each([
  { channel: undefined, permissionsLine: "prefix-only", prefix: "aidlc engine" },
  { channel: "unknown", permissionsLine: "prefix-only", prefix: "aidlc engine" },
])("an invalid channel is refused: %j", (input) => {
  expect(onboardingContext(input)).toEqual(refused("The onboarding channel must be copy or native."));
});

test.each([
  { channel: "native", permissionsLine: undefined, prefix: "aidlc engine" },
  { channel: "native", permissionsLine: "unknown", prefix: "aidlc engine" },
])("an absent or unknown distribution policy is refused: %j", (input) => {
  expect(onboardingContext(input)).toEqual(refused("Native onboarding requires the distribution's declared permission policy."));
});

test.each([
  { channel: "native", permissionsLine: "exact-reads", prefix: undefined },
  { channel: "native", permissionsLine: "exact-reads", prefix: 17 },
])("an absent or non-string route prefix is refused: %j", (input) => {
  expect(onboardingContext(input)).toEqual(refused("Native onboarding requires the bound command route prefix."));
});

test.each<{ readonly policy: NativePermissionFacts["policy"]; readonly expected: string }>([
  { policy: "prefix-only", expected: "- **Permissions**: the `aidlc` agent pre-approves only the native `custom worker` command prefix and its listed read-only tools; everything else prompts." },
  { policy: "exact-reads", expected: "- **Permissions**: the `aidlc` agent pre-approves only the native `custom worker` command prefix, the read-only `aidlc doctor`, `status`, `version` and `config <section> --show` (with or without `--json`) and `--help` forms, turning a check back on (`aidlc config flags --clear-bypass <switch> --yes`), and its listed read-only tools; everything else prompts, including any other `config` change." },
])("the $policy prose preserves its complete native contract", ({ policy, expected }) => {
  expect(nativePermissionsLine({ policy, prefix: "custom worker" })).toBe(expected);
});
