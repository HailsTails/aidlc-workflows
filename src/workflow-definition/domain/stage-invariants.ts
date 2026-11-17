import type { MethodRefusal } from "./refusals.ts";
import type { ArtifactProduction, Stage } from "./stage.ts";

import { UNIT_KINDS } from "./vocabulary.ts";

const participationIssues = (stage: Stage): string[] => {
  const { mode, supports } = stage.participation;
  if ((mode === "pipeline" || mode === "mob") && supports.length === 0) {
    return [`${mode} requires at least one support agent`];
  }
  return [];
};

const kindsOf = (production: ArtifactProduction) =>
  production.unitKinds === "all" ? UNIT_KINDS : production.unitKinds;

const reviewKindsIssue = (stage: Stage, artifact: ArtifactProduction): string[] => {
  if (stage.cardinality.kind !== "per-unit") return [];
  const required = stage.produces.filter((production) => production.obligation === "required");
  const requiredKinds = new Set(required.flatMap((production) => [...kindsOf(production)]));
  const reviewedKinds = new Set(kindsOf(artifact));
  const missing = [...requiredKinds].filter((kind) => !reviewedKinds.has(kind));
  return missing.length ? [`The review artifact is unavailable for: ${missing.join(", ")}`] : [];
};

const reviewIssues = (stage: Stage): string[] => {
  const review = stage.review;
  if (!review) return [];
  const artifact = stage.produces.find((production) => production.artifact === review.artifact);
  const issues: string[] = [];
  if (artifact?.obligation !== "required") {
    issues.push("The review artifact must be a required production");
  }
  if (!Number.isInteger(review.maxIterations) || review.maxIterations < 1) {
    issues.push("Review iterations must be a positive integer");
  }
  if (artifact) issues.push(...reviewKindsIssue(stage, artifact));
  return issues;
};

export const validateStage = (stage: Stage): readonly MethodRefusal[] => {
  const issues = [...participationIssues(stage), ...reviewIssues(stage)];
  if (issues.length === 0) return [];
  return [{ kind: "invalid-file", location: { kind: "method-source", path: stage.source, owner: stage.owner }, issues }];
};
