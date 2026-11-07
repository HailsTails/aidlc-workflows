export type ClaudeCopyCommandAuthority = Readonly<{
  dispatcherCommands: () => readonly string[];
  toolScripts: () => readonly string[];
}>;
export type ClaudeNativeCommandAuthority = Readonly<{
  trustedCommand: (input: Readonly<{ args: string }>) => string;
  dispatcherCommands: () => readonly string[];
}>;
export type ClaudeAllowListRefusal = Readonly<{ kind: "refused"; message: string }>;
export type PreparedClaudeAllowList = Readonly<{ kind: "prepared"; allow: readonly unknown[] }> | ClaudeAllowListRefusal;
type AdmittedClaudeCopyAllowList = Readonly<{ kind: "admitted"; allow: readonly unknown[]; glob: string }> | ClaudeAllowListRefusal;
type AdmittedClaudeNativeAllowList = Readonly<{ kind: "admitted"; allow: readonly unknown[] }> | ClaudeAllowListRefusal;

function admitClaudeCopyAllowList({ allow }: Readonly<{ allow: unknown }>): AdmittedClaudeCopyAllowList {
  const glob = Array.isArray(allow)
    ? allow.find((entry: unknown): entry is string => typeof entry === "string" && /^Bash\(bun \S+\/tools\/aidlc-\*\)$/.test(entry))
    : undefined;
  if (!Array.isArray(allow) || glob === undefined) return { kind: "refused", message: "[claude] settings.json has no Bash(bun <dir>/tools/aidlc-*) entry to expand" };
  return { kind: "admitted", allow, glob };
}

function expandSelectedClaudeGlob({ allow, glob, authority }: Readonly<{ allow: readonly unknown[]; glob: string; authority: ClaudeCopyCommandAuthority }>): readonly unknown[] {
  const toolsDir = glob.slice("Bash(bun ".length, -"/aidlc-*)".length);
  const tool = ({ script }: Readonly<{ script: string }>) => `Bash(bun ${toolsDir}/${script}`;
  return allow.flatMap((entry) => entry === glob ? [
    ...authority.dispatcherCommands().map((command) => `${tool({ script: "aidlc.ts" })} ${command})`),
    ...authority.toolScripts().flatMap((script) => [`${tool({ script })})`, `${tool({ script })} *)`]),
  ] : [entry]);
}

export function prepareClaudeCopyAllowList({ allow, authority }: Readonly<{ allow: unknown; authority: ClaudeCopyCommandAuthority }>): PreparedClaudeAllowList {
  const admitted = admitClaudeCopyAllowList({ allow });
  if (admitted.kind === "refused") return admitted;
  return { kind: "prepared", allow: expandSelectedClaudeGlob({ allow: admitted.allow, glob: admitted.glob, authority }) };
}

function admitClaudeNativeAllowList({ allow }: Readonly<{ allow: unknown }>): AdmittedClaudeNativeAllowList {
  if (!Array.isArray(allow)) return { kind: "refused", message: "[claude] settings.json has no permissions.allow list" };
  return { kind: "admitted", allow };
}

function nativeClaudeAllows({ allow, authority }: Readonly<{ allow: readonly unknown[]; authority: ClaudeNativeCommandAuthority }>): readonly unknown[] {
  return [
    ...allow.filter((entry) => entry !== "Bash" && !(typeof entry === "string" && (entry.startsWith("Bash(bun ") || entry.startsWith("Bash(aidlc ")))),
    `Bash(${authority.trustedCommand({ args: "*" })})`,
    ...authority.dispatcherCommands().map((command) => `Bash(${command})`),
  ];
}

export function prepareClaudeNativeAllowList({ allow, authority }: Readonly<{ allow: unknown; authority: ClaudeNativeCommandAuthority }>): PreparedClaudeAllowList {
  const admitted = admitClaudeNativeAllowList({ allow });
  if (admitted.kind === "refused") return admitted;
  return { kind: "prepared", allow: nativeClaudeAllows({ allow: admitted.allow, authority }) };
}
