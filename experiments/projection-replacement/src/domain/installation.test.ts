import { expect, test, mock } from "bun:test";
import {
  isInstallationPlan,
  createInstallationPlanner,
  type InstallationDependencies,
} from "./installation.ts";
import { successful } from "../../__tests__/support.ts";
import { installationFixture } from "../../__tests__/installation-fixtures.ts";
test("structural bundles cannot construct writable plans", () => {
  const { planInstallation } = createInstallationPlanner({
    accepts: mock<InstallationDependencies["accepts"]>().mockReturnValue("rejected"),
    decide: mock<InstallationDependencies["decide"]>(),
  });
  expect(Reflect.apply(planInstallation, undefined, [installationFixture()])).toEqual({
    status: "invalid",
    findings: [
      {
        code: "unvalidated-bundle",
        subject: "installation",
        detail: "only native integration output is accepted",
      },
    ],
  });
});
test("a structural decision is not a writable installation plan", () => {
  expect(isInstallationPlan({ candidate: { changes: [], conflicts: [] } })).toBe(false);
});

test("planner authenticates its own immutable plan and rejects its copy", () => {
  const accepts = mock<InstallationDependencies["accepts"]>().mockReturnValue("accepted");
  const decide = mock<InstallationDependencies["decide"]>().mockReturnValue({
    changes: [],
    conflicts: [],
  });
  const input = installationFixture();
  const issuer = createInstallationPlanner({ accepts, decide });
  const plan = successful<import("./installation.ts").InstallationPlan>(
    Reflect.apply(issuer.planInstallation, undefined, [input]),
  );
  expect(decide).toHaveBeenCalledWith(input);
  expect(issuer.isInstallationPlan({ candidate: plan })).toBe(true);
  expect(isInstallationPlan({ candidate: plan })).toBe(false);
  expect(issuer.isInstallationPlan({ candidate: { ...plan } })).toBe(false);
  expect(Object.isFrozen(plan.changes)).toBe(true);
  expect(plan).toMatchObject({
    harness: "claude",
    selectedPlugins: ["test-pro"],
    expectedRevision: 0,
    expectedResources: "[]",
    changes: [],
    conflicts: [],
  });
});
