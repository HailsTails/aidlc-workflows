import type {
  DelegateShellFacts,
} from "../../../projection/application/ports/delegate-shell.ts";

export type DelegateShellPolicy = {
  readonly shellDeny: (agent: string) => readonly string[];
  readonly riskyForms: readonly string[];
};

export type ShellDeny = { match: string[]; exclude: string[] };

const both = (command: string): string[] => [command, `${command} *`];

const sampledAdmission = (facts: DelegateShellFacts, command: string): "admitted" | "refused" =>
  [`${command} x`, `${command} x y`].every((sample) => facts.lifecycleAdmission(sample) === "admitted")
    ? "admitted" : "refused";

const exactQuery = (facts: DelegateShellFacts, command: string): string[] => {
  const words = command.split(" ");
  return [command, ...facts.launcherGlobalFlags.filter((flag) => !words.includes(flag)).map((flag) => `${command} ${flag}`)]
    .filter((query) => facts.lifecycleAdmission(query) === "admitted");
};

const exclusionsFor = (facts: DelegateShellFacts, command: string): string[] =>
  sampledAdmission(facts, command) === "admitted" ? both(command) : exactQuery(facts, command);

const workspaceReads = (facts: DelegateShellFacts, noun: string): string[] =>
  ["list", "--all", "help", "-h"]
    .filter((token) => facts.workspaceRead([noun, token]) === "read")
    .map((token) => `${noun} ${token}`);

const workspaceExclusions = ({ facts, prefix, noun }: {
  facts: DelegateShellFacts;
  prefix: string;
  noun: string;
}): string[] => [
  ...exactQuery(facts, `${prefix} ${noun}`),
  ...workspaceReads(facts, noun).flatMap((read) => exclusionsFor(facts, `${prefix} ${read}`)),
];

function engineRouteExclusions({ facts, agent, engine }: {
  facts: DelegateShellFacts;
  agent: string;
  engine: string;
}): string[] {
  const admitted = facts.admittedVerbs(agent);
  const routes = facts.engineRoutes;
  return [
    ...facts.workspaceNouns.filter((noun) => routes.some((route) => route.group === noun))
      .flatMap((noun) => workspaceExclusions({ facts, prefix: engine, noun })),
    ...routes.filter((route) => !facts.workspaceNouns.includes(route.group)).flatMap((route) => {
      const prefix = route.group === "top" ? "" : `${route.group} `;
      return route.verbs.filter((verb) => !verb.startsWith("<")).flatMap((verb) => {
        const words = [...(route.group === "top" ? [] : [route.group]), ...verb.split(" ")];
        return facts.engineRouteAdmission({ admitted, words }) === "admitted"
          ? exclusionsFor(facts, `${engine} ${prefix}${verb}`) : [];
      });
    }),
  ];
}

export function copyChannelDelegateShellDeny({ facts, harnessDir, agent }: {
  facts: DelegateShellFacts;
  harnessDir: string;
  agent: string;
}): ShellDeny {
  const tool = (file: string) => `bun ${harnessDir}/tools/${file}`;
  const engine = `${tool("aidlc.ts")} ${facts.engineNamespace}`;
  const admitted = facts.admittedVerbs(agent);
  return {
    match: [
      tool("aidlc-*"),
      `${engine} *`,
      ...facts.dispatcherCommands.map((command) => `${tool("aidlc.ts")} ${command}`),
    ],
    exclude: [
      ...Object.entries(admitted)
        .sort(([left], [right]) => left < right ? -1 : Number(left > right))
        .flatMap(([file, verbs]) => verbs.flatMap((verb) => exclusionsFor(facts, `${tool(file)} ${verb}`))),
      ...facts.workspaceNouns.flatMap((noun) => workspaceExclusions({ facts, prefix: tool("aidlc-utility.ts"), noun })),
      ...engineRouteExclusions({ facts, agent, engine }),
    ],
  };
}

export function nativeDelegateShellDeny({ facts, agent }: {
  facts: DelegateShellFacts;
  agent: string;
}): ShellDeny {
  return {
    match: [facts.trustedCommand("*"), ...facts.dispatcherCommands.map((command) => `aidlc ${command}`)],
    exclude: engineRouteExclusions({ facts, agent, engine: facts.trustedCommand("") }),
  };
}

export const RISKY_SHELL_FORMS = ["$", "`", ">", "<", "&", "@(", "@{", "\\n"] as const;

export const riskyFormDenyLines = (prefixes: readonly string[]): string[] => [
  "    - capability: shell",
  "      effect: deny",
  "      match:",
  ...prefixes.flatMap((prefix) => RISKY_SHELL_FORMS.map((form) => `        - "${prefix}*${form}*"`)),
];

export function splitShellDeny({ match, exclude }: ShellDeny): ShellDeny[] {
  const prefixes = match.filter((pattern) => pattern.endsWith("*"))
    .map((pattern) => pattern.slice(0, -1))
    .sort((a, b) => b.length - a.length);
  const patterns = exclude.map((pattern) => {
    const prefix = prefixes.find((candidate) => pattern.startsWith(candidate));
    const word = prefix === undefined ? "" : pattern.slice(prefix.length).split(" ")[0] ?? "";
    return { pattern, command: word === "" || /[*?]/.test(word) ? null : `${prefix}${word}` };
  });
  const commands = patterns.reduce((groups, { command, pattern }) => command === null ? groups :
    new Map([...groups, [command, [...groups.get(command) ?? [], pattern]]]), new Map<string, string[]>());
  const unsplit = patterns.filter(({ command }) => command === null).map(({ pattern }) => pattern);
  return [
    { match, exclude: [...unsplit, ...[...commands.keys()].flatMap(both)] },
    ...[...commands].map(([command, excludes]) => ({ match: [`${command} *`], exclude: excludes })),
  ];
}

export const shellDenyLines = (deny: ShellDeny): string[] =>
  splitShellDeny(deny).flatMap(({ match, exclude }) => [
    "    - capability: shell",
    "      effect: deny",
    "      match:",
    ...match.map((pattern) => `        - "${pattern}"`),
    "      exclude:",
    ...exclude.map((pattern) => `        - "${pattern}"`),
  ]);

export const kiroIdeDelegateShellPolicy = ({ facts, directory }: {
  facts: DelegateShellFacts;
  directory: string;
}): DelegateShellPolicy => ({
  shellDeny: (agent) => [
    ...shellDenyLines(copyChannelDelegateShellDeny({ facts, harnessDir: directory, agent })),
    ...riskyFormDenyLines([`bun ${directory}/tools/aidlc`]),
  ],
  riskyForms: RISKY_SHELL_FORMS,
});
