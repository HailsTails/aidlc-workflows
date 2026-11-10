import { WORKSPACE_NOUNS, parseWorkspaceCommand } from "../../../core/tools/aidlc-lib.ts";
import type { DelegateShellFacts } from "../application/ports/delegate-shell.ts";

export const workspaceNouns: DelegateShellFacts["workspaceNouns"] = WORKSPACE_NOUNS;

export const workspaceRead: DelegateShellFacts["workspaceRead"] = (words) => {
  const kind = parseWorkspaceCommand(words).kind;
  return kind === "list" || kind === "help" ? "read" : "other";
};
