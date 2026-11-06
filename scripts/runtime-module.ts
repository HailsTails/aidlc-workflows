import { TRUSTED_COMMAND_PREFIX, TRUSTED_ROUTE_NAMESPACE } from "../core/tools/aidlc-command.ts";

export type RuntimeModulePreparation = { readonly kind: "prepared"; readonly content: string } | { readonly kind: "refused"; readonly message: string };
export type RuntimeModuleTextRequest = { readonly file: string; readonly source: string; readonly harnessDir: string; readonly invoke: string; readonly sourceVersion: string; readonly buildVersion: string };

export function substituteRuntimeInvocation({ source, harnessDir, invoke }: { readonly source: string; readonly harnessDir: string; readonly invoke: string }): string {
  const toolPrefix = invoke === "aidlc" ? `${TRUSTED_COMMAND_PREFIX} ` : `bun ${harnessDir}/tools/`;
  return source.replace(/\{\{INVOKE\}\}/g, invoke).replace(/\{\{TOOL_PREFIX\}\}/g, toolPrefix).replace(/\{\{TRUSTED_NAMESPACE\}\}/g, TRUSTED_ROUTE_NAMESPACE);
}

function stampRuntimeVersion({ source, sourceVersion, buildVersion }: Pick<RuntimeModuleTextRequest, "source" | "sourceVersion" | "buildVersion">): RuntimeModulePreparation {
  if (buildVersion === sourceVersion) return { kind: "prepared", content: source };
  const assignment = /^export const AIDLC_VERSION = "[^"]+";$/m;
  const matches = source.match(new RegExp(assignment.source, "gm")) ?? [];
  if (matches.length !== 1) return { kind: "refused", message: `aidlc-version.ts must declare exactly one AIDLC_VERSION assignment, found ${matches.length}` };
  return { kind: "prepared", content: source.replace(assignment, `export const AIDLC_VERSION = "${buildVersion}";`) };
}

function prepareVersionedModule(input: RuntimeModuleTextRequest): RuntimeModulePreparation {
  if (input.file !== "aidlc-version.ts") return { kind: "prepared", content: input.source };
  return stampRuntimeVersion(input);
}

export function prepareRuntimeModuleText(input: RuntimeModuleTextRequest): RuntimeModulePreparation {
  const versioned = prepareVersionedModule(input);
  if (versioned.kind === "refused") return versioned;
  return { kind: "prepared", content: substituteRuntimeInvocation({ source: versioned.content, harnessDir: input.harnessDir, invoke: input.invoke }) };
}
