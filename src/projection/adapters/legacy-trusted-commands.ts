import { LAUNCHER_GLOBAL_FLAGS, TRUSTED_ROUTE_NAMESPACE, trustedCommand as shippedTrustedCommand,
  codexHookTrustHash as shippedCodexHookTrustHash } from "../../../core/tools/aidlc-command.ts";
import type { HookTrustHash } from "../application/ports/settings.ts";

export const codexHookTrustHash: typeof shippedCodexHookTrustHash = shippedCodexHookTrustHash;

export const legacyHookTrustHash: HookTrustHash = ({ event, command, timeoutSeconds, matcher }) =>
  shippedCodexHookTrustHash(event, command, timeoutSeconds, matcher);

export const engineNamespace = TRUSTED_ROUTE_NAMESPACE;
export const launcherGlobalFlags: readonly string[] = [...LAUNCHER_GLOBAL_FLAGS];
export const trustedCommand = (suffix: string): string => shippedTrustedCommand(suffix);
