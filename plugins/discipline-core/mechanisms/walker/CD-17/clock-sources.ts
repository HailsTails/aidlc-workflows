import type { WalkerPiece } from "../runner/walker-piece.ts";
import { folderScope } from "../runner/source-scope.ts";

const sourceEligibility = (request: { readonly file: string }): "eligible" | "excluded" => {
  if (!request.file.endsWith(".ts") && !request.file.endsWith(".tsx")) return "excluded";
  if (folderScope({ file: request.file }) === "generated") return "excluded";
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
