import { z } from "zod";
import { BoardVerdictFileSchema } from "./rin-gates-board-bridge.ts";

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
};

const decodedData = <Value>(result: Decoded<Value>): Decoded<Value> =>
  result.success ? { success: true, data: result.data } : { success: false };

const defaultReviewDecodersPort = (): ReviewDecodersPort => {
  const capture = z.object({ lens: z.string(), verdict: z.string(), findings: z.array(z.string()), sessionId: z.string(), at: z.string(), agentId: z.string().optional(), channel: z.enum(["handback", "stop-message"]).optional(), reportText: z.string().optional() }).readonly();
  const handback = z.object({ agentId: z.string() });
  const route = z.enum(["conductor-report", "legacy-append"]).default("conductor-report");
  const modernBoard = z.object({ verdict: z.enum(["READY", "NOT-READY"]), reportsComplete: z.boolean(), findings: z.array(z.string()), reports: z.array(z.object({ lens: z.string(), findings: z.array(z.string()), sessionId: z.string(), agentId: z.string().nullable(), channel: z.string().nullable(), reportText: z.string().nullable(), headSha: z.string(), gate: z.string() })) });
  return {
    capture: (value) => decodedData(capture.safeParse(value)),
    handback: (value) => decodedData(handback.safeParse(value)),
    route: (value) => decodedData(route.safeParse(value)),
    board: (value) => decodedData(BoardVerdictFileSchema.safeParse(value)),
    modernBoard: (value) => decodedData(modernBoard.safeParse(value)),
  };
};

export type { Capture, Decoded, ModernBoardVerdict, ReviewDecodersPort };
export { defaultReviewDecodersPort };
