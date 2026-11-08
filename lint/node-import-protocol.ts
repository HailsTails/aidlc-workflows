import { builtinModules } from "node:module";
import type { Rule } from "eslint";

const isNodeBuiltin = (name: string): boolean =>
  !name.startsWith("_") && !name.includes(":") && name !== "bun";

const BUILTINS = new Set(builtinModules.filter(isNodeBuiltin));

const isBareBuiltin = (source: unknown): source is string =>
  typeof source === "string" && BUILTINS.has(source.split("/")[0] ?? source);

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
      const value = node.source?.value;
      if (isBareBuiltin(value)) {
        context.report({ node, messageId: "protocol", data: { name: value } });
      }
    };
    return {
      ImportDeclaration: check,
      ExportNamedDeclaration: check,
      ExportAllDeclaration: check,
    };
  },
};
