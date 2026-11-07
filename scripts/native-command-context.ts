import { scanNamespaceInvocations, TRUSTED_COMMAND_PREFIX, trustedCommand } from "../core/tools/aidlc-command.ts";
import { ROUTES, TOOLS } from "../core/tools/aidlc-routes.ts";
import type { NativeCommandContext } from "./native-command-text.ts";
export const createNativeCommandContext = ({ harnessDir }: { readonly harnessDir: string }): NativeCommandContext => ({
  harnessDir,
  toolFiles: Object.values(TOOLS),
  prefix: TRUSTED_COMMAND_PREFIX,
  command: ({ suffix }) => trustedCommand(suffix),
  namespaceProblems: ({ source, subject }) => scanNamespaceInvocations(subject, source, ROUTES)
    .filter((invocation) => invocation.source === "aidlc" && !invocation.resolves)
    .map((invocation) => `${subject}:${invocation.line}: unresolvable projected namespace invocation "${invocation.command}"`),
});
