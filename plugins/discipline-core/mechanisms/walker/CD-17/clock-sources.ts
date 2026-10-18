import type { WalkerPiece } from "../runner/walker-piece.ts";

const EXCLUDED_DIRECTORY_NAMES: ReadonlySet<string> = new Set([
  "node_modules", "dist", "dist-release", "build", "coverage", ".git", ".claude", "aidlc", ".aidlc",
]);
const EXCLUDED_ROOT_DIRECTORY_NAMES: ReadonlySet<string> = new Set([
  "vendor", ".codex", ".opencode", ".agents",
]);

const sourceEligibility = (request: { readonly file: string }): "eligible" | "excluded" => {
  if (!request.file.endsWith(".ts") && !request.file.endsWith(".tsx")) return "excluded";
  const segments = request.file.split("/");
  const parents = segments.slice(0, -1);
  if (parents.some((directory) => EXCLUDED_DIRECTORY_NAMES.has(directory))) return "excluded";
  if (EXCLUDED_ROOT_DIRECTORY_NAMES.has(parents[0] ?? "")) return "excluded";
  if (segments.at(-1) === "audit-constitution.ts") return "excluded";
  if (segments.at(-1) === "App.tsx" || segments.at(-1) === "main.tsx") return "excluded";
  if (parents[0] === "scripts" && !EXCLUDED_ROOT_DIRECTORY_NAMES.has(parents[1] ?? "")) return "excluded";
  return "eligible";
};

export const check: WalkerPiece = {
  prepare: ({ clauses }) => ({
    outcome: "ok",
    value: {
      prepareFile: ({ file, readText }) => {
        if (sourceEligibility({ file }) === "excluded") return { outcome: "ok", value: { kind: "skipped" } };
        const text = readText();
        if (text.outcome === "failed") return text;
        const hits = text.value.split("\n")
          .flatMap((line, index) => /\bDate\.now\(\)/.test(line) || /\bnew\x20Date\b/.test(line)
            ? clauses.map((clause) => ({ clause: clause.address, anchor: { line: index + 1, column: 0 }, snippet: line.trim() }))
            : []);
        return { outcome: "ok", value: { kind: "complete", hits } };
      },
      finish: () => ({ outcome: "ok", value: [] }),
    },
  }),
};
