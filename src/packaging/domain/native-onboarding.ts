import { LEGACY_NATIVE_GUIDANCE } from "../../projection/domain/legacy-native-guidance.ts";
import type { NativePermissions } from "./payload.ts";
import { nativePermissionsLine } from "../../projection/domain/onboarding-context.ts";

type NativeOnboardingRequest = {
  readonly text: string;
  readonly permissions: NativePermissions;
  readonly prefix: string;
};


export function nativeOnboardingText(request: NativeOnboardingRequest): string {
  return request.text
    .replace(
      /^- \*\*bun\*\*:.*$/gm,
      LEGACY_NATIVE_GUIDANCE.runtime,
    )
    .replace(
      /^- \*\*Hook permissions\*\*:.*$/gm,
      LEGACY_NATIVE_GUIDANCE.hooks,
    )
    .replace(/^- \*\*Permissions\*\*:.*$/gm, (authored) => nativePermissionsLine({
      policy: request.permissions, prefix: request.prefix, authored,
    }))
    .replace(
      /TypeScript, run via bun/g,
      LEGACY_NATIVE_GUIDANCE.tools,
    )
    .replace(
      /^\*\*CWD drift warning\*\*: If a stage runs `cd` in Bash.*$/gm,
      LEGACY_NATIVE_GUIDANCE.cwd,
    );
}
