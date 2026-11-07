const GATE_PHASES = {
  "rin-gate-0-reconcile": "inception",
  "rin-gate-1-framing": "inception",
  "rin-gate-2-plan-review": "inception",
  "rin-gate-3-interface-lock": "inception",
  "rin-gate-4-implement": "construction",
  "rin-gate-5-review-cycle": "construction",
  "rin-gate-6-operate": "operation",
} as const;

type GateSlug = keyof typeof GATE_PHASES;
type GatePhase = (typeof GATE_PHASES)[GateSlug];

const isGateSlug = (gate: string): gate is GateSlug =>
  Object.hasOwn(GATE_PHASES, gate);

const phaseOfGate = (gate: string): GatePhase | null =>
  isGateSlug(gate) ? GATE_PHASES[gate] : null;

const REVIEW_VERDICT_FILENAME = "review-verdict.json";

const BOARD_VERDICT_TOKENS = ["READY", "NOT-READY"] as const;

type BoardVerdictToken = (typeof BOARD_VERDICT_TOKENS)[number];

const gateDirSegments = (
  gate: string,
): readonly [GatePhase, GateSlug] | null =>
  isGateSlug(gate) ? [GATE_PHASES[gate], gate] : null;

const reviewVerdictSegments = (
  gate: string,
): readonly [GatePhase, GateSlug, typeof REVIEW_VERDICT_FILENAME] | null => {
  const segments = gateDirSegments(gate);
  return segments === null
    ? null
    : [segments[0], segments[1], REVIEW_VERDICT_FILENAME];
};

export type { BoardVerdictToken, GatePhase, GateSlug };
export {
  BOARD_VERDICT_TOKENS,
  GATE_PHASES,
  gateDirSegments,
  isGateSlug,
  phaseOfGate,
  REVIEW_VERDICT_FILENAME,
  reviewVerdictSegments,
};
