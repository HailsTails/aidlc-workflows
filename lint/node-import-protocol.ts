import type { Rule } from "./eslint-port.ts";
import { NODE_BUILTINS } from "./node-builtins.ts";

const BARE_BUILTINS = new Set(
  NODE_BUILTINS.filter((name) => !name.startsWith("_") && !name.includes(":") && name !== "bun"),
);

const isBareBuiltin = (source: unknown): source is string =>
  typeof source === "string" && BARE_BUILTINS.has(source.split("/")[0] ?? source);

export const nodeImportProtocol: Rule.RuleModule = {
  meta: {
    type: "suggestion",
    messages: {
      protocol: "Import Node built-ins through node:{{name}} so a package can never shadow them.",
    },
    schema: [],
  },
  create: (context) => {
    type ModuleReference = Rule.Node & {
      readonly source?: { readonly value?: unknown } | null | undefined;
    };
    const check = (node: ModuleReference): void => {
      const specifier = node.source?.value;
      if (isBareBuiltin(specifier)) {
        context.report({ node, messageId: "protocol", data: { name: specifier } });
      }
    };
    return {
      ImportDeclaration: check,
      ExportNamedDeclaration: check,
      ExportAllDeclaration: check,
    };
  },
};
