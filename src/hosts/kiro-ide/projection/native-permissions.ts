import type { DistributionChannel } from "../../../projection/domain/projected-file.ts";
import type { DelegateShellPolicy } from "./delegate-shell-deny.ts";
import { renderConductorPermissions } from "./conductor-permission-template.ts";
import type { Result } from "../../../kernel/result.ts";
import type { ProjectionRefusal } from "../../../projection/domain/projection.ts";

const matchLines = (effect: "allow" | "ask", patterns: readonly string[]): string[] => [
  "    - capability: shell", `      effect: ${effect}`, "      match:",
  ...patterns.map((pattern) => `        - "${pattern}"`),
];

export const kiroIdeShellPermissionLines = ({ policy, channel, dispatcherCommands = [], role = "delegate" }: {
  readonly policy: DelegateShellPolicy;
  readonly channel: DistributionChannel;
  readonly dispatcherCommands?: readonly string[];
  readonly role?: "conductor" | "delegate";
}): { readonly allow: readonly string[]; readonly ask: readonly string[] } => {
  const commands = policy.shellCommands(channel);
  return {
    allow: matchLines("allow", [...commands.allow.slice(0, -1),
      ...dispatcherCommands.map((command) => `${commands.invoke} ${command}`), ...commands.allow.slice(-1)]),
    ask: matchLines("ask", [...commands.ask, ...(role === "conductor" ? commands.conductorAsk : [])]),
  };
};

export const kiroIdeConductorPermissionSource = ({ source, policy, channel, dispatcherCommands }: {
  readonly source: string;
  readonly policy: DelegateShellPolicy;
  readonly channel: DistributionChannel;
  readonly dispatcherCommands: readonly string[];
}): Result<string, ProjectionRefusal> => {
  const shell = kiroIdeShellPermissionLines({ policy, channel, dispatcherCommands, role: "conductor" });
  return renderConductorPermissions({ source, shell });
};
