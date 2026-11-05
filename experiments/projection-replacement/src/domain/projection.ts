import { finding, type Outcome } from "./model.ts";
import { isPreparedProjection, type PreparedProjection } from "./preparation.ts";
import { renderProjection, type ProjectionContent } from "./projection-content.ts";
const projected = Symbol("projected-document");
export type ProjectedDocument = ProjectionContent & { readonly [projected]: true };
export type ProjectionOutcome = Outcome<ProjectedDocument>;
export type ProjectionCandidate = { readonly candidate: unknown };
export type ProjectionDependencies = {
  readonly accepts: (input: { readonly candidate: unknown }) => "accepted" | "rejected";
  readonly render: typeof renderProjection;
};
export type Projector = (input: PreparedProjection) => ProjectionOutcome;
export const createProjectionDependencies = (): ProjectionDependencies => ({
  accepts: (input) => (isPreparedProjection(input) ? "accepted" : "rejected"),
  render: renderProjection,
});
export const createProjector = (
  dependencies: ProjectionDependencies = createProjectionDependencies(),
): ProjectionService => {
  const documents = new WeakSet<object>();
  const isProjectedDocument = (input: {
    readonly candidate: unknown;
  }): input is { readonly candidate: ProjectedDocument } =>
    typeof input.candidate === "object" &&
    input.candidate !== null &&
    documents.has(input.candidate);
  const project: Projector = (input) => {
    if (dependencies.accepts({ candidate: input }) === "rejected")
      return {
        status: "invalid",
        findings: [
          finding({
            code: "unvalidated-input",
            subject: "projection",
            detail: "use preparation before projection",
          }),
        ],
      };
    const rendered = dependencies.render(input);
    if (rendered.status === "invalid") return rendered;
    const document = Object.freeze<ProjectedDocument>({ ...rendered.value, [projected]: true });
    documents.add(document);
    return { status: "ok", value: document };
  };

  return Object.freeze({ project, isProjectedDocument });
};
export type ProjectionService = {
  readonly project: Projector;
  readonly isProjectedDocument: (
    input: ProjectionCandidate,
  ) => input is { readonly candidate: ProjectedDocument };
};
const canonicalProjection = createProjector();
export const project = canonicalProjection.project;
export const isProjectedDocument = canonicalProjection.isProjectedDocument;
