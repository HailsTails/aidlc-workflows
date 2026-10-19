import type { PieceHit, WalkerPiece } from "../runner/walker-piece.ts";

const EXCLUDED_DIRECTORY_NAMES: ReadonlySet<string> = new Set([
  "node_modules", "dist", "dist-release", "build", "coverage", ".git", ".claude", "aidlc", ".aidlc",
]);
const EXCLUDED_ROOT_DIRECTORY_NAMES: ReadonlySet<string> = new Set([
  "vendor", ".codex", ".opencode", ".agents",
]);

const sourceEligibility = (request: { readonly file: string }): "eligible" | "excluded" => {
  if (!request.file.endsWith(".ts") && !request.file.endsWith(".tsx")) return "excluded";
  if (request.file.split("/").at(-1) === "audit-constitution.ts") return "excluded";
  const parents = request.file.split("/").slice(0, -1);
  if (parents.some((directory) => EXCLUDED_DIRECTORY_NAMES.has(directory))) return "excluded";
  if (EXCLUDED_ROOT_DIRECTORY_NAMES.has(parents[0] ?? "")) return "excluded";
  return "eligible";
};

const BARE_TODO_PATTERN = /\/\/\s*TODO\b(?!\s*\()/;
const BARE_TS_EXPECT_ERROR_PATTERN = /\/\/\s*@ts-expect-error\b(?!.*\(spec-\d+\))/;
const LINTER_DIRECTIVE_PATTERN =
  /^(?:\/\/|\/\*)\s*((?:biome-ignore(?:-all|-start|-end)?|(?:eslint|oxlint)-(?:disable(?:-line|-next-line)?|enable)|eslint(?=\s)))\b/;

export const check: WalkerPiece = {
  prepare: ({ clauses }) => ({
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
              const todoHits: PieceHit[] = [];
              const directiveHits: PieceHit[] = [];
              const expectationHits: PieceHit[] = [];
              const lineHits = (request: {
                readonly line: string;
                readonly position: number;
              }): readonly PieceHit[] => {
                const anchor = anchorAt({ position: request.position });
                return clauses.map((clause) => ({
                  clause: clause.address,
                  anchor,
                  snippet: request.line.trim(),
                }));
              };
              let linePosition = 0;
              sourceFile.text.split("\n").forEach((line) => {
                if (BARE_TODO_PATTERN.test(line)) {
                  todoHits.push(...lineHits({ line, position: linePosition }));
                }
                if (BARE_TS_EXPECT_ERROR_PATTERN.test(line)) {
                  expectationHits.push(...lineHits({ line, position: linePosition }));
                }
                linePosition += line.length + 1;
              });
              return {
                comment: ({ range }) => {
                  const comment = sourceFile.text.slice(range.pos, range.end);
                  if (LINTER_DIRECTIVE_PATTERN.exec(comment)?.[1] === undefined) return;
                  if (/\(spec-\d+\)/.test(comment)) return;
                  const anchor = anchorAt({ position: range.pos });
                  directiveHits.push(...clauses.map((clause) => ({
                    clause: clause.address,
                    anchor,
                    snippet: comment.trim(),
                  })));
                },
                finish: () => [...todoHits, ...directiveHits, ...expectationHits],
              };
            },
          },
        };
      },
      finish: () => ({ outcome: "ok", value: [] }),
    },
  }),
};
