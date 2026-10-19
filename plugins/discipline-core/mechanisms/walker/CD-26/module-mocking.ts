import type { PieceHit, WalkerPiece } from "../runner/walker-piece.ts";

const PRUNED_DIRECTORIES: readonly string[] = [
  "node_modules", "dist", "dist-release", "build", "coverage", ".git", ".claude", "aidlc", ".aidlc",
];

const PRUNED_ROOT_DIRECTORIES: readonly string[] = ["vendor", ".codex", ".opencode", ".agents"];

const testFileEligibility = (request: { readonly file: string }): "eligible" | "skipped" => {
  const directories = request.file.split("/").slice(0, -1);
  if (
    PRUNED_ROOT_DIRECTORIES.includes(directories[0] ?? "") ||
    directories.some((directory) => PRUNED_DIRECTORIES.includes(directory))
  ) return "skipped";
  return request.file.endsWith(".test.ts") || request.file.endsWith(".test.tsx")
    ? "eligible"
    : "skipped";
};

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
                  if (!syntaxApi.isCallExpression(node)) return;
                  const callee = node.expression;
                  if (
                    !syntaxApi.isPropertyAccessExpression(callee) ||
                    callee.name.text !== "mock" ||
                    !syntaxApi.isIdentifier(callee.expression) ||
                    callee.expression.text !== "vi"
                  ) return;
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
