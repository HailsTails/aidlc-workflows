import { prepareAndProject } from "./prepare.ts";
import { finding, type Outcome } from "../domain/model.ts";
import type { ProjectedDocument } from "../domain/projection.ts";
export type PortableProjection = (input: {
  readonly json: string;
}) => Outcome<readonly ProjectedDocument[]>;
export type PortableProjectorInput = {
  readonly projectInput: (request: {
    readonly input: unknown;
  }) => Outcome<readonly ProjectedDocument[]>;
};
export const createPortableProjector =
  ({ projectInput }: PortableProjectorInput): PortableProjection =>
  ({ json }) => {
    let candidate: unknown;
    try {
      candidate = JSON.parse(json);
    } catch {
      return {
        status: "invalid",
        findings: [
          finding({
            code: "invalid-json",
            subject: "portable-input",
            detail: "expected JSON projection request",
          }),
        ],
      };
    }
    return projectInput({ input: candidate });
  };

export const projectPortable: PortableProjection = createPortableProjector({
  projectInput: prepareAndProject,
});
