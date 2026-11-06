/** Inputs describe authority; this policy neither discovers routes nor grants host permissions. */
type CopyPreapprovalRoute = Readonly<{
  mutationScope: string;
  tool?: string;
}>;

/** A script shared with any machine-changing route always needs the host's prompt. */
export function machineReachingToolScripts({ routes }: {
  readonly routes: readonly CopyPreapprovalRoute[];
}): string[] {
  return [...new Set(routes
    .filter((route) => route.mutationScope === "machine" || route.mutationScope === "project-and-machine")
    .map((route) => route.tool)
    .filter((tool) => tool !== undefined))].sort();
}

export function preapprovedCopyToolScripts({ machineToolScripts, toolScripts }: {
  readonly machineToolScripts: readonly string[];
  readonly toolScripts: readonly string[];
}): string[] {
  const machineScripts = new Set(machineToolScripts);
  return [...new Set(toolScripts)].filter((tool) => !machineScripts.has(tool)).sort();
}

/** Exact spellings matter to hosts; config writes stay interactive except raising a check. */
export function preapprovedDispatcherCommands({ configSections, recordableProjectBypasses }: {
  readonly configSections: readonly string[];
  readonly recordableProjectBypasses: readonly string[];
}): string[] {
  return [
    "doctor",
    "doctor --verbose",
    "version",
    "--doctor",
    "--doctor --verbose",
    "--version",
    "status",
    "--status",
    "config --help",
    // Top-level show reads sections, which may report an unavailable project harness.
    "config --show",
    "config --show --json",
    ...configSections.flatMap((section) => [
      `config ${section} --show`,
      `config ${section} --show --json`,
      `config ${section} --help`,
    ]),
    ...recordableProjectBypasses.map((name) => `config flags --clear-bypass ${name} --yes`),
  ];
}
