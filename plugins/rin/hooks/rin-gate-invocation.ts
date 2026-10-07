import { basename, dirname, join, resolve } from "node:path";

const shellTokensOf = (command: string): readonly string[] =>
  [...command.matchAll(/"(?:\\.|[^"\\])*"|'[^']*'|&&|\|\||[;|&\n]|[^\s;|&]+/g)]
    .map((match) => match[0]);

const unquoted = (token: string): string =>
  /^["']/.test(token) ? token.slice(1, -1) : token;

const completionSegment = (tokens: readonly string[]): boolean => {
  const executableIndex = tokens.findIndex((token, index) => !["env", "command", "exec"].includes(token) && !/^[A-Za-z_][A-Za-z0-9_]*=/.test(token) && !(token === "--" && tokens.slice(0, index).some((prefix) => ["env", "command", "exec"].includes(prefix))));
  const invocation = tokens.slice(executableIndex).map(unquoted);
  const executable = invocation[0]?.replace(/\\/g, "/").split("/").at(-1);
  const sourceOffset = invocation[1] === "run" ? 2 : 1;
  const source = executable === "bun" || executable === "bun.exe" ? invocation[sourceOffset] : undefined;
  const sourceName = source?.replace(/\\/g, "/").split("/").at(-1);
  const offset = source ? sourceOffset + 1 : 1;
  const args = invocation.slice(offset).filter((token, index, all) =>
    !["--json", "--quiet", "--no-color", "--yes", "--offline", "--verbose", "--project-dir"].includes(token) && all[index - 1] !== "--project-dir" && !token.startsWith("--project-dir="));
  const route = sourceName === "aidlc-orchestrate.ts"
    ? ["report"]
    : executable === "aidlc" || sourceName === "aidlc.ts"
      ? ["engine", "orchestrate", "report"]
      : [];
  return route.length > 0 &&
    route.every((token, index) => args[index] === token) &&
    args.slice(route.length).some((token, index, args) =>
      token === "--result" && ["approved", "completed"].includes(args[index + 1] ?? ""));
};

export const isCompletionReport = (input: { readonly command: string }): boolean => {
  const segments: string[][] = [[]];
  shellTokensOf(input.command).forEach((token) => {
    if ([";", "|", "&", "&&", "||", "\n"].includes(token)) {
      segments.push([]);
    } else {
      segments.at(-1)?.push(token);
    }
  });
  return segments.some(completionSegment);
};

export const gateToolsDirectoryOf = (input: {
  readonly hookDirectory: string;
  readonly checkoutRoot: string;
}): string =>
  basename(dirname(input.hookDirectory)).startsWith(".")
    ? resolve(input.hookDirectory, "..", "tools")
    : join(input.checkoutRoot, ".claude", "tools");

export const gateScopeGridPathOf = (input: {
  readonly hookDirectory: string;
  readonly checkoutRoot: string;
}): string => {
  const host = basename(dirname(input.hookDirectory));
  return join(input.checkoutRoot, host.startsWith(".") ? host : ".claude", "tools", "data", "scope-grid.json");
};
