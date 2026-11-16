import type { NativeCommandRoutes } from "../domain/native-command.ts";
import { LAUNCHER_GLOBAL_FLAGS, TRUSTED_COMMAND_PREFIX, scanNamespaceInvocations, TRUSTED_ROUTE_NAMESPACE, trustedCommand as shippedTrustedCommand,
  codexHookTrustHash as shippedCodexHookTrustHash } from "../../../core/tools/aidlc-command.ts";
import type { HookTrustHash } from "../application/ports/settings.ts";

export const codexHookTrustHash: typeof shippedCodexHookTrustHash = shippedCodexHookTrustHash;

export const legacyHookTrustHash: HookTrustHash = ({ event, command, timeoutSeconds, matcher }) =>
  shippedCodexHookTrustHash(event, command, timeoutSeconds, matcher);

export const engineNamespace = TRUSTED_ROUTE_NAMESPACE;
export const launcherGlobalFlags: readonly string[] = [...LAUNCHER_GLOBAL_FLAGS];
export const trustedCommand = (suffix: string): string => shippedTrustedCommand(suffix);

export const createLegacyNativeCommands = ({ routes, delegates, adapterHooks }: {
  readonly routes: Parameters<typeof scanNamespaceInvocations>[2];
  readonly delegates: readonly string[];
  readonly adapterHooks: ReadonlySet<string>;
}): NativeCommandRoutes => ({
  prefix: TRUSTED_COMMAND_PREFIX, namespace: TRUSTED_ROUTE_NAMESPACE, delegates, adapterHooks,
  trusted: (suffix) => shippedTrustedCommand(suffix),
  unresolvable: ({ file, text }) => scanNamespaceInvocations(file, text, routes)
    .filter((invocation) => invocation.source === "aidlc" && !invocation.resolves)
    .map((invocation) => `${file}:${invocation.line}: unresolvable projected namespace invocation "${invocation.command}"`),
});
