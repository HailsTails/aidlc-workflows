import { brand, type Brand } from "../../kernel/brand.ts";
import type { HostIdentity } from "../../kernel/host.ts";
import type { FileMode } from "../../kernel/file-content.ts";
import type { ProjectPath } from "../../kernel/values.ts";
import type { NativeCommandRoutes } from "./native-command.ts";
import { nativePermissionsLine, type NativePermissionPolicy } from "./onboarding-context.ts";
import type { AdmittedOnboardingTemplates } from "./onboarding-source.ts";
import type { ProjectedFile } from "./projected-file.ts";
import { LEGACY_NATIVE_GUIDANCE } from "./legacy-native-guidance.ts";
import { channelTokens } from "./channel-tokens.ts";

type LegacyMeaning = "escaped-dispatcher" | "escaped-hook" | "workspace" | "configuration"
  | "dispatcher" | "delegate" | "hook" | "allowlist" | "invoke-token" | "tools-token"
  | "namespace-token" | "runtime-guidance" | "hook-guidance" | "permissions-guidance"
  | "tools-guidance" | "cwd-guidance" | "host-native-block";

export type LegacyNativeReplacement = Readonly<{ readonly from: string; readonly to: string }>;

export type LegacyAuthoringOccurrence = Readonly<{
  readonly meaning: LegacyMeaning;
  readonly stage: number;
  readonly offset: number;
  readonly spelling: string;
  readonly emitted: string;
}>;

export type LegacyOnboardingDialect = Brand<Readonly<{
  readonly captured: AdmittedOnboardingTemplates;
  readonly host: HostIdentity;
  readonly commands: NativeCommandRoutes;
  readonly permissions: NativePermissionPolicy;
  readonly replacements: readonly LegacyNativeReplacement[];
}>, "LegacyOnboardingDialect">;

export type LegacyAuthoringFragment = Readonly<{
  readonly kind: "authored-onboarding" | "host-framing";
  readonly text: string;
}>;

export type LegacyNativeProgram = Brand<Readonly<{
  readonly declaredTemplates: AdmittedOnboardingTemplates;
  readonly path: ProjectPath;
  readonly mode: FileMode;
  readonly fragments: readonly LegacyAuthoringFragment[];
  readonly sourceText: string;
  readonly nativeText: string;
  readonly occurrences: readonly LegacyAuthoringOccurrence[];
  readonly replacements: readonly (LegacyNativeReplacement & { readonly found: boolean })[];
}>, "LegacyNativeProgram">;

export const captureLegacyOnboardingDialect = (request: {
  readonly captured: AdmittedOnboardingTemplates;
  readonly host: HostIdentity;
  readonly commands: NativeCommandRoutes;
  readonly permissions: NativePermissionPolicy;
  readonly replacements: readonly LegacyNativeReplacement[];
}): LegacyOnboardingDialect => brand<LegacyOnboardingDialect>(Object.freeze({ ...request,
  replacements: Object.freeze(request.replacements.map(replacement => Object.freeze({ ...replacement }))) }));

const escape = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// These are the legacy dialect's string-substitution operators, not command trust.
const substitution = (request: {
  readonly value: string; readonly source: string; readonly offset: number; readonly spelling: string;
}): string => request.value.replace(/\$(\$|&|`|')/g, (_marker, operator: string) => {
  if (operator === "$") return "$";
  if (operator === "&") return request.spelling;
  return operator === "`" ? request.source.slice(0, request.offset)
    : request.source.slice(request.offset + request.spelling.length);
});

const compile = (source: string, dialect: LegacyOnboardingDialect) => {
  const occurrences: LegacyAuthoringOccurrence[] = [];
  let text = source;
  let stage = 0;
  const parse = (meaning: LegacyMeaning, expression: RegExp,
    emit: (match: RegExpExecArray) => string): void => {
    const input = text;
    const parts: string[] = [];
    let through = 0;
    for (const mention of input.matchAll(expression)) {
      const offset = mention.index;
      const emitted = emit(mention);
      occurrences.push(Object.freeze({ meaning, stage, offset, spelling: mention[0], emitted }));
      parts.push(input.slice(through, offset), emitted);
      through = offset + mention[0].length;
    }
    parts.push(input.slice(through));
    text = parts.join("");
    stage += 1;
  };
  const literal = (meaning: LegacyMeaning, expression: RegExp, value: string): void =>
    parse(meaning, expression, mention => substitution({ value, source: text,
      offset: mention.index, spelling: mention[0] }));
  const { host, commands } = dialect;
  const replacements = dialect.replacements.map(replacement => {
    const found = text.includes(replacement.from);
    literal("host-native-block", new RegExp(escape(replacement.from), "g"), replacement.to);
    return Object.freeze({ ...replacement, found });
  });
  const folder = escape(host.directory);
  const project = String.raw`(?:"?(?:\$\{?CLAUDE_PROJECT_DIR\}?/)?`;
  const quote = `"?)`;
  const hook = (name: string): string => commands.adapterHooks.has(name)
    ? commands.trusted(`adapter ${host.distribution}`)
    : commands.trusted(name === "statusline" ? "statusline" : `hook ${name}`);
  literal("escaped-dispatcher", new RegExp(
    String.raw`\bbun\s+\\"\$CLAUDE_PROJECT_DIR/${folder}/tools/aidlc\.ts\\"`, "gi"), "aidlc");
  parse("escaped-hook", new RegExp(
    String.raw`\bbun\s+\\"\$CLAUDE_PROJECT_DIR/${folder}/hooks/aidlc-([a-z0-9-]+)\.ts\\"`, "gi"),
  mention => hook(mention[1] ?? ""));
  parse("workspace", new RegExp(
    String.raw`\bbun\s+${project}${folder}/tools/aidlc-utility\.ts${quote}\s+(codekb-path|codekb-scope-diff|codekb-snapshot|codekb-publish|project-description|document-input)\b`, "gi"),
  mention => `${commands.trusted("workspace")} ${mention[1] === "codekb-path" ? "codekb" : mention[1]}`);
  parse("configuration", new RegExp(
    String.raw`\bbun\s+${project}${folder}/tools/aidlc-utility\.ts${quote}\s+config-change\s+--(depth|test-strategy|review|guard-policy|change-control|sensors|learnings|summary-confirmation|guard\.(?:plan-approval|review-freeze|state-transition|reviewer-scope))\b`, "gi"),
  mention => commands.trusted(`config set ${mention[1]}`));
  parse("dispatcher", new RegExp(
    String.raw`\bbun\s+${project}${folder}/tools/aidlc(?:-([a-z0-9-]+))?\.ts${quote}`, "gi"),
  mention => mention[1] === undefined ? commands.prefix : commands.trusted(mention[1]));
  parse("delegate", new RegExp(String.raw`\bbun\s+aidlc-(${commands.delegates.map(escape).join("|")})\.ts`, "gi"),
    mention => commands.trusted(mention[1] ?? ""));
  parse("hook", new RegExp(String.raw`\bbun\s+${project}${folder}/hooks/aidlc-([a-z0-9-]+)\.ts${quote}`, "gi"),
    mention => hook(mention[1] ?? ""));
  for (const spelling of [`"bun \\\\${host.directory}/tools/.*"`,
    `"bun \\\\$\\\\{?KIRO_PROJECT_DIR\\\\}?/${host.directory}/tools/.*"`]) {
    literal("allowlist", new RegExp(escape(spelling), "g"), `"${commands.trusted(".*")}"`);
  }
  const tokens = channelTokens({ channel: "native", directory: host.directory,
    prefix: commands.prefix, namespace: commands.namespace });
  literal("invoke-token", /\{\{INVOKE\}\}/g, tokens.INVOKE);
  literal("tools-token", /\{\{TOOL_PREFIX\}\}/g, tokens.TOOL_PREFIX);
  literal("namespace-token", /\{\{TRUSTED_NAMESPACE\}\}/g, tokens.TRUSTED_NAMESPACE);
  literal("runtime-guidance", /^- \*\*bun\*\*:.*$/gm, LEGACY_NATIVE_GUIDANCE.runtime);
  literal("hook-guidance", /^- \*\*Hook permissions\*\*:.*$/gm, LEGACY_NATIVE_GUIDANCE.hooks);
  parse("permissions-guidance", /^- \*\*Permissions\*\*:.*$/gm, mention => nativePermissionsLine({
    policy: dialect.permissions, prefix: commands.prefix, authored: mention[0] }));
  literal("tools-guidance", /TypeScript, run via bun/g, LEGACY_NATIVE_GUIDANCE.tools);
  literal("cwd-guidance", /^\*\*CWD drift warning\*\*: If a stage runs `cd` in Bash.*$/gm,
    LEGACY_NATIVE_GUIDANCE.cwd);
  return { nativeText: text, occurrences: Object.freeze(occurrences), replacements: Object.freeze(replacements) };
};

export const declareLegacyOnboardingFile = <File extends ProjectedFile>(request: {
  readonly dialect: LegacyOnboardingDialect | undefined;
  readonly fragments: readonly LegacyAuthoringFragment[];
  readonly file: File;
}): File & { readonly nativeAuthoring?: LegacyNativeProgram } => {
  if (request.dialect === undefined) return request.file;
  const fragments = Object.freeze(request.fragments.map(fragment => Object.freeze({ ...fragment })));
  const sourceText = fragments.map(fragment => fragment.text).join("");
  if (request.file.content.kind !== "text" || request.file.content.text !== sourceText) {
    throw new Error("The declared legacy source must be the serializer's exact input program.");
  }
  const program = brand<LegacyNativeProgram>(Object.freeze({ declaredTemplates: request.dialect.captured,
    path: request.file.path, mode: request.file.mode,
    fragments, sourceText, ...compile(sourceText, request.dialect) }));
  return { ...request.file, nativeAuthoring: program };
};

export const legacyNativeProgram = (file: ProjectedFile,
  replacements: readonly LegacyNativeReplacement[]): LegacyNativeProgram | undefined => {
  const program = file.nativeAuthoring;
  if (program === undefined || file.path !== program.path || file.mode !== program.mode
    || file.content.kind !== "text" || file.content.text !== program.sourceText) return undefined;
  if (program.replacements.length !== replacements.length || program.replacements.some((replacement, index) =>
    replacement.from !== replacements[index]?.from || replacement.to !== replacements[index]?.to)) return undefined;
  return program;
};

export const compiledLegacyNativeFile = (file: ProjectedFile,
  replacements: readonly LegacyNativeReplacement[] = []): ProjectedFile | undefined => {
  const program = legacyNativeProgram(file, replacements);
  if (program === undefined) return undefined;
  const { nativeAuthoring: _program, ...plain } = file;
  return { ...plain, content: { kind: "text", text: program.nativeText } };
};
