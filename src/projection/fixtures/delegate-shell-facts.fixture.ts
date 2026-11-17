import type { DelegateShellFacts } from "../application/ports/delegate-shell.ts";

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
  trustedCommand: () => "unused",
};
