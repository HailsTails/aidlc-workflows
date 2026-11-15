import { brand, type Brand } from "../../kernel/brand.ts";
import { accepted, refused, type Result } from "../../kernel/result.ts";

// Described distribution policy, not an authorization grant or installed-rule proof.
export type NativePermissionPolicy = "exact-reads" | "prefix-only";
export type NativePermissionFacts = Readonly<{ readonly policy: NativePermissionPolicy; readonly prefix: string }>;
export type OnboardingPermissions = Brand<NativePermissionFacts, "OnboardingPermissions">;
export type OnboardingContext = { readonly channel: "copy" }
  | { readonly channel: "native"; readonly permissions: OnboardingPermissions };

export const onboardingContext = (input: {
  readonly channel: unknown; readonly permissionsLine: unknown; readonly prefix: unknown;
}): Result<OnboardingContext, string> => {
  if (input.channel === "copy") return accepted(Object.freeze({ channel: "copy" }));
  if (input.channel !== "native") return refused("The onboarding channel must be copy or native.");
  if (input.permissionsLine !== "exact-reads" && input.permissionsLine !== "prefix-only") {
    return refused("Native onboarding requires the distribution's declared permission policy.");
  }
  if (typeof input.prefix !== "string") return refused("Native onboarding requires the bound command route prefix.");
  return accepted(Object.freeze({ channel: "native", permissions: brand<OnboardingPermissions>(Object.freeze({
    policy: input.permissionsLine, prefix: input.prefix,
  })) }));
};

// The prefix is already bound by the command-route owner; do not parse or normalize it.
export const nativePermissionsLine = ({ policy, prefix }: NativePermissionFacts): string => policy === "exact-reads"
  ? `- **Permissions**: the \`aidlc\` agent pre-approves only the native \`${prefix}\` command prefix, the read-only \`aidlc doctor\`, \`status\`, \`version\` and \`config <section> --show\` (with or without \`--json\`) and \`--help\` forms, turning a check back on (\`aidlc config flags --clear-bypass <switch> --yes\`), and its listed read-only tools; everything else prompts, including any other \`config\` change.`
  : `- **Permissions**: the \`aidlc\` agent pre-approves only the native \`${prefix}\` command prefix and its listed read-only tools; everything else prompts.`;
