// Native command spelling; caller supplies canonical route facts.
// No files, permissions, trust, onboarding, descriptors or runtime registration.
export type NativeCommandContext = {
  readonly harnessDir: string;
  readonly toolFiles: readonly string[];
  readonly prefix: string;
  readonly command: (input: { readonly suffix: string }) => string;
  readonly namespaceProblems: (input: { readonly source: string; readonly subject: string }) => readonly string[];
};
type CommandPatterns = { readonly tool: RegExp; readonly bare: RegExp; readonly workspace: RegExp; readonly config: RegExp };
const escaped = ({ text }: { readonly text: string }): string => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const commandPatterns = ({ context }: { readonly context: NativeCommandContext }): CommandPatterns => {
  const harnessDir = escaped({ text: context.harnessDir });
  const delegates = context.toolFiles.map((file) => escaped({ text: file.slice("aidlc-".length, -".ts".length) })).join("|");
  const projectPrefix = String.raw`(?:"?(?:\$\{?CLAUDE_PROJECT_DIR\}?/)?`;
  const suffix = `"?)`;
  return {
    tool: new RegExp(String.raw`\bbun\s+${projectPrefix}${harnessDir}/tools/aidlc(?:-([a-z0-9-]+))?\.ts${suffix}`, "gi"),
    bare: new RegExp(String.raw`\bbun\s+aidlc-(${delegates})\.ts`, "gi"),
    workspace: new RegExp(String.raw`\bbun\s+${projectPrefix}${harnessDir}/tools/aidlc-utility\.ts${suffix}\s+(codekb-path|codekb-scope-diff|codekb-snapshot|codekb-publish|project-description|document-input)\b`, "gi"),
    config: new RegExp(String.raw`\bbun\s+${projectPrefix}${harnessDir}/tools/aidlc-utility\.ts${suffix}\s+config-change\s+--(depth|test-strategy|review|guard-policy|change-control|sensors|learnings|summary-confirmation|guard\.(?:plan-approval|review-freeze|state-transition|reviewer-scope))\b`, "gi"),
  };
};
export const projectNativeCommandText = ({ source, context }: { readonly source: string; readonly context: NativeCommandContext }): string => {
  const patterns = commandPatterns({ context });
  const routed = source
    .replace(patterns.workspace, (_match, verb: string) => `${context.command({ suffix: "workspace" })} ${verb === "codekb-path" ? "codekb" : verb}`)
    .replace(patterns.config, (_match, key: string) => context.command({ suffix: `config set ${key}` }));
  return routed
    .replace(patterns.tool, (_match, delegate: string | undefined) => delegate ? context.command({ suffix: delegate }) : context.prefix)
    .replace(patterns.bare, (_match, delegate: string) => context.command({ suffix: delegate }));
};
export const nativeCommandTextProblems = ({ source, context, subject, namespaceSource = source }: { readonly source: string; readonly context: NativeCommandContext; readonly subject: string; readonly namespaceSource?: string }): readonly string[] => {
  const harnessDir = escaped({ text: context.harnessDir });
  const patterns = commandPatterns({ context });
  return [
    ...["{{INVOKE}}", "{{TOOL_PREFIX}}", "{{OPTION_LETTERS}}"].filter((token) => source.includes(token)).map((token) => `${subject}: unexpanded ${token}`),
    ...(new RegExp(String.raw`\bbun\s+[^\n]*${harnessDir}/(?:tools|hooks)/aidlc`).test(source) ? [`${subject}: bun invocation survived native projection`] : []),
    ...(patterns.bare.test(source) ? [`${subject}: bare bun invocation survived native projection`] : []),
    ...(/\baidlc\s+engine\s+(?:utility|runner-gen)\b/.test(source) ? [`${subject}: retired engine alias survived native projection`] : []),
    ...context.namespaceProblems({ source: namespaceSource, subject }),
  ];
};
export type NativeDocumentText = { readonly status: "ok"; readonly text: string } | { readonly status: "invalid"; readonly problems: readonly string[] };
export const prepareNativeDocumentText = ({ source, context, subject, namespaceLiterals = [] }: { readonly source: string; readonly context: NativeCommandContext; readonly subject: string; readonly namespaceLiterals?: readonly string[] }): NativeDocumentText => {
  const text = projectNativeCommandText({ source, context });
  const namespaceSource = prepareNativeNamespaceSource(text, namespaceLiterals);
  if (namespaceSource === null) return { status: "invalid", problems: [`${subject}: native permission literals require exact unique coverage`] };
  const problems = nativeCommandTextProblems({ source: text, context, subject, namespaceSource });
  return problems.length > 0 ? { status: "invalid", problems } : { status: "ok", text };
};

// Only source-backed native permission literals are excluded from command-name scanning.
// Token, surviving Bun and retired-alias validation still inspect the complete text.
export function prepareNativeNamespaceSource(text: string, literals: readonly string[]): string | null {
  if (new Set(literals).size !== literals.length || literals.some(literal => literal.length === 0 || text.split(literal).length !== 2)) return null;
  let source = text;
  for (const literal of literals) { if (source.split(literal).length !== 2) return null; source = source.replace(literal, literal.replace(/[^\r\n]/g, " ")); }
  return source;
}
