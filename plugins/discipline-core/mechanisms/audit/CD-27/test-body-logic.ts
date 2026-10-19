import type { PieceHit, WalkerPiece } from "../runner/walker-piece.ts";
import { folderScope } from "../runner/source-scope.ts";

const testFileEligibility = (request: { readonly file: string }): "eligible" | "skipped" => {
  if (folderScope({ file: request.file }) === "generated") return "skipped";
  return request.file.endsWith(".test.ts") || request.file.endsWith(".test.tsx") ? "eligible" : "skipped";
};

const BANNED_DYNAMIC_METHODS: readonly string[] = [
  "at", "charAt", "charCodeAt", "codePointAt", "concat", "endsWith", "entries", "every", "filter", "find",
  "findIndex", "findLast", "findLastIndex", "flat", "flatMap", "forEach", "includes", "indexOf", "join",
  "keys", "lastIndexOf", "localeCompare", "map", "match", "matchAll", "normalize", "padEnd", "padStart",
  "reduce", "reduceRight", "repeat", "replace", "replaceAll", "search", "slice", "some", "sort", "split",
  "startsWith", "substr", "substring", "toLocaleLowerCase", "toLocaleUpperCase", "toLowerCase", "toReversed",
  "toSorted", "toSpliced", "toUpperCase", "trim", "trimEnd", "trimStart", "values", "with",
];
const BANNED_MUTATION_METHODS: readonly string[] = ["copyWithin", "fill", "pop", "push", "reverse", "shift", "splice", "unshift"];

const snippetAt = (request: { readonly source: string; readonly position: number }): string => {
  const snippet = request.source.slice(request.position, request.position + 80).replace(/\n/g, " ");
  return snippet.length === 80 ? `${snippet}…` : snippet;
};

export const check: WalkerPiece = {
  prepare: ({ clauses, syntaxApi }) => ({
    outcome: "ok",
    value: {
      prepareFile: ({ file }) => {
        if (testFileEligibility({ file }) === "skipped") {
          return { outcome: "ok", value: { kind: "skipped" } };
        }
        return {
          outcome: "ok",
          value: {
            kind: "syntax",
            begin: ({ sourceFile, anchorAt }) => {
              const hits: PieceHit[] = [];
              return {
                enter: ({ node }) => {
                  const isStructural = syntaxApi.isIfStatement(node) || syntaxApi.isTryStatement(node) ||
                    syntaxApi.isConditionalExpression(node) ||
                    (syntaxApi.isVariableStatement(node) &&
                      (node.declarationList.flags & syntaxApi.NodeFlags.Let) === syntaxApi.NodeFlags.Let);
                  const methodName = syntaxApi.isCallExpression(node) && syntaxApi.isPropertyAccessExpression(node.expression)
                    ? node.expression.name.text
                    : undefined;
                  if (!isStructural && (methodName === undefined ||
                    (!BANNED_DYNAMIC_METHODS.includes(methodName) && !BANNED_MUTATION_METHODS.includes(methodName)))) return;
                  const position = node.getStart(sourceFile);
                  const anchor = anchorAt({ position });
                  const snippet = snippetAt({ source: sourceFile.text, position });
                  hits.push(...clauses.map((clause) => ({ clause: clause.address, anchor, snippet })));
                },
                finish: () => hits,
              };
            },
          },
        };
      },
      finish: () => ({ outcome: "ok", value: [] }),
    },
  }),
};
