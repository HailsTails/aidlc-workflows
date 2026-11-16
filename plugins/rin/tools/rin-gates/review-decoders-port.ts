import { z } from "zod";
import { BoardVerdictFileSchema } from "./rin-gates-board-bridge.ts";
import { BOARD_VERDICT_TOKENS, GATE_PHASES, type GateSlug } from "./rin-gate-namespace.ts";
import type { AttemptLedgerEntry, CloseReceipt } from "./rin-gates-bounded-close.ts";

type Capture = {
  readonly lens: string;
  readonly verdict: string;
  readonly findings: readonly string[];
  readonly sessionId: string;
  readonly at: string;
  readonly agentId?: string;
  readonly channel?: "handback" | "stop-message";
  readonly reportText?: string;
};
type Decoded<Value> = { readonly success: true; readonly data: Value } | { readonly success: false };
type ReviewRoute = "conductor-report" | "legacy-append";
type BoardVerdictSummary = {
  readonly gate: string; readonly taskId: string; readonly verdict: "READY" | "NOT-READY";
  readonly lenses: readonly string[]; readonly blockingFindings: readonly string[]; readonly headSha?: string;
  readonly binding?: { readonly mode: string; readonly headSha?: string };
};
type ModernLensReport = {
  readonly lens: string; readonly findings: readonly string[]; readonly sessionId: string;
  readonly agentId: string | null; readonly channel: string | null; readonly reportText: string | null;
  readonly headSha: string; readonly gate: string;
};
type ModernBoardVerdict = {
  readonly verdict: "READY" | "NOT-READY"; readonly reportsComplete: boolean;
  readonly findings: readonly string[]; readonly reports: readonly ModernLensReport[];
};
type ReviewDecodersPort = {
  readonly capture: (value: unknown) => Decoded<Capture>;
  readonly handback: (value: unknown) => Decoded<{ readonly agentId: string }>;
  readonly route: (value: unknown) => Decoded<ReviewRoute>;
  readonly board: (value: unknown) => Decoded<BoardVerdictSummary>;
  readonly modernBoard: (value: unknown) => Decoded<ModernBoardVerdict>;
  readonly attemptLedgerEntry: (value: unknown) => Decoded<AttemptLedgerEntry>;
  readonly closeReceipt: (value: unknown) => Decoded<CloseReceipt>;
};

const decodedData = <Value>(result: Decoded<Value>): Decoded<Value> =>
  result.success ? { success: true, data: result.data } : { success: false };

const defaultReviewDecodersPort = (): ReviewDecodersPort => {
  const capture = z.object({ lens: z.string(), verdict: z.string(), findings: z.array(z.string()), sessionId: z.string(), at: z.string(), agentId: z.string().optional(), channel: z.enum(["handback", "stop-message"]).optional(), reportText: z.string().optional() }).readonly();
  const handback = z.object({ agentId: z.string() });
  const route = z.enum(["conductor-report", "legacy-append"]).default("conductor-report");
  const modernBoard = z.object({ verdict: z.enum(["READY", "NOT-READY"]), reportsComplete: z.boolean(), findings: z.array(z.string()), reports: z.array(z.object({ lens: z.string(), findings: z.array(z.string()), sessionId: z.string(), agentId: z.string().nullable(), channel: z.string().nullable(), reportText: z.string().nullable(), headSha: z.string(), gate: z.string() })) });
  const gateSlug = z.custom<GateSlug>((value) => typeof value === "string" && Object.hasOwn(GATE_PHASES, value));
  const boardVerdict = z.enum(BOARD_VERDICT_TOKENS);
  const lensReportCapture = z.object({ lens: z.string(), verdict: boardVerdict, findings: z.array(z.string()), headSha: z.string(), at: z.string(), sessionId: z.string(), agentId: z.string().nullable(), channel: z.enum(["handback", "stop-message"]).nullable(), reportText: z.string().nullable() });
  const attemptLedgerEntry = z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("report"), capture: lensReportCapture }),
    z.object({ kind: z.literal("seat-dispatch"), agentType: z.string(), at: z.string() }),
  ]);
  const rowOrigin = z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("raised") }),
    z.object({ kind: z.literal("forwarded"), fromGate: gateSlug }),
  ]);
  const rowOutcome = z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("fixed"), commitSha: z.string() }),
    z.object({ kind: z.literal("rejected"), ground: z.string() }),
    z.object({ kind: z.literal("forwarded"), toGate: gateSlug }),
  ]);
  const receiptInvalidation = z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("reviewer-dispatch"), agentType: z.string() }),
    z.object({ kind: z.literal("seat-dispatch"), agentType: z.string() }),
  ]);
  const closeReceipt = z.object({
    schemaVersion: z.literal(1), gate: gateSlug, record: z.string(), attempt: z.number().int().positive(),
    validity: z.discriminatedUnion("kind", [
      z.object({ kind: z.literal("standing") }),
      z.object({ kind: z.literal("invalidated"), reason: receiptInvalidation, at: z.string() }),
    ]),
    closedBy: z.enum(["clean-board", "closing-ruling"]), boardHeadSha: z.string(), closedHeadSha: z.string(), closedAt: z.string(),
    carriedLenses: z.array(z.object({ lens: z.string(), verdict: boardVerdict, headSha: z.string() })),
    rows: z.array(z.object({ id: z.string(), lens: z.string(), text: z.string(), origin: rowOrigin, outcome: rowOutcome, note: z.string() })),
    rechecks: z.array(z.object({ rowId: z.string(), lens: z.string(), headSha: z.string(), claim: z.string() })),
    unadmitted: z.array(z.object({ lens: z.string(), headSha: z.string(), text: z.string() })),
    emittedBy: z.literal("rin-gates-review-scribe"),
  });
  return {
    attemptLedgerEntry: (value) => decodedData(attemptLedgerEntry.safeParse(value)),
    closeReceipt: (value) => decodedData(closeReceipt.safeParse(value)),
    capture: (value) => decodedData(capture.safeParse(value)),
    handback: (value) => decodedData(handback.safeParse(value)),
    route: (value) => decodedData(route.safeParse(value)),
    board: (value) => decodedData(BoardVerdictFileSchema.safeParse(value)),
    modernBoard: (value) => decodedData(modernBoard.safeParse(value)),
  };
};

export type { Capture, Decoded, ModernBoardVerdict, ReviewDecodersPort };
export { defaultReviewDecodersPort };
