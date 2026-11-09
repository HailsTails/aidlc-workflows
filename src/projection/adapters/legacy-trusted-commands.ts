import { codexHookTrustHash as shippedCodexHookTrustHash } from "../../../core/tools/aidlc-command.ts";
import type { HookTrustHash } from "../application/ports/settings.ts";

export const codexHookTrustHash: typeof shippedCodexHookTrustHash = shippedCodexHookTrustHash;

export const legacyHookTrustHash: HookTrustHash = ({ event, command, timeoutSeconds, matcher }) =>
  shippedCodexHookTrustHash(event, command, timeoutSeconds, matcher);
