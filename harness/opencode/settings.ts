import { isBuiltin } from "node:module";
import { substituteAuthoredTokens } from "../../scripts/projection-text.ts";
import { prepareNativeRuntimeText } from "../../scripts/native-runtime-text.ts";
import { TRUSTED_ROUTE_NAMESPACE, TRUSTED_COMMAND_PREFIX } from "../../core/tools/aidlc-command.ts";

// The native shell uses the engine inventory, never a second tool-discovery rule.
export function prepareOpenCodeSurfaces(input: { readonly invocation: string; readonly beforeHost?: boolean; readonly files: readonly string[]; readonly adapter: string; readonly command: string; readonly config: string }): readonly { readonly path: string; readonly text: string }[] {
  if (!["aidlc", "bun .aidlc/tools/aidlc.ts"].includes(input.invocation)) throw new Error("OpenCode requires explicit copy or native delivery");
  const entries = input.files.filter(path => /^\.aidlc\/(?:hooks|tools)\/[^/]+\.ts$/.test(path)).map(path => path.slice(".aidlc/".length)).sort();
  if (!entries.includes("tools/aidlc.ts") || new Set(entries).size !== entries.length) throw new Error("OpenCode requires a unique final engine inventory");
  const imports = new Bun.Transpiler({ loader: "ts" }).scanImports(input.adapter);
  if (imports.some(dependency => dependency.path !== "../../../core/tools/aidlc-executable-path.ts" && !(dependency.path.startsWith("node:") && isBuiltin(dependency.path)))) throw new Error("OpenCode adapter admits only the executable path leaf and Node built-ins");
  const marker = "/* @aidlc-shipped-entrypoints@ */ []";
  if (input.adapter.split(marker).length !== 2) throw new Error("OpenCode requires exactly one inventory marker");
  const leafImport = '"../../../core/tools/aidlc-executable-path.ts"';
  if (input.adapter.split(leafImport).length !== 2 || !entries.includes("tools/aidlc-executable-path.ts")) throw new Error("OpenCode requires its executable path leaf in the engine inventory");
  const list = JSON.stringify(entries, null, 2).split("\n").map((line, index) => index === 0 ? line : "  " + line).join("\n");
  const adapter = input.adapter.replace(marker, "/* @aidlc-shipped-entrypoints@ */ " + list).replace(leafImport, '"../../.aidlc/tools/aidlc-executable-path.ts"');
  const project = (source: string): string => {
    const copy = substituteAuthoredTokens({ source, harnessDir: ".aidlc", binding: { invoke: input.invocation, toolPrefix: input.invocation === "aidlc" ? TRUSTED_COMMAND_PREFIX + " " : "bun .aidlc/tools/", trustedNamespace: TRUSTED_ROUTE_NAMESPACE } });
    return input.invocation === "aidlc" && !input.beforeHost ? prepareNativeRuntimeText(copy, ".aidlc", "opencode") : copy;
  };
  const config = project(input.config);
  JSON.parse(config);
  return [
    { path: ".opencode/plugin/aidlc-opencode-adapter.ts", text: project(adapter) },
    { path: ".opencode/command/aidlc.md", text: project(input.command) },
    { path: "opencode.json", text: config },
  ];
}
