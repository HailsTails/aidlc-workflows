import type { DelegateShellFacts } from "../application/ports/delegate-shell.ts";

const trustedCommands: Readonly<Record<string, string>> = {
  "": "aidlc engine", "*": "aidlc engine *", ".*": "aidlc engine .*",
  "config set *": "aidlc engine config set *", "adapter *": "aidlc engine adapter *",
};

export const DELEGATE_SHELL_FACTS: DelegateShellFacts = {
  engineNamespace: "engine",
  engineRoutes: [],
  dispatcherCommands: [],
  launcherGlobalFlags: [],
  workspaceNouns: [],
  workspaceRead: () => "other",
  admittedVerbs: () => ({}),
  engineRouteAdmission: () => "refused",
  lifecycleAdmission: () => "admitted",
  trustedCommand: (suffix) => trustedCommands[suffix] ?? "unused",
};
