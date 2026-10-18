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

const SWITCH_OPEN = /\bswitch\s*\(/g;
const CLOSING_BRACE = /\}/g;
const DEFAULT_ARM = /(^|[^.\w])default\s*:/;

type SwitchState = {
  readonly depth: number;
  readonly hits: readonly PieceHit[];
};

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
        const observed = text.value.split(/\r?\n/).reduce<SwitchState>((state, line, index) => {
          const trimmed = line.trim();
          if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) return state;
          const opens = (line.match(SWITCH_OPEN) ?? []).length;
          const closes = (line.match(CLOSING_BRACE) ?? []).length;
          const collapsed = trimmed.replace(/\s+/g, " ");
          const snippet = collapsed.length > 80 ? `${collapsed.slice(0, 80)}…` : collapsed;
          const hits = state.depth + opens > 0 && DEFAULT_ARM.test(line)
            ? clauses.map((clause) => ({ clause: clause.address, anchor: { line: index + 1, column: 0 }, snippet }))
            : [];
          return { depth: Math.max(0, state.depth + opens - closes), hits: [...state.hits, ...hits] };
        }, { depth: 0, hits: [] });
        return { outcome: "ok", value: { kind: "complete", hits: observed.hits } };
      },
      finish: () => ({ outcome: "ok", value: [] }),
    },
  }),
};
