import type ts from "typescript";
import type { RepoPath } from "../../../core/values/repo-path.ts";
import { inspectParsedFiles, sourceSnippet } from "../runner/legacy-source.ts";
import type { LocatedSnippet } from "../runner/walker-check.ts";
import type { TypeScriptWalkerCheck } from "../runner/typescript-parse.ts";

export const check: TypeScriptWalkerCheck = {
  kind: "repository",
  inspect: ({ repository }) => inspectParsedFiles({
    repository,
    inspect: ({ file, parsed, syntaxApi: ts }) => {
      const BANNED_SHORTHAND_NAMES: readonly string[] = [
        "c",
        "op",
        "s",
        "cb",
        "fn",
        "tx",
        "e",
        "ev",
        "acc",
        "item",
        "k",
        "v",
        "el",
        "arr",
        "i",
        "j",
        "n",
        "obj",
        "val",
        "res",
        "req",
        "tmp",
        "temp",
      ];

      const BANNED_FILLER_NAMES: readonly string[] = [
        "object",
        "obj",
        "args",
        "arguments",
        "details",
        "extra",
        "extras",
        "data",
        "info",
        "params",
        "parameters",
        "props",
        "payload",
        "body",
        "value",
        "result",
        "stuff",
        "things",
        "misc",
        "metadata",
      ];

      const classifyName = (
        identifierText: string,
      ): "shorthand" | "filler" | "ok" => {
        if (BANNED_SHORTHAND_NAMES.includes(identifierText)) {
          return "shorthand";
        }
        if (BANNED_FILLER_NAMES.includes(identifierText)) {
          return "filler";
        }
        return "ok";
      };

      const extractBindingIdentifiers = (
        binding: ts.BindingName,
      ): readonly ts.Identifier[] => {
        if (ts.isIdentifier(binding)) {
          return [binding];
        }
        if (ts.isObjectBindingPattern(binding) || ts.isArrayBindingPattern(binding)) {
          return binding.elements.flatMap((element) => {
            if (ts.isOmittedExpression(element)) {
              return [];
            }
            return extractBindingIdentifiers(element.name);
          });
        }
        return [];
      };

      const isExternallyMandatedUnused = (identifierText: string): boolean =>
        identifierText.startsWith("_");

      const violationsFromBinding = ({
        file,
        sourceFile,
        binding,
      }: {
        readonly file: RepoPath;
        readonly sourceFile: ts.SourceFile;
        readonly binding: ts.BindingName;
      }): readonly LocatedSnippet[] =>
        extractBindingIdentifiers(binding).flatMap((identifier) => {
          if (isExternallyMandatedUnused(identifier.text)) {
            return [];
          }
          const classification = classifyName(identifier.text);
          if (classification === "ok") {
            return [];
          }
          return [sourceSnippet({ file, tree: sourceFile, node: identifier })];
        });

      const violationsFromNode = ({
        file,
        sourceFile,
        node,
      }: {
        readonly file: RepoPath;
        readonly sourceFile: ts.SourceFile;
        readonly node: ts.Node;
      }): readonly LocatedSnippet[] => {
        if (ts.isVariableDeclaration(node)) {
          return violationsFromBinding({ file, sourceFile, binding: node.name });
        }
        if (ts.isParameter(node)) {
          return violationsFromBinding({ file, sourceFile, binding: node.name });
        }
        if (ts.isFunctionDeclaration(node) && node.name !== undefined) {
          if (isExternallyMandatedUnused(node.name.text)) {
            return [];
          }
          const classification = classifyName(node.name.text);
          if (classification === "ok") {
            return [];
          }
          return [
            sourceSnippet({ file, tree: sourceFile, node: node.name }),
          ];
        }
        return [];
      };

      return parsed.nodes.flatMap((node) => violationsFromNode({ file, sourceFile: parsed.tree, node }));
    },
  }),
};
