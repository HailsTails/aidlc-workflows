export type CursorCopyCommandAuthority = Readonly<{
  dispatcherCommands: () => readonly string[];
  toolScripts: () => readonly string[];
}>;
export type CursorNativeCommandAuthority = Readonly<{
  dispatcherCommands: () => readonly string[];
  trustedShell: () => string;
}>;
export type PreparedCursorAllowList =
  | Readonly<{ kind: "prepared"; allow: readonly unknown[] }>
  | Readonly<{ kind: "refused"; message: string }>;
export function prepareCursorCopyAllowList({
  allow,
  authority,
}: Readonly<{ allow: unknown; authority: CursorCopyCommandAuthority }>): PreparedCursorAllowList {
  const glob = "Shell(bun:.cursor/tools/aidlc-*)";
  if (!Array.isArray(allow) || !allow.includes(glob))
    return { kind: "refused", message: "[cursor] cli.json has no " + glob + " entry to expand" };
  const tool = (script: string) => "Shell(bun:.cursor/tools/" + script;
  return {
    kind: "prepared",
    allow: allow.flatMap((entry) =>
      entry === glob
        ? [
            ...authority.dispatcherCommands().map((command) => tool("aidlc.ts") + " " + command + ")"),
            ...authority.toolScripts().flatMap((script) => [tool(script) + ")", tool(script) + " *)"]),
          ]
        : [entry],
    ),
  };
}
export function prepareCursorNativeAllowList({
  allow,
  authority,
}: Readonly<{ allow: unknown; authority: CursorNativeCommandAuthority }>): PreparedCursorAllowList {
  if (!Array.isArray(allow)) return { kind: "refused", message: "[cursor] cli.json has no permissions.allow list" };
  return {
    kind: "prepared",
    allow: [
      ...allow.filter((entry) => typeof entry !== "string" || !entry.startsWith("Shell(bun")),
      authority.trustedShell(),
      ...authority.dispatcherCommands().map((command) => "Shell(aidlc:" + command + ")"),
    ],
  };
}
