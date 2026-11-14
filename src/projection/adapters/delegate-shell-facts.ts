import type { DelegateShellFacts } from "../application/ports/delegate-shell.ts";
import { admittedVerbs, lifecycleAdmission } from "./legacy-delegate-admission.ts";
import { dispatcherCommands, engineRouteAdmission, engineRoutes } from "./legacy-dispatcher.ts";
import { engineNamespace, launcherGlobalFlags, trustedCommand } from "./legacy-trusted-commands.ts";
import { workspaceNouns, workspaceRead } from "./legacy-workspace-commands.ts";

export const delegateShellFacts = (): DelegateShellFacts => ({
  engineNamespace, engineRoutes: engineRoutes(engineNamespace), dispatcherCommands: dispatcherCommands(),
  launcherGlobalFlags, workspaceNouns, workspaceRead, admittedVerbs, engineRouteAdmission,
  lifecycleAdmission, trustedCommand,
});
