import { brand, type Brand } from "../../kernel/brand.ts";
import { accepted, refused, type Result } from "../../kernel/result.ts";

// Described distribution policy, not an authorization grant or installed-rule proof.
export type NativePermissionsLine = (nativePrefix: string) => string;
export type NativePermissionPolicy =
  | { readonly kind: "authored" }
  | { readonly kind: "host-line"; readonly line: NativePermissionsLine };
export type NativePermissionFacts = Readonly<{ readonly policy: NativePermissionPolicy; readonly prefix: string }>;
export type OnboardingPermissions = Brand<NativePermissionFacts, "OnboardingPermissions">;
export type OnboardingContext = { readonly channel: "copy" }
  | { readonly channel: "native"; readonly permissions: OnboardingPermissions };
type PermissionSource = { readonly kind: "legacy-template" }
  | { readonly kind: "line-slots"; readonly skeleton: string };
type PreparedNativeContext = Brand<Readonly<Extract<OnboardingContext, { readonly channel: "native" }> & {
  readonly permissionSource: PermissionSource;
}>, "PreparedOnboardingContext">;
export type PreparedOnboardingContext = Extract<OnboardingContext, { readonly channel: "copy" }> | PreparedNativeContext;

const slotPlacement = (request: { readonly skeleton: string; readonly index: number; readonly marker: string }): "whole-line" | "embedded" => {
  const end = request.index + request.marker.length;
  return (request.index === 0 || request.skeleton[request.index - 1] === "\n")
    && (end === request.skeleton.length || request.skeleton[end] === "\n" || request.skeleton.slice(end, end + 2) === "\r\n")
    ? "whole-line" : "embedded";
};

// Framework guidance has already been bound. Admit only remaining whole-line
// host slots; quoted/mixed/custom placements retain the legacy consumer meaning.
export const prepareOnboardingContext = (request: {
  readonly context: OnboardingContext; readonly skeleton: string;
}): PreparedOnboardingContext => {
  if (request.context.channel === "copy") return request.context;
  const slots = [...request.skeleton.matchAll(/\{\{SLOT:[a-z_]+\}\}/g)];
  const source: PermissionSource = slots.length > 0
    && /^[A-Za-z0-9_ -]*$/.test(request.context.permissions.prefix)
    && slots.every(slot => slotPlacement({ skeleton: request.skeleton, index: slot.index, marker: slot[0] }) === "whole-line")
    ? Object.freeze({ kind: "line-slots", skeleton: request.skeleton }) : Object.freeze({ kind: "legacy-template" });
  return brand<PreparedNativeContext>(Object.freeze({ ...request.context, permissionSource: source }));
};

const permissionPolicy = (raw: unknown): raw is NativePermissionPolicy =>
  typeof raw === "object" && raw !== null && "kind" in raw
  && (raw.kind === "authored" || (raw.kind === "host-line" && "line" in raw && typeof raw.line === "function"));

export const onboardingContext = (input: {
  readonly channel: unknown; readonly permissions: unknown; readonly prefix: unknown;
}): Result<OnboardingContext, string> => {
  if (input.channel === "copy") return accepted(Object.freeze({ channel: "copy" }));
  if (input.channel !== "native") return refused("The onboarding channel must be copy or native.");
  if (!permissionPolicy(input.permissions)) {
    return refused("Native onboarding requires the distribution's declared permission policy.");
  }
  if (typeof input.prefix !== "string") return refused("Native onboarding requires the bound command route prefix.");
  return accepted(Object.freeze({ channel: "native", permissions: brand<OnboardingPermissions>(Object.freeze({
    policy: input.permissions, prefix: input.prefix,
  })) }));
};

// The prefix is already bound by the command-route owner; do not parse or normalize it.
export const nativePermissionsLine = ({ policy, prefix, authored }: NativePermissionFacts & {
  readonly authored: string;
}): string => policy.kind === "authored" ? authored : policy.line(prefix);
