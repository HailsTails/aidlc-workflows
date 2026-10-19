import type { WalkerPiece } from "../runner/walker-piece.ts";
import { folderScope } from "../runner/source-scope.ts";

const sourceEligibility = (request: { readonly file: string }): "eligible" | "excluded" => {
  if (!request.file.endsWith(".ts") && !request.file.endsWith(".tsx")) return "excluded";
  if (folderScope({ file: request.file }) === "generated") return "excluded";
  return "eligible";
};

const FOR_OF = /\bfor\s*(?:await\s*)?\(\s*(?:const|let|var)?[^;()]*\bof\b/;
const COUNTED_FOR = /\bfor\s*\([^)]*;[^)]*;[^)]*\)/;
const WHILE_LOOP = /\bwhile\s*\(/;

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
          if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) return [];
          const collapsed = trimmed.replace(/\s+/g, " ");
          const snippet = collapsed.length > 80 ? `${collapsed.slice(0, 80)}…` : collapsed;
          return [FOR_OF, COUNTED_FOR, WHILE_LOOP].flatMap((pattern) => pattern.test(line)
            ? clauses.map((clause) => ({ clause: clause.address, anchor: { line: index + 1, column: 0 }, snippet }))
            : []);
        });
        return { outcome: "ok", value: { kind: "complete", hits } };
      },
      finish: () => ({ outcome: "ok", value: [] }),
    },
  }),
};
