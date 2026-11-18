import type { DistributionChannel } from "../../../projection/domain/projected-file.ts";
import type { NativeCommandRoutes } from "../../../projection/domain/native-command.ts";

export type ClaudeHookCommand =
  | { readonly kind: "engine-hook"; readonly hook: string; readonly authored: string }
  | { readonly kind: "opaque"; readonly authored: string };

export const admitClaudeHookCommand = (request: {
  readonly command: string; readonly directory: string | null;
}): ClaudeHookCommand => {
  if (request.directory === null) return { kind: "opaque", authored: request.command };
  const prefix = `bun "$CLAUDE_PROJECT_DIR/${request.directory}/tools/aidlc.ts" engine hook `;
  if (!request.command.startsWith(prefix)) return { kind: "opaque", authored: request.command };
  const hook = request.command.slice(prefix.length);
  return /^[a-z0-9-]+$/.test(hook)
    ? { kind: "engine-hook", hook, authored: request.command }
    : { kind: "opaque", authored: request.command };
};

export const renderClaudeHookCommand = (request: {
  readonly command: ClaudeHookCommand; readonly channel: DistributionChannel;
  readonly trusted: NativeCommandRoutes["trusted"];
}): string => request.channel === "native" && request.command.kind === "engine-hook"
  ? request.trusted(`hook ${request.command.hook}`) : request.command.authored;
