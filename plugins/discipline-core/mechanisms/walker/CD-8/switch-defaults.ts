import type { PieceHit, WalkerPiece } from "../runner/walker-piece.ts";
import { folderScope } from "../runner/source-scope.ts";

const sourceEligibility = (request: { readonly file: string }): "eligible" | "excluded" => {
  if (!request.file.endsWith(".ts") && !request.file.endsWith(".tsx")) return "excluded";
  if (folderScope({ file: request.file }) === "generated") return "excluded";
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
