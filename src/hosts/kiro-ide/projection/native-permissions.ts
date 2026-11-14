import type { DistributionChannel } from "../../../projection/domain/projected-file.ts";
import type { DelegateShellPolicy } from "./delegate-shell-deny.ts";

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
}): string => {
  const newline = source.startsWith("---\r\n") ? "\r\n" : "\n";
  const end = source.startsWith(`---${newline}`) ? source.indexOf(`${newline}---`, 3 + newline.length) : -1;
  if (end < 0) return source;
  const shell = kiroIdeShellPermissionLines({ policy, channel, dispatcherCommands, role: "conductor" });
  const authored = source.slice(0, end);
  const blocks = [...authored.matchAll(/^ {4}- capability: shell\r?\n {6}effect: (allow|ask)\r?\n[\s\S]*?(?=\r?\n {4}- capability:|(?![\s\S]))/gm)];
  return blocks.reduceRight((text, block) => {
    const lines = block[1] === "allow" ? shell.allow : shell.ask;
    return text.slice(0, block.index) + lines.join(newline) + text.slice(block.index + block[0].length);
  }, authored) + source.slice(end);
};
