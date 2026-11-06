import { compilePluginRuntimeDeclaration, type DeclarationBundle, type PluginRuntimePort, type PreparedRuntime, type ProjectedPluginRuntime, type RuntimeCompilerPort } from "./plugin-runtime.ts";

export type PluginDeclarationPort = Pick<PluginRuntimePort, "declaration">;

type DeclarationAdmission = { readonly kind: "admitted"; readonly declarationFile: string } | Extract<PreparedRuntime, { readonly kind: "refused" }>;

function admitPluginDeclaration(input: { readonly file: string; readonly files: readonly string[] }): DeclarationAdmission {
  const declarationFile = input.file.replace(/\.([cm]?)[jt]s$/, ".d.$1ts");
  if (/\.d\.[cm]?ts$/.test(input.file) || declarationFile === input.file || input.files.includes(declarationFile)) return {
    kind: "refused", message: `plugin declaration collides with projected file or has no source extension: ${declarationFile}`,
  };
  return { kind: "admitted", declarationFile };
}

function preparedPluginDeclaration(input: {
  readonly declarationFile: string;
  readonly files: readonly string[];
  readonly declaration: DeclarationBundle;
}): PreparedRuntime {
  const collision = input.declaration.companions.find((artifact) => input.files.includes(artifact.file) || artifact.file === input.declarationFile);
  if (collision !== undefined) return { kind: "refused", message: `plugin declaration companion collides with projected file: ${collision.file}` };
  return { kind: "prepared", artifacts: [{ file: input.declarationFile, content: input.declaration.content }, ...input.declaration.companions] };
}

export function preparePluginDeclarationArtifacts(input: {
  readonly pluginRoot: string;
  readonly file: string;
  readonly files: readonly string[];
  readonly port: PluginDeclarationPort;
}): PreparedRuntime {
  const admission = admitPluginDeclaration(input);
  if (admission.kind === "refused") return admission;
  return preparedPluginDeclaration({
    declarationFile: admission.declarationFile, files: input.files,
    declaration: input.port.declaration({ pluginRoot: input.pluginRoot, file: input.file }),
  });
}

export async function preparePluginDeclarationRuntime(input: {
  readonly pluginRoot: string;
  readonly file: string;
  readonly files: readonly string[];
  readonly port: Pick<RuntimeCompilerPort, "declaration">;
}): Promise<ProjectedPluginRuntime> {
  const admission = admitPluginDeclaration(input);
  if (admission.kind === "refused") return admission;
  const declared = await compilePluginRuntimeDeclaration(input);
  if (declared.kind === "unavailable") return declared;
  return preparedPluginDeclaration({ declarationFile: admission.declarationFile, files: input.files, declaration: declared.compiled });
}
