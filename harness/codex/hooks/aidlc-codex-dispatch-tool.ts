export const CODEX_DISPATCH_MATCHER = "^(spawn_agent|collaborationspawn_agent)$";

export type CodexDispatchTool = {
  readonly eventName: string | undefined;
  readonly toolName: string | undefined;
};

export const normalizeCodexDispatchTool = ({
  eventName,
  toolName,
}: CodexDispatchTool): string | undefined => {
  if (eventName !== "PreToolUse" || toolName !== "collaborationspawn_agent") {
    return toolName;
  }
  return "spawn_agent";
};
