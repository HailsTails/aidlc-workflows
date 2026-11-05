import { expect, test, mock } from "bun:test";
import { isProjectedDocument, createProjector, type ProjectionDependencies } from "./projection.ts";
import { successful } from "../../__tests__/support.ts";
import { preparationFixture, projectionFixture } from "../../__tests__/projection-fixtures.ts";
test("structural preparation cannot cross the authentic projection gate", () => {
  const { project: projector } = createProjector({
    accepts: mock<ProjectionDependencies["accepts"]>().mockReturnValue("rejected"),
    render: mock<ProjectionDependencies["render"]>(),
  });
  expect(Reflect.apply(projector, undefined, [preparationFixture()])).toEqual({
    status: "invalid",
    findings: [
      {
        code: "unvalidated-input",
        subject: "projection",
        detail: "use preparation before projection",
      },
    ],
  });
});
test("structural rendered content is not an authenticated projected document", () => {
  expect(isProjectedDocument({ candidate: projectionFixture() })).toBe(false);
});

test("projector authenticates only its own frozen output", () => {
  const render = mock<ProjectionDependencies["render"]>().mockReturnValue({
    status: "ok",
    value: projectionFixture(),
  });
  const accepts = mock<ProjectionDependencies["accepts"]>().mockReturnValue("accepted");
  const input = preparationFixture();
  const issuer = createProjector({ accepts, render });
  const document = successful<import("./projection.ts").ProjectedDocument>(
    Reflect.apply(issuer.project, undefined, [input]),
  );
  expect(accepts).toHaveBeenCalledWith({ candidate: input });
  expect(render).toHaveBeenCalledWith(input);
  expect(issuer.isProjectedDocument({ candidate: document })).toBe(true);
  expect(isProjectedDocument({ candidate: document })).toBe(false);
  expect(issuer.isProjectedDocument({ candidate: { ...document } })).toBe(false);
  expect(issuer.isProjectedDocument({ candidate: JSON.parse(JSON.stringify(document)) })).toBe(
    false,
  );
  expect(Object.isFrozen(document)).toBe(true);
});
