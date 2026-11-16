import { z } from "zod";
import type { CloseReceipt } from "./rin-gates-bounded-close.ts";

const SYNTHESIS_LENS = "rin-intent-defense-reviewer-agent";
const BOARD_ROUND = 1;
const FIRST_FIX_ROUND = 2;
const HISTORY_ROW_ID = /\bR-\d{2}\b/;
const SCRIBE_ROW_ID = /\bG\d-R\d{2,}\b/;
const SHORT_SHA_LENGTH = 9;

const reviewHistorySchema = z.object({
  record: z.string(),
  gate: z.string(),
  roster: z.array(z.string()),
  rounds: z.array(z.object({ ordinal: z.number(), headSha: z.string() })),
  rows: z.array(
    z.object({
      id: z.string(),
      raisedRound: z.number(),
      lens: z.string(),
      text: z.string(),
      closedByCommit: z.string().nullable(),
    }),
  ),
});

type ReviewHistory = z.infer<typeof reviewHistorySchema>;
type HistoryRow = ReviewHistory["rows"][number];

type HandBack = {
  readonly lens: string;
  readonly headSha: string;
  readonly message: string;
};

type GateVerdict = {
  readonly verdict: string;
  readonly headSha: string;
  readonly findings: readonly string[];
  readonly blockingFindings: readonly string[];
  readonly lenses: readonly string[];
  readonly isClosedByReceipt: boolean;
};

type ReplayGate = {
  readonly handBack: (handBack: HandBack) => Promise<string>;
  readonly verdict: () => GateVerdict;
  readonly receipt: () => CloseReceipt | null;
};

type ReplayOutcome = {
  readonly fixed: readonly string[];
  readonly rejected: readonly string[];
  readonly forwarded: readonly string[];
  readonly notAdmitted: readonly string[];
  readonly neverRaisedAtThisGate: readonly string[];
};

type ReplayResult =
  | {
      readonly kind: "closed";
      readonly headSha: string;
      readonly closedBy: CloseReceipt["closedBy"];
      readonly lensReports: number;
      readonly outcome: ReplayOutcome;
    }
  | {
      readonly kind: "left-open";
      readonly verdict: string;
      readonly headSha: string;
      readonly lensReports: number;
    };

const reviewHistoryOf = ({ text }: { readonly text: string }): ReviewHistory =>
  reviewHistorySchema.parse(JSON.parse(text));

const headOfRound = ({
  history,
  ordinal,
}: {
  readonly history: ReviewHistory;
  readonly ordinal: number;
}): string =>
  history.rounds.find((round) => round.ordinal === ordinal)?.headSha ?? "";

const singleLineOf = ({ text }: { readonly text: string }): string =>
  text.replace(/\|/g, "/").replace(/\s+/g, " ").trim();

const findingLineOf = ({ row }: { readonly row: HistoryRow }): string =>
  `${row.id} ${singleLineOf({ text: row.text })} | ${row.lens} | first raised in round ${row.raisedRound}`;

const reportOf = ({
  isReady,
  headSha,
  lines,
}: {
  readonly isReady: boolean;
  readonly headSha: string;
  readonly lines: readonly string[];
}): string =>
  `## Verdict\n\n${isReady ? `READY — reviewed at ${headSha}.` : "NOT-READY"}\n\n${lines.map((line) => `- ${line}`).join("\n")}\n`;

const boardOrderOf = ({
  history,
}: {
  readonly history: ReviewHistory;
}): readonly string[] => [
  ...history.roster.filter((lens) => lens !== SYNTHESIS_LENS),
  SYNTHESIS_LENS,
];

const rowsRaisedBy = ({
  history,
  lens,
  round,
}: {
  readonly history: ReviewHistory;
  readonly lens: string;
  readonly round: number;
}): readonly HistoryRow[] =>
  history.rows.filter((row) => row.lens === lens && row.raisedRound === round);

const boardHandBacksOf = ({
  history,
}: {
  readonly history: ReviewHistory;
}): readonly HandBack[] => {
  const headSha = headOfRound({ history, ordinal: BOARD_ROUND });
  return boardOrderOf({ history }).map((lens) => {
    const raised = rowsRaisedBy({ history, lens, round: BOARD_ROUND });
    return {
      lens,
      headSha,
      message: reportOf({
        isReady: raised.length === 0,
        headSha,
        lines: raised.map((row) => findingLineOf({ row })),
      }),
    };
  });
};

const historyIdIn = ({ line }: { readonly line: string }): string =>
  HISTORY_ROW_ID.exec(line)?.[0] ?? "";

const scribeRowIdIn = ({ line }: { readonly line: string }): string =>
  SCRIBE_ROW_ID.exec(line)?.[0] ?? "";

const scribeRowIdsOf = ({
  openRowLines,
}: {
  readonly openRowLines: readonly string[];
}): ReadonlyMap<string, string> =>
  new Map(
    openRowLines.map((line) => [
      historyIdIn({ line }),
      scribeRowIdIn({ line }),
    ]),
  );

const closingHandBacksOf = ({
  history,
  openRowLines,
  forwardGate,
}: {
  readonly history: ReviewHistory;
  readonly openRowLines: readonly string[];
  readonly forwardGate: string;
}): readonly HandBack[] => {
  const fixHead = headOfRound({ history, ordinal: FIRST_FIX_ROUND });
  const scribeRowIds = scribeRowIdsOf({ openRowLines });
  const scribeRowIdOf = (row: HistoryRow): string =>
    scribeRowIds.get(row.id) ?? row.id;
  const wasFixed = (row: HistoryRow): boolean => row.closedByCommit === fixHead;
  const rechecks = boardOrderOf({ history })
    .filter(
      (lens) =>
        lens !== SYNTHESIS_LENS &&
        rowsRaisedBy({ history, lens, round: BOARD_ROUND }).length > 0,
    )
    .map((lens): HandBack => {
      const ownRows = rowsRaisedBy({ history, lens, round: BOARD_ROUND });
      const raisedAfterTheBoard = rowsRaisedBy({
        history,
        lens,
        round: FIRST_FIX_ROUND,
      });
      return {
        lens,
        headSha: fixHead,
        message: reportOf({
          isReady: raisedAfterTheBoard.length === 0 && ownRows.every(wasFixed),
          headSha: fixHead,
          lines: [
            ...ownRows.map(
              (row) =>
                `${scribeRowIdOf(row)} | ${wasFixed(row) ? "resolved" : "still open"} | rechecked at ${fixHead.slice(0, SHORT_SHA_LENGTH)}`,
            ),
            ...raisedAfterTheBoard.map((row) => findingLineOf({ row })),
          ],
        }),
      };
    });
  const closingRuling: HandBack = {
    lens: SYNTHESIS_LENS,
    headSha: fixHead,
    message: reportOf({
      isReady: true,
      headSha: fixHead,
      lines: history.rows
        .filter((row) => row.raisedRound === BOARD_ROUND)
        .map(
          (row) =>
            `${scribeRowIdOf(row)} | ${wasFixed(row) ? `fixed@${fixHead}` : `forwarded(${forwardGate})`} | ${row.id}, by the recorded history's next board`,
        ),
    }),
  };
  return [...rechecks, closingRuling];
};

const replayOutcomeOf = ({
  history,
  receipt,
}: {
  readonly history: ReviewHistory;
  readonly receipt: CloseReceipt;
}): ReplayOutcome => {
  const historyIdsRuled = (
    kind: CloseReceipt["rows"][number]["outcome"]["kind"],
  ): readonly string[] =>
    receipt.rows
      .filter((row) => row.outcome.kind === kind)
      .map((row) => historyIdIn({ line: row.text }))
      .sort();
  return {
    fixed: historyIdsRuled("fixed"),
    rejected: historyIdsRuled("rejected"),
    forwarded: historyIdsRuled("forwarded"),
    notAdmitted: receipt.unadmitted
      .map((finding) => historyIdIn({ line: finding.text }))
      .sort(),
    neverRaisedAtThisGate: history.rows
      .filter((row) => row.raisedRound > FIRST_FIX_ROUND)
      .map((row) => row.id)
      .sort(),
  };
};

const handBackInOrder = async ({
  gate,
  handBacks,
}: {
  readonly gate: ReplayGate;
  readonly handBacks: readonly HandBack[];
}): Promise<void> =>
  handBacks.reduce(
    (earlier, handBack) =>
      earlier.then(() => gate.handBack(handBack)).then(() => undefined),
    Promise.resolve(),
  );

const replayReviewHistory = async ({
  history,
  forwardGate,
  gate,
}: {
  readonly history: ReviewHistory;
  readonly forwardGate: string;
  readonly gate: ReplayGate;
}): Promise<ReplayResult> => {
  const board = boardHandBacksOf({ history });
  await handBackInOrder({ gate, handBacks: board });
  const close = closingHandBacksOf({
    history,
    openRowLines: gate.verdict().findings,
    forwardGate,
  });
  await handBackInOrder({ gate, handBacks: close });
  const verdict = gate.verdict();
  const receipt = gate.receipt();
  const lensReports = board.length + close.length;
  if (
    receipt === null ||
    receipt.validity.kind !== "standing" ||
    verdict.verdict !== "READY"
  ) {
    return {
      kind: "left-open",
      verdict: verdict.verdict,
      headSha: verdict.headSha,
      lensReports,
    };
  }
  return {
    kind: "closed",
    headSha: verdict.headSha,
    closedBy: receipt.closedBy,
    lensReports,
    outcome: replayOutcomeOf({ history, receipt }),
  };
};

export {
  boardHandBacksOf,
  closingHandBacksOf,
  type GateVerdict,
  type HandBack,
  type ReplayGate,
  type ReplayOutcome,
  type ReplayResult,
  type ReviewHistory,
  replayOutcomeOf,
  replayReviewHistory,
  reviewHistoryOf,
};
