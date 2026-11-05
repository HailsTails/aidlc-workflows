export type DestinationCasePolicy = "case-sensitive" | "case-insensitive";
export type DestinationCollision =
  | { readonly status: "distinct" }
  | { readonly status: "collision"; readonly kind: "same" | "ancestor" | "descendant"; readonly prior: string };
export type DestinationComparison = {
  readonly candidate: string;
  readonly priorPaths: readonly string[];
  readonly casePolicy: DestinationCasePolicy;
};
const comparisonKey = (request: { readonly path: string; readonly casePolicy: DestinationCasePolicy }): string =>
  request.casePolicy === "case-insensitive" ? request.path.toLowerCase() : request.path;
const comparePrior = (request: { readonly candidateKey: string; readonly prior: string; readonly casePolicy: DestinationCasePolicy }): DestinationCollision => {
  const priorKey = comparisonKey({ path: request.prior, casePolicy: request.casePolicy });
  if (request.candidateKey === priorKey) return { status: "collision", kind: "same", prior: request.prior };
  if (request.candidateKey.startsWith(`${priorKey}/`)) return { status: "collision", kind: "descendant", prior: request.prior };
  if (priorKey.startsWith(`${request.candidateKey}/`)) return { status: "collision", kind: "ancestor", prior: request.prior };
  return { status: "distinct" };
};
export const findDestinationCollision = (request: DestinationComparison): DestinationCollision => {
  const candidateKey = comparisonKey({ path: request.candidate, casePolicy: request.casePolicy });
  return request.priorPaths.map((prior) => comparePrior({ candidateKey, prior, casePolicy: request.casePolicy }))
    .find((comparison) => comparison.status === "collision") ?? { status: "distinct" };
};
