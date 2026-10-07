import { readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

type GraphNode = {
  readonly slug?: unknown;
  readonly reviewer?: unknown;
  readonly scopes?: unknown;
  readonly phase?: unknown;
  readonly review_artifact?: unknown;
};

const RIN_GATES_SCOPE = "rin-gates";

const isRinGateNode = (node: GraphNode): boolean =>
  typeof node.slug === "string" &&
  Array.isArray(node.scopes) &&
  node.scopes.includes(RIN_GATES_SCOPE);

const stageGraphHarnessRoot = (): string => {
  const parent = dirname(dirname(HERE));
  return basename(parent) === "rin" && basename(dirname(parent)) === "plugins"
    ? join(dirname(dirname(parent)), ".claude")
    : parent;
};

export const BOARD_COORDINATOR = "rin-decorrelated-review-agent";

export type GateReviewer = {
  readonly gate: string;
  readonly reviewer: string;
};

export type ReviewerAdmission =
  | { readonly kind: "admitted"; readonly via: "roster" | "board-coordinator" }
  | { readonly kind: "divergent"; readonly roster: readonly string[] };

export const admitReviewer = (args: {
  readonly reviewer: string;
  readonly roster: readonly string[];
}): ReviewerAdmission => {
  if (args.reviewer === BOARD_COORDINATOR) {
    return { kind: "admitted", via: "board-coordinator" };
  }
  if (args.roster.includes(args.reviewer)) {
    return { kind: "admitted", via: "roster" };
  }
  return { kind: "divergent", roster: args.roster };
};

export const rinGateReviewersIn = (graph: unknown): readonly GateReviewer[] => {
  if (!Array.isArray(graph)) return [];
  return graph
    .filter(
      (node): node is GraphNode => typeof node === "object" && node !== null,
    )
    .filter(isRinGateNode)
    .flatMap((node) =>
      typeof node.slug === "string" && typeof node.reviewer === "string"
        ? [{ gate: node.slug, reviewer: node.reviewer }]
        : [],
    );
};

export const stageGraphPath = (): string =>
  process.env["AIDLC_STAGE_GRAPH"] ??
  join(stageGraphHarnessRoot(), "tools", "data", "stage-graph.json");

export const loadStageGraphNodes = (path: string): unknown => {
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as unknown;
  } catch {
    return null;
  }
};

export const declaredReviewerFor = (args: {
  readonly gate: string;
  readonly graph: unknown;
}): string | null => {
  const match = rinGateReviewersIn(args.graph).find(
    (entry) => entry.gate === args.gate,
  );
  return match === undefined ? null : match.reviewer;
};

export const declaredReviewArtifactPathFor = (args: {
  readonly gate: string;
  readonly graph: unknown;
}): string | null => {
  if (!Array.isArray(args.graph)) return null;
  const node = args.graph
    .filter(
      (entry): entry is GraphNode =>
        typeof entry === "object" && entry !== null,
    )
    .find((entry) => entry.slug === args.gate);
  if (node === undefined) return null;
  const { phase, review_artifact: artifact } = node;
  if (typeof phase !== "string" || typeof artifact !== "string") return null;
  return join(phase, args.gate, `${artifact}.md`);
};

export type TotalityFinding = {
  readonly gate: string;
  readonly reviewer: string;
  readonly roster: readonly string[];
};

export type TotalityResult =
  | { readonly kind: "total"; readonly gatesChecked: number }
  | { readonly kind: "empty-scan" }
  | {
      readonly kind: "divergent";
      readonly findings: readonly TotalityFinding[];
    };

export const checkReviewerTotality = (args: {
  readonly gateReviewers: readonly GateReviewer[];
  readonly rosterFor: (gate: string) => readonly string[];
}): TotalityResult => {
  if (args.gateReviewers.length === 0) return { kind: "empty-scan" };
  const findings = args.gateReviewers.flatMap((entry) => {
    const roster = args.rosterFor(entry.gate);
    const admission = admitReviewer({ reviewer: entry.reviewer, roster });
    return admission.kind === "divergent"
      ? [{ gate: entry.gate, reviewer: entry.reviewer, roster }]
      : [];
  });
  return findings.length === 0
    ? { kind: "total", gatesChecked: args.gateReviewers.length }
    : { kind: "divergent", findings };
};
