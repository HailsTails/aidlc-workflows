import {
  type BoardVerdictToken,
  GATE_PHASES,
  type GateSlug,
  isGateSlug,
} from "./rin-gate-namespace.ts";
import {
  blockingFindingsWithPolicy,
  forwardTargetOf,
  rejectionGroundOf,
} from "./rin-gates-finding-disposition.ts";

const SYNTHESIS_LENS = "rin-intent-defense-reviewer-agent";
const CLOSE_RECEIPT_FILENAME = "review-close.json";
const CLOSE_RECEIPT_EMITTER = "rin-gates-review-scribe";

type LensReportCapture = {
  readonly lens: string;
  readonly verdict: BoardVerdictToken;
  readonly findings: readonly string[];
  readonly headSha: string;
  readonly at: string;
  readonly sessionId: string;
  readonly agentId: string | null;
  readonly channel: "handback" | "stop-message" | null;
  readonly reportText: string | null;
};

type AttemptLedgerEntry =
  | { readonly kind: "report"; readonly capture: LensReportCapture }
  | {
      readonly kind: "seat-dispatch";
      readonly agentType: string;
      readonly at: string;
    };

type RowOrigin =
  | { readonly kind: "raised" }
  | { readonly kind: "forwarded"; readonly fromGate: GateSlug };

type ReviewRow = {
  readonly id: string;
  readonly lens: string;
  readonly text: string;
  readonly origin: RowOrigin;
};

type RowOutcome =
  | { readonly kind: "fixed"; readonly commitSha: string }
  | { readonly kind: "rejected"; readonly ground: string }
  | { readonly kind: "forwarded"; readonly toGate: GateSlug };

type RuledRow = ReviewRow & {
  readonly outcome: RowOutcome;
  readonly note: string;
};

type RowRecheck = {
  readonly rowId: string;
  readonly lens: string;
  readonly headSha: string;
  readonly claim: string;
};

type UnadmittedFinding = {
  readonly lens: string;
  readonly headSha: string;
  readonly text: string;
};

type CompletedBoard = {
  readonly headSha: string;
  readonly reports: readonly LensReportCapture[];
};

type Closure = {
  readonly closedBy: "clean-board" | "closing-ruling";
  readonly closedHeadSha: string;
  readonly closedAt: string;
  readonly ruledRows: readonly RuledRow[];
};

type OpenedAttempt = {
  readonly attempt: number;
  readonly board: CompletedBoard;
  readonly rows: readonly ReviewRow[];
  readonly rechecks: readonly RowRecheck[];
  readonly unadmitted: readonly UnadmittedFinding[];
};

type AttemptState =
  | {
      readonly phase: "boarding";
      readonly attempt: number;
      readonly reports: readonly LensReportCapture[];
    }
  | ({ readonly phase: "closing" } & OpenedAttempt)
  | ({ readonly phase: "closed"; readonly closure: Closure } & OpenedAttempt);

type RulingProblem =
  | { readonly kind: "ruling-not-ready" }
  | { readonly kind: "row-unruled"; readonly rowId: string }
  | { readonly kind: "row-ruled-more-than-once"; readonly rowId: string }
  | { readonly kind: "unknown-row"; readonly rowId: string }
  | {
      readonly kind: "outcome-unreadable";
      readonly rowId: string;
      readonly claim: string;
    }
  | { readonly kind: "fixed-without-a-later-commit"; readonly rowId: string }
  | {
      readonly kind: "forward-target-not-a-later-board-gate";
      readonly rowId: string;
      readonly target: string;
    };

type ReceiptInvalidation =
  | { readonly kind: "reviewer-dispatch"; readonly agentType: string }
  | { readonly kind: "seat-dispatch"; readonly agentType: string };

type AttemptEvent =
  | { readonly kind: "board-incomplete"; readonly reported: readonly string[] }
  | { readonly kind: "board-open"; readonly rows: readonly ReviewRow[] }
  | { readonly kind: "closed"; readonly closure: Closure }
  | {
      readonly kind: "recheck-recorded";
      readonly rechecks: readonly RowRecheck[];
      readonly unadmitted: readonly UnadmittedFinding[];
    }
  | {
      readonly kind: "ruling-refused";
      readonly problems: readonly RulingProblem[];
    }
  | { readonly kind: "seat-dispatch-recorded" };

type AttemptStep = {
  readonly state: AttemptState;
  readonly event: AttemptEvent;
  readonly invalidation: ReceiptInvalidation | null;
};

type BoundedClosePolicy = {
  readonly gate: GateSlug;
  readonly roster: readonly string[];
  readonly inboundRows: readonly ReviewRow[];
  readonly forwardableGates: readonly GateSlug[];
  readonly exceptionWhyChainsEnabled: boolean;
};

type ReceiptValidity =
  | { readonly kind: "standing" }
  | {
      readonly kind: "invalidated";
      readonly reason: ReceiptInvalidation;
      readonly at: string;
    };

type CloseReceipt = {
  readonly schemaVersion: 1;
  readonly gate: GateSlug;
  readonly record: string;
  readonly attempt: number;
  readonly validity: ReceiptValidity;
  readonly closedBy: Closure["closedBy"];
  readonly boardHeadSha: string;
  readonly closedHeadSha: string;
  readonly closedAt: string;
  readonly carriedLenses: readonly {
    readonly lens: string;
    readonly verdict: BoardVerdictToken;
    readonly headSha: string;
  }[];
  readonly rows: readonly RuledRow[];
  readonly rechecks: readonly RowRecheck[];
  readonly unadmitted: readonly UnadmittedFinding[];
  readonly emittedBy: typeof CLOSE_RECEIPT_EMITTER;
};

type RowStatement = {
  readonly rowId: string;
  readonly claim: string;
  readonly note: string;
};

const GATE_ORDER: readonly GateSlug[] =
  Object.keys(GATE_PHASES).filter(isGateSlug);

const GATE_DIGIT = /^rin-gate-([0-9])-/;
const ROW_ID = /^G[0-9]-R[0-9]{2,}$/;
const ROW_ORDINAL_WIDTH = 2;
const LEADING_BULLET = /^[-*]\s*/;
const LEADING_PIPE = /^\|/;
const TRAILING_PIPE = /(?<!\\)\|\s*$/;
const UNESCAPED_PIPE = /(?<!\\)\|/;
const EVERY_UNESCAPED_PIPE = /(?<!\\)\|/g;
const BACKTICK = /`/g;
const FIXED_AT_COMMIT = /^fixed\s*@\s*([0-9a-f]{7,40})$/i;

const laterBoardGatesOf = ({
  gate,
  boardGates,
}: {
  readonly gate: GateSlug;
  readonly boardGates: readonly GateSlug[];
}): readonly GateSlug[] =>
  GATE_ORDER.slice(GATE_ORDER.indexOf(gate) + 1).filter((later) =>
    boardGates.includes(later),
  );

const earlierGatesOf = ({
  gate,
}: {
  readonly gate: GateSlug;
}): readonly GateSlug[] => GATE_ORDER.slice(0, GATE_ORDER.indexOf(gate));

const rowIdFor = ({
  gate,
  ordinal,
}: {
  readonly gate: GateSlug;
  readonly ordinal: number;
}): string =>
  `G${gate.match(GATE_DIGIT)?.[1] ?? "0"}-R${String(ordinal).padStart(ROW_ORDINAL_WIDTH, "0")}`;

const cellsOf = ({ line }: { readonly line: string }): readonly string[] =>
  line
    .trim()
    .replace(LEADING_BULLET, "")
    .replace(LEADING_PIPE, "")
    .replace(TRAILING_PIPE, "")
    .split(UNESCAPED_PIPE)
    .map((cell) => cell.trim().replace(BACKTICK, ""));

const rowStatementOf = ({
  finding,
}: {
  readonly finding: string;
}): RowStatement | null => {
  const [rowId, claim, ...noteCells] = cellsOf({ line: finding });
  return rowId !== undefined && ROW_ID.test(rowId)
    ? { rowId, claim: claim ?? "", note: noteCells.join(" | ") }
    : null;
};

const rowStatementsIn = ({
  findings,
}: {
  readonly findings: readonly string[];
}): readonly RowStatement[] =>
  findings.flatMap((finding) => {
    const statement = rowStatementOf({ finding });
    return statement === null ? [] : [statement];
  });

const plainFindingsIn = ({
  findings,
}: {
  readonly findings: readonly string[];
}): readonly string[] =>
  findings.filter((finding) => rowStatementOf({ finding }) === null);

const outcomeOf = ({
  claim,
}: {
  readonly claim: string;
}): RowOutcome | null => {
  const fixed = claim.match(FIXED_AT_COMMIT)?.[1];
  if (fixed !== undefined) {
    return { kind: "fixed", commitSha: fixed.toLowerCase() };
  }
  const ground = rejectionGroundOf({ disposition: claim });
  if (ground !== null) return { kind: "rejected", ground };
  const target = forwardTargetOf({ disposition: claim });
  return target !== null && isGateSlug(target)
    ? { kind: "forwarded", toGate: target }
    : null;
};

const latestPerLens = ({
  reports,
}: {
  readonly reports: readonly LensReportCapture[];
}): readonly LensReportCapture[] => [
  ...new Map(reports.map((report) => [report.lens, report])).values(),
];

const completedBoardOf = ({
  reports,
  roster,
}: {
  readonly reports: readonly LensReportCapture[];
  readonly roster: readonly string[];
}): CompletedBoard | null => {
  const latest = reports.at(-1);
  if (latest === undefined) return null;
  const atHead = reports.filter(
    (report) => report.headSha === latest.headSha,
  );
  const isCovered = roster.every((lens) =>
    atHead.some((report) => report.lens === lens),
  );
  const isSynthesisLast =
    !roster.includes(SYNTHESIS_LENS) || latest.lens === SYNTHESIS_LENS;
  return isCovered && isSynthesisLast
    ? { headSha: latest.headSha, reports: latestPerLens({ reports: atHead }) }
    : null;
};

const openFindingTextsOf = ({
  report,
  exceptionWhyChainsEnabled,
}: {
  readonly report: LensReportCapture;
  readonly exceptionWhyChainsEnabled: boolean;
}): readonly string[] => {
  const undisposed = blockingFindingsWithPolicy({
    findings: plainFindingsIn({ findings: report.findings }),
    exceptionWhyChainsEnabled,
  });
  if (undisposed.length > 0) return undisposed;
  return report.verdict === "NOT-READY"
    ? [`${report.lens} returned NOT-READY and cited no finding`]
    : [];
};

const raisedRowsOf = ({
  board,
  policy,
}: {
  readonly board: CompletedBoard;
  readonly policy: BoundedClosePolicy;
}): readonly ReviewRow[] =>
  board.reports
    .flatMap((report) =>
      openFindingTextsOf({
        report,
        exceptionWhyChainsEnabled: policy.exceptionWhyChainsEnabled,
      }).map((text) => ({ lens: report.lens, text })),
    )
    .map(
      (raised, index): ReviewRow => ({
        id: rowIdFor({ gate: policy.gate, ordinal: index + 1 }),
        lens: raised.lens,
        text: raised.text,
        origin: { kind: "raised" },
      }),
    );

type RowRuling =
  | { readonly kind: "ruled"; readonly ruledRow: RuledRow }
  | { readonly kind: "refused"; readonly problem: RulingProblem };

const citesNoLaterCommit = ({
  commitSha,
  boardHeadSha,
  rulingHeadSha,
}: {
  readonly commitSha: string;
  readonly boardHeadSha: string;
  readonly rulingHeadSha: string;
}): boolean =>
  rulingHeadSha === boardHeadSha || boardHeadSha.startsWith(commitSha);

const rowRulingOf = ({
  row,
  statements,
  board,
  rulingHeadSha,
  policy,
}: {
  readonly row: ReviewRow;
  readonly statements: readonly RowStatement[];
  readonly board: CompletedBoard;
  readonly rulingHeadSha: string;
  readonly policy: BoundedClosePolicy;
}): RowRuling => {
  const [statement, ...repeats] = statements.filter(
    (candidate) => candidate.rowId === row.id,
  );
  if (statement === undefined) {
    return { kind: "refused", problem: { kind: "row-unruled", rowId: row.id } };
  }
  if (repeats.length > 0) {
    return {
      kind: "refused",
      problem: { kind: "row-ruled-more-than-once", rowId: row.id },
    };
  }
  const outcome = outcomeOf({ claim: statement.claim });
  if (outcome === null) {
    return {
      kind: "refused",
      problem: {
        kind: "outcome-unreadable",
        rowId: row.id,
        claim: statement.claim,
      },
    };
  }
  if (
    outcome.kind === "fixed" &&
    row.origin.kind === "raised" &&
    citesNoLaterCommit({
      commitSha: outcome.commitSha,
      boardHeadSha: board.headSha,
      rulingHeadSha,
    })
  ) {
    return {
      kind: "refused",
      problem: { kind: "fixed-without-a-later-commit", rowId: row.id },
    };
  }
  if (
    outcome.kind === "forwarded" &&
    !policy.forwardableGates.includes(outcome.toGate)
  ) {
    return {
      kind: "refused",
      problem: {
        kind: "forward-target-not-a-later-board-gate",
        rowId: row.id,
        target: outcome.toGate,
      },
    };
  }
  return {
    kind: "ruled",
    ruledRow: { ...row, outcome, note: statement.note },
  };
};

type RulingAssessment =
  | { readonly kind: "accepted"; readonly ruledRows: readonly RuledRow[] }
  | { readonly kind: "refused"; readonly problems: readonly RulingProblem[] };

const assessClosingRuling = ({
  ruling,
  rows,
  board,
  policy,
}: {
  readonly ruling: LensReportCapture;
  readonly rows: readonly ReviewRow[];
  readonly board: CompletedBoard;
  readonly policy: BoundedClosePolicy;
}): RulingAssessment => {
  const statements = rowStatementsIn({ findings: ruling.findings });
  const rowRulings = rows.map((row) =>
    rowRulingOf({
      row,
      statements,
      board,
      rulingHeadSha: ruling.headSha,
      policy,
    }),
  );
  const verdictProblems: readonly RulingProblem[] =
    ruling.verdict === "READY" ? [] : [{ kind: "ruling-not-ready" }];
  const problems: readonly RulingProblem[] = [
    ...verdictProblems,
    ...statements
      .filter((statement) => !rows.some((row) => row.id === statement.rowId))
      .map(
        (statement): RulingProblem => ({
          kind: "unknown-row",
          rowId: statement.rowId,
        }),
      ),
    ...rowRulings.flatMap((rowRuling) =>
      rowRuling.kind === "refused" ? [rowRuling.problem] : [],
    ),
  ];
  return problems.length > 0
    ? { kind: "refused", problems }
    : {
        kind: "accepted",
        ruledRows: rowRulings.flatMap((rowRuling) =>
          rowRuling.kind === "ruled" ? [rowRuling.ruledRow] : [],
        ),
      };
};

const stepFromCompletedBoard = ({
  attempt,
  board,
  policy,
}: {
  readonly attempt: number;
  readonly board: CompletedBoard;
  readonly policy: BoundedClosePolicy;
}): AttemptStep => {
  const rows = [...raisedRowsOf({ board, policy }), ...policy.inboundRows];
  const opened: OpenedAttempt = {
    attempt,
    board,
    rows,
    rechecks: [],
    unadmitted: [],
  };
  const synthesis = board.reports.find(
    (report) => report.lens === SYNTHESIS_LENS,
  );
  const closedAt = board.reports.at(-1)?.at ?? "";
  if (rows.length === 0) {
    const closure: Closure = {
      closedBy: "clean-board",
      closedHeadSha: board.headSha,
      closedAt,
      ruledRows: [],
    };
    return {
      state: { ...opened, phase: "closed", closure },
      event: { kind: "closed", closure },
      invalidation: null,
    };
  }
  const inBoardRuling =
    synthesis === undefined
      ? null
      : assessClosingRuling({ ruling: synthesis, rows, board, policy });
  if (inBoardRuling !== null && inBoardRuling.kind === "accepted") {
    const closure: Closure = {
      closedBy: "closing-ruling",
      closedHeadSha: board.headSha,
      closedAt,
      ruledRows: inBoardRuling.ruledRows,
    };
    return {
      state: { ...opened, phase: "closed", closure },
      event: { kind: "closed", closure },
      invalidation: null,
    };
  }
  return {
    state: { ...opened, phase: "closing" },
    event: { kind: "board-open", rows },
    invalidation: null,
  };
};

const stepWhileBoarding = ({
  attempt,
  reports,
  policy,
}: {
  readonly attempt: number;
  readonly reports: readonly LensReportCapture[];
  readonly policy: BoundedClosePolicy;
}): AttemptStep => {
  const board = completedBoardOf({ reports, roster: policy.roster });
  return board === null
    ? {
        state: { phase: "boarding", attempt, reports },
        event: {
          kind: "board-incomplete",
          reported: reports.map((report) => report.lens),
        },
        invalidation: null,
      }
    : stepFromCompletedBoard({ attempt, board, policy });
};

const stepRecheck = ({
  opened,
  capture,
}: {
  readonly opened: OpenedAttempt;
  readonly capture: LensReportCapture;
}): AttemptStep => {
  const statements = rowStatementsIn({ findings: capture.findings });
  const isOwnRow = (statement: RowStatement): boolean =>
    opened.rows.some(
      (row) => row.id === statement.rowId && row.lens === capture.lens,
    );
  const rechecks = statements.filter(isOwnRow).map(
    (statement): RowRecheck => ({
      rowId: statement.rowId,
      lens: capture.lens,
      headSha: capture.headSha,
      claim: statement.claim,
    }),
  );
  const unadmitted = [
    ...statements
      .filter((statement) => !isOwnRow(statement))
      .map((statement) => `${statement.rowId} | ${statement.claim}`),
    ...plainFindingsIn({ findings: capture.findings }),
  ].map(
    (text): UnadmittedFinding => ({
      lens: capture.lens,
      headSha: capture.headSha,
      text,
    }),
  );
  return {
    state: {
      ...opened,
      phase: "closing",
      rechecks: [...opened.rechecks, ...rechecks],
      unadmitted: [...opened.unadmitted, ...unadmitted],
    },
    event: { kind: "recheck-recorded", rechecks, unadmitted },
    invalidation: null,
  };
};

const stepClosingRuling = ({
  opened,
  capture,
  policy,
}: {
  readonly opened: OpenedAttempt;
  readonly capture: LensReportCapture;
  readonly policy: BoundedClosePolicy;
}): AttemptStep => {
  const assessment = assessClosingRuling({
    ruling: capture,
    rows: opened.rows,
    board: opened.board,
    policy,
  });
  if (assessment.kind === "refused") {
    return {
      state: { ...opened, phase: "closing" },
      event: { kind: "ruling-refused", problems: assessment.problems },
      invalidation: null,
    };
  }
  const closure: Closure = {
    closedBy: "closing-ruling",
    closedHeadSha: capture.headSha,
    closedAt: capture.at,
    ruledRows: assessment.ruledRows,
  };
  return {
    state: { ...opened, phase: "closed", closure },
    event: { kind: "closed", closure },
    invalidation: null,
  };
};

const stepReport = ({
  state,
  capture,
  policy,
}: {
  readonly state: AttemptState;
  readonly capture: LensReportCapture;
  readonly policy: BoundedClosePolicy;
}): AttemptStep => {
  switch (state.phase) {
    case "boarding":
      return stepWhileBoarding({
        attempt: state.attempt,
        reports: [...state.reports, capture],
        policy,
      });
    case "closing":
      return capture.lens === SYNTHESIS_LENS
        ? stepClosingRuling({ opened: state, capture, policy })
        : stepRecheck({ opened: state, capture });
    case "closed":
      return {
        ...stepWhileBoarding({
          attempt: state.attempt + 1,
          reports: [capture],
          policy,
        }),
        invalidation: { kind: "reviewer-dispatch", agentType: capture.lens },
      };
  }
};

const stepSeatDispatch = ({
  state,
  agentType,
}: {
  readonly state: AttemptState;
  readonly agentType: string;
}): AttemptStep =>
  state.phase === "closed"
    ? {
        state: { phase: "boarding", attempt: state.attempt + 1, reports: [] },
        event: { kind: "seat-dispatch-recorded" },
        invalidation: { kind: "seat-dispatch", agentType },
      }
    : {
        state,
        event: { kind: "seat-dispatch-recorded" },
        invalidation: null,
      };

const stepAttempt = ({
  state,
  entry,
  policy,
}: {
  readonly state: AttemptState;
  readonly entry: AttemptLedgerEntry;
  readonly policy: BoundedClosePolicy;
}): AttemptStep => {
  switch (entry.kind) {
    case "report":
      return stepReport({ state, capture: entry.capture, policy });
    case "seat-dispatch":
      return stepSeatDispatch({ state, agentType: entry.agentType });
  }
};

const FIRST_ATTEMPT: AttemptState = {
  phase: "boarding",
  attempt: 1,
  reports: [],
};

const attemptStateOf = ({
  entries,
  policy,
}: {
  readonly entries: readonly AttemptLedgerEntry[];
  readonly policy: BoundedClosePolicy;
}): AttemptState =>
  entries.reduce<AttemptState>(
    (state, entry) => stepAttempt({ state, entry, policy }).state,
    FIRST_ATTEMPT,
  );

const closeReceiptOf = ({
  state,
  record,
  gate,
}: {
  readonly state: Extract<AttemptState, { readonly phase: "closed" }>;
  readonly record: string;
  readonly gate: GateSlug;
}): CloseReceipt => ({
  schemaVersion: 1,
  gate,
  record,
  attempt: state.attempt,
  validity: { kind: "standing" },
  closedBy: state.closure.closedBy,
  boardHeadSha: state.board.headSha,
  closedHeadSha: state.closure.closedHeadSha,
  closedAt: state.closure.closedAt,
  carriedLenses: state.board.reports.map((report) => ({
    lens: report.lens,
    verdict: report.verdict,
    headSha: report.headSha,
  })),
  rows: state.closure.ruledRows,
  rechecks: state.rechecks,
  unadmitted: state.unadmitted,
  emittedBy: CLOSE_RECEIPT_EMITTER,
});

const invalidatedReceiptOf = ({
  receipt,
  reason,
  at,
}: {
  readonly receipt: CloseReceipt;
  readonly reason: ReceiptInvalidation;
  readonly at: string;
}): CloseReceipt => ({
  ...receipt,
  validity: { kind: "invalidated", reason, at },
});

const inboundRowsOf = ({
  gate,
  earlierReceipts,
}: {
  readonly gate: GateSlug;
  readonly earlierReceipts: readonly CloseReceipt[];
}): readonly ReviewRow[] =>
  earlierReceipts
    .filter((receipt) => receipt.validity.kind === "standing")
    .flatMap((receipt) =>
      receipt.rows
        .filter(
          (row) => row.outcome.kind === "forwarded" && row.outcome.toGate === gate,
        )
        .map(
          (row): ReviewRow => ({
            id: row.id,
            lens: row.lens,
            text: row.text,
            origin: { kind: "forwarded", fromGate: receipt.gate },
          }),
        ),
    );

const escapedCell = ({ text }: { readonly text: string }): string =>
  text.replace(EVERY_UNESCAPED_PIPE, "\\|");

const outcomeTextOf = ({
  outcome,
}: {
  readonly outcome: RowOutcome;
}): string => {
  switch (outcome.kind) {
    case "fixed":
      return `fixed@${outcome.commitSha}`;
    case "rejected":
      return `rejected(${outcome.ground})`;
    case "forwarded":
      return `forwarded(${outcome.toGate})`;
  }
};

const ruledRowLineOf = ({
  ruledRow,
}: {
  readonly ruledRow: RuledRow;
}): string =>
  `| ${ruledRow.id}: ${escapedCell({ text: ruledRow.text })} | ${outcomeTextOf({ outcome: ruledRow.outcome })} | ${escapedCell({ text: ruledRow.note })} |`;

const openRowLineOf = ({ row }: { readonly row: ReviewRow }): string =>
  `${row.id} | ${row.lens} | ${row.text}`;

const describeRulingProblem = ({
  problem,
}: {
  readonly problem: RulingProblem;
}): string => {
  switch (problem.kind) {
    case "ruling-not-ready":
      return "the closing ruling's own verdict is not READY";
    case "row-unruled":
      return `${problem.rowId} has no outcome`;
    case "row-ruled-more-than-once":
      return `${problem.rowId} is ruled more than once`;
    case "unknown-row":
      return `${problem.rowId} is not an open row of this gate`;
    case "outcome-unreadable":
      return `${problem.rowId} carries '${problem.claim}', which is not fixed@<sha>, rejected(<ground>) or forwarded(<later gate>)`;
    case "fixed-without-a-later-commit":
      return `${problem.rowId} is ruled fixed without a commit made after the board`;
    case "forward-target-not-a-later-board-gate":
      return `${problem.rowId} is forwarded to '${problem.target}', which is not a later gate with a board`;
  }
};

const describeInvalidation = ({
  reason,
}: {
  readonly reason: ReceiptInvalidation;
}): string => {
  switch (reason.kind) {
    case "reviewer-dispatch":
      return `reviewer ${reason.agentType} reported after the gate closed`;
    case "seat-dispatch":
      return `seat ${reason.agentType} was dispatched after the gate closed`;
  }
};

type CloseReceiptCheck = {
  readonly gate: GateSlug;
  readonly receipt: CloseReceipt | null;
  readonly verdictHeadSha: string | null;
  readonly verdictNamesReceipt: boolean;
  readonly inboundRows: readonly ReviewRow[];
  readonly changedPathsSinceClose: readonly string[];
  readonly reviewedArtifactPaths: readonly string[];
};

const undisposedInboundOf = ({
  receipt,
  inboundRows,
}: {
  readonly receipt: CloseReceipt | null;
  readonly inboundRows: readonly ReviewRow[];
}): readonly ReviewRow[] =>
  inboundRows.filter(
    (inbound) =>
      receipt === null || !receipt.rows.some((row) => row.id === inbound.id),
  );

const closeReceiptRefusalOf = ({
  gate,
  receipt,
  verdictHeadSha,
  verdictNamesReceipt,
  inboundRows,
  changedPathsSinceClose,
  reviewedArtifactPaths,
}: CloseReceiptCheck): string | null => {
  const undisposed = undisposedInboundOf({ receipt, inboundRows });
  if (undisposed.length > 0) {
    return `'${gate}' has ${undisposed.length} row(s) forwarded to it that its closing ruling has not given an outcome:\n${undisposed.map((row) => `  - ${openRowLineOf({ row })} (forwarded from ${row.origin.kind === "forwarded" ? row.origin.fromGate : gate})`).join("\n")}\nDispatch ${SYNTHESIS_LENS} with these rows; each needs fixed@<sha>, rejected(<ground>) or forwarded(<later gate>).`;
  }
  if (receipt === null) {
    return verdictNamesReceipt
      ? `the review verdict for '${gate}' was closed by a closing receipt (${CLOSE_RECEIPT_FILENAME}) that is no longer in the gate's record directory — a close whose receipt is missing authorises nothing. Run the gate's board again.`
      : null;
  }
  if (receipt.validity.kind === "invalidated") {
    return `the closing receipt for '${gate}' was invalidated: ${describeInvalidation({ reason: receipt.validity.reason })}. Run the gate's board again; the earlier close no longer authorises an approve.`;
  }
  if (verdictHeadSha !== receipt.closedHeadSha) {
    return `the closing receipt for '${gate}' closed on ${receipt.closedHeadSha} but the review verdict is bound to ${verdictHeadSha ?? "no head"} — the receipt and the verdict do not describe the same close.`;
  }
  const editedAfterClose = changedPathsSinceClose.find((path) =>
    reviewedArtifactPaths.includes(path),
  );
  return editedAfterClose === undefined
    ? null
    : `'${editedAfterClose}' was edited after '${gate}' closed on ${receipt.closedHeadSha} — an edit to a reviewed artefact after the closing ruling invalidates the receipt. Restore the reviewed bytes, or run the gate's board again.`;
};

export type {
  AttemptEvent,
  AttemptLedgerEntry,
  AttemptState,
  AttemptStep,
  BoundedClosePolicy,
  CloseReceipt,
  CloseReceiptCheck,
  Closure,
  CompletedBoard,
  LensReportCapture,
  ReceiptInvalidation,
  ReviewRow,
  RowOutcome,
  RowRecheck,
  RuledRow,
  RulingProblem,
  UnadmittedFinding,
};
export {
  attemptStateOf,
  CLOSE_RECEIPT_EMITTER,
  CLOSE_RECEIPT_FILENAME,
  closeReceiptOf,
  closeReceiptRefusalOf,
  describeInvalidation,
  describeRulingProblem,
  earlierGatesOf,
  inboundRowsOf,
  invalidatedReceiptOf,
  laterBoardGatesOf,
  openRowLineOf,
  ruledRowLineOf,
  stepAttempt,
  SYNTHESIS_LENS,
};
