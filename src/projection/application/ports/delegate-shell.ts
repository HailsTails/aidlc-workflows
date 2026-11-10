export type EngineRoute = {
  readonly group: string;
  readonly verbs: readonly string[];
};

export type DelegateAdmission = Readonly<Record<string, readonly string[]>>;

export type DelegateShellFacts = {
  readonly engineNamespace: string;
  readonly engineRoutes: readonly EngineRoute[];
  readonly dispatcherCommands: readonly string[];
  readonly launcherGlobalFlags: readonly string[];
  readonly workspaceNouns: readonly string[];
  readonly workspaceRead: (words: readonly string[]) => "read" | "other";
  readonly admittedVerbs: (agent: string) => DelegateAdmission;
  readonly engineRouteAdmission: (request: {
    readonly admitted: DelegateAdmission;
    readonly words: readonly string[];
  }) => "admitted" | "refused";
  readonly lifecycleAdmission: (command: string) => "admitted" | "refused";
  readonly trustedCommand: (suffix: string) => string;
};
