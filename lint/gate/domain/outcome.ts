export const CHECK_IDS = [
  "ownership",
  "zones",
  "records",
  "lint",
  "disciplines",
  "typecheck",
  "monolith",
  "kernel",
  "isolation",
  "tests",
  "goldens",
] as const;

export type CheckId = (typeof CHECK_IDS)[number];

export type Finding = {
  readonly subject: string;
  readonly violation: string;
  readonly fix: string;
};

export type CheckStatus = "green" | "red" | "skipped";

export type CheckOutcome = {
  readonly id: CheckId;
  readonly status: CheckStatus;
  readonly findings: readonly Finding[];
  readonly note: string;
  readonly durationMs?: number;
};

export type GateVerdict = "green" | "red" | "error" | "busy";

export const judged = (request: {
  readonly id: CheckId;
  readonly findings: readonly Finding[];
  readonly note: string;
}): CheckOutcome => ({
  ...request,
  status: request.findings.length === 0 ? "green" : "red",
});

export const skipped = (id: CheckId, note: string): CheckOutcome => ({
  id,
  status: "skipped",
  findings: [],
  note,
});

export const verdictOf = (outcomes: readonly CheckOutcome[]): GateVerdict =>
  outcomes.some((outcome) => outcome.status === "red") ? "red" : "green";

export const distinctFixes = (findings: readonly Finding[]): readonly string[] => [
  ...new Set(findings.map((finding) => finding.fix)),
];
