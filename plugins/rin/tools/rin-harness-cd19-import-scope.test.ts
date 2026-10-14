import { expect, test } from "vitest";
import { auditConstitution } from "./constitution-audit/index.ts";
import { runCdSensorProjectMode } from "./rin-harness-cd-enforcement.ts";
import { wholeProjectService } from "./rin-harness-constitution-scope.ts";

const projectDir = `${import.meta.dirname.replace(/\\/g, "/")}/test-fixtures/cd19-imports`;

test("CD-19 includes source, scripts and tests with explicit Node import forms", () => {
  const report = auditConstitution({ service: wholeProjectService({ projectDir }) });
  const rawImports = report.violations.filter((v) =>
    v.rule === "CD-19" || v.rule === "CD-20",
  );
  expect(rawImports).toHaveLength(16);
  expect(rawImports.filter((v) => v.rule === "CD-20")).toHaveLength(15);
  expect(rawImports.filter((v) => v.rule === "CD-19")).toHaveLength(1);
  expect(
    rawImports.filter((v) => v.file.replaceAll("\\", "/").endsWith("scripts/build.ts")),
  ).toHaveLength(2);
  expect(rawImports.find((v) => v.snippet.endsWith("node:async_hooks"))?.line).toBe(4);

  const sensor = runCdSensorProjectMode({ cdId: "CD-19", projectDir });
  expect(sensor.evaluation).toBe("project");
  expect(sensor.violations).toHaveLength(16);
  expect(sensor.violations.map((v) => v.file)).toEqual(
    expect.arrayContaining([
      "src/forms.ts",
      "src/forms.test.ts",
      "tests/integration.ts",
      "scripts/build.ts",
    ]),
  );
  expect(sensor.violations.filter((v) => v.file === "scripts/build.ts")).toHaveLength(2);
  expect(sensor.violations.some((v) => v.snippet.includes("fsBare"))).toBe(false);
});
