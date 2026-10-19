import type { PieceHit, WalkerPiece } from "../runner/walker-piece.ts";

const EXCLUDED_DIRECTORY_NAMES: ReadonlySet<string> = new Set([
  "node_modules", "dist", "dist-release", "build", "coverage", ".git", ".claude", "aidlc", ".aidlc",
]);
const EXCLUDED_ROOT_DIRECTORY_NAMES: ReadonlySet<string> = new Set([
  "vendor", ".codex", ".opencode", ".agents",
]);

const sourceEligibility = (request: { readonly file: string }): "eligible" | "excluded" => {
  if (!request.file.endsWith(".ts") && !request.file.endsWith(".tsx")) return "excluded";
  const parents = request.file.split("/").slice(0, -1);
  if (parents.some((directory) => EXCLUDED_DIRECTORY_NAMES.has(directory))) return "excluded";
  if (EXCLUDED_ROOT_DIRECTORY_NAMES.has(parents[0] ?? "")) return "excluded";
  return "eligible";
};

const SNIPPET_MAX_LENGTH = 80;
const BANNED_SHORTHAND_NAMES: readonly string[] = [
  "c", "op", "s", "cb", "fn", "tx", "e", "ev", "acc", "item", "k", "v",
  "el", "arr", "i", "j", "n", "obj", "val", "res", "req", "tmp", "temp",
];
const BANNED_FILLER_NAMES: readonly string[] = [
  "object", "obj", "args", "arguments", "details", "extra", "extras", "data",
  "info", "params", "parameters", "props", "payload", "body", "value", "result",
  "stuff", "things", "misc", "metadata",
];

type DeclarationHit = {
  readonly owner: number;
  readonly hit: PieceHit;
};

const classifyName = (request: { readonly name: string }): "shorthand" | "filler" | "ok" => {
  if (BANNED_SHORTHAND_NAMES.includes(request.name)) return "shorthand";
  if (BANNED_FILLER_NAMES.includes(request.name)) return "filler";
  return "ok";
};

export const check: WalkerPiece = {
  prepare: ({ clauses, syntaxApi }) => ({
    outcome: "ok",
    value: {
      prepareFile: ({ file }) => {
        if (sourceEligibility({ file }) === "excluded") {
          return { outcome: "ok", value: { kind: "skipped" } };
        }
        return {
          outcome: "ok",
          value: {
            kind: "syntax",
            begin: ({ sourceFile, anchorAt }) => {
              const owners: number[] = [];
              const hits: DeclarationHit[] = [];
              let nextOwner = 0;
              const recordName = (request: {
                readonly name: string;
                readonly position: number;
                readonly owner: number;
              }): void => {
                if (request.name.startsWith("_")) return;
                if (classifyName(request) === "ok") return;
                const snippet = sourceFile.text
                  .slice(request.position, request.position + SNIPPET_MAX_LENGTH)
                  .replace(/\n/g, " ");
                const anchor = anchorAt({ position: request.position });
                hits.push(...clauses.map((clause) => ({
                  owner: request.owner,
                  hit: {
                    clause: clause.address,
                    anchor,
                    snippet: snippet.length === SNIPPET_MAX_LENGTH ? snippet + "…" : snippet,
                  },
                })));
              };
              return {
                enter: ({ node }) => {
                  if (syntaxApi.isVariableDeclaration(node) || syntaxApi.isParameter(node)) {
                    const owner = nextOwner;
                    nextOwner += 1;
                    owners.push(owner);
                    if (syntaxApi.isIdentifier(node.name)) {
                      recordName({ name: node.name.text, position: node.name.getStart(sourceFile), owner });
                    }
                    return;
                  }
                  if (syntaxApi.isFunctionDeclaration(node) && node.name !== undefined) {
                    const owner = nextOwner;
                    nextOwner += 1;
                    recordName({ name: node.name.text, position: node.name.getStart(sourceFile), owner });
                    return;
                  }
                  if (!syntaxApi.isBindingElement(node) || !syntaxApi.isIdentifier(node.name)) return;
                  const owner = owners.at(-1);
                  if (owner === undefined) return;
                  recordName({ name: node.name.text, position: node.name.getStart(sourceFile), owner });
                },
                leave: ({ node }) => {
                  if (syntaxApi.isVariableDeclaration(node) || syntaxApi.isParameter(node)) owners.pop();
                },
                finish: () => [...hits]
                  .sort((left, right) => left.owner - right.owner)
                  .map(({ hit }) => hit),
              };
            },
          },
        };
      },
      finish: () => ({ outcome: "ok", value: [] }),
    },
  }),
};
