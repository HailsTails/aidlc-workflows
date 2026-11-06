import { expect, test, mock } from "bun:test";
import {
  createIntegrator,
  isNativeBundle,
  type IntegrationDependencies,
  type HarnessTarget,
} from "./integration.ts";
import { successful } from "../../__tests__/support.ts";
import { projectionFixture } from "../../__tests__/projection-fixtures.ts";
test("unauthenticated documents are refused before rendering", () => {
  const render = mock<HarnessTarget["render"]>();
  const { integrate } = createIntegrator({
    accepts: mock<IntegrationDependencies["accepts"]>().mockReturnValue("rejected"),
    render: mock<IntegrationDependencies["render"]>(),
  });
  expect(
    Reflect.apply(integrate, undefined, [
      {
        document: projectionFixture(),
        target: { harness: "claude", harnessDir: ".claude", render },
      },
    ]),
  ).toEqual({
    status: "invalid",
    findings: [
      {
        code: "unvalidated-document",
        subject: "integration",
        detail: "only live projector output is accepted",
      },
    ],
  });
  expect(render).not.toHaveBeenCalled();
});

test("integration owns immutable authenticated resource copies", () => {
  const accepts = mock<IntegrationDependencies["accepts"]>().mockReturnValue("accepted");
  const render = mock<IntegrationDependencies["render"]>().mockReturnValue({
    status: "ok",
    value: [{ kind: "file", path: "sensor.md", body: "Sensor" }],
  });
  const input = {
    document: projectionFixture(),
    target: { harness: "claude", harnessDir: ".claude", render: mock<HarnessTarget["render"]>() },
  };
  const issuer = createIntegrator({ accepts, render });
  const native = successful<import("./integration.ts").NativeBundle>(
    Reflect.apply(issuer.integrate, undefined, [input]),
  );
  expect(render).toHaveBeenCalledWith(input);
  expect(native.resources).toEqual([{ kind: "file", path: "sensor.md", body: "Sensor" }]);
  expect(Object.isFrozen(native.resources)).toBe(true);
  expect(Object.isFrozen(native.resources[0])).toBe(true);
  expect(issuer.isNativeBundle({ candidate: native })).toBe(true);
  expect(isNativeBundle({ candidate: native })).toBe(false);
  expect(issuer.isNativeBundle({ candidate: { ...native } })).toBe(false);
});
