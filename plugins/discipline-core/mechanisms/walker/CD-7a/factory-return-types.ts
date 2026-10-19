import type { WalkerPiece } from "../runner/walker-piece.ts";

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

const RETURN_TYPE_TYPEOF = /\bReturnType\s*<\s*typeof\b/;

export const check: WalkerPiece = {
  prepare: ({ clauses }) => ({
    outcome: "ok",
    value: {
      prepareFile: ({ file, readText }) => {
        if (sourceEligibility({ file }) === "excluded") {
          return { outcome: "ok", value: { kind: "skipped" } };
        }
        const text = readText();
        if (text.outcome === "failed") return text;
        const hits = text.value.split(/\r?\n/).flatMap((line, index) => {
          const trimmed = line.trim();
          if (
            trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*") ||
            !RETURN_TYPE_TYPEOF.test(line)
          ) return [];
          const collapsed = trimmed.replace(/\s+/g, " ");
          const snippet = collapsed.length > 80 ? `${collapsed.slice(0, 80)}…` : collapsed;
          return clauses.map((clause) => ({
            clause: clause.address,
            anchor: { line: index + 1, column: 0 },
            snippet,
          }));
        });
        return { outcome: "ok", value: { kind: "complete", hits } };
      },
      finish: () => ({ outcome: "ok", value: [] }),
    },
  }),
};
