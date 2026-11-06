export type PluginRuntimeSelection = {
  readonly kind: "selected";
  readonly files: readonly string[];
  readonly closedModules: readonly string[];
} | { readonly kind: "not-needed" } | { readonly kind: "refused"; readonly message: string };

export function selectPluginRuntimeProducts(input: {
  readonly harness: string;
  readonly files: readonly string[];
  readonly commandScripts: readonly string[];
}): PluginRuntimeSelection {
  const commands = [...new Set(input.commandScripts)];
  const missing = commands.find((script) => !input.files.includes(script));
  if (missing !== undefined) return { kind: "refused", message: `declared plugin command was not projected: ${missing}` };
  const collision = commands.find((script) => input.files.filter((file) => file === script).length !== 1);
  if (collision !== undefined) return { kind: "refused", message: `declared plugin command has ambiguous projected ownership: ${collision}` };
  const files = input.harness === "claude" ? input.files : commands;
  if (files.length === 0) return { kind: "not-needed" };
  return {
    kind: "selected",
    files,
    closedModules: commands,
  };
}
