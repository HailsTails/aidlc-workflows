import type { WalkerPiece } from "../../../../../mechanisms/walker/runner/walker-piece.ts";

export const check: WalkerPiece = {
  prepare: ({ clauses }) => ({
    outcome: "ok",
    value: {
      prepareFile: ({ file }) => ({
        outcome: "ok",
        value: {
          kind: "complete",
          hits: file.endsWith(".tmp.ts")
            ? clauses.map((clause) => ({ clause: clause.address, anchor: { line: 1, column: 0 }, snippet: file }))
            : [],
        },
      }),
      finish: () => ({ outcome: "ok", value: [] }),
    },
  }),
};
