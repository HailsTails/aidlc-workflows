import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { auditConstitution } from "./constitution-audit/index.ts";
import { runCdSensorProjectMode } from "./rin-harness-cd-enforcement.ts";
import { wholeProjectService } from "./rin-harness-constitution-scope.ts";

test("CD-19 includes source, scripts and tests with explicit Node import forms", () => {
  const projectDir = mkdtempSync(join(tmpdir(), "rin-cd19-imports-"));
  const write = (relative: string, content: string): void => {
    const path = join(projectDir, relative);
    mkdirSync(join(path, ".."), { recursive: true });
    writeFileSync(path, content);
  };
  try {
    write(
      "src/forms.ts",
      [
        'import { readFile } from "node:fs/promises";',
        'import type { ExecFileOptions } from "node:child_process";',
        'import { createHook } from',
        '  "node:async_hooks";',
        'import "node:worker_threads";',
        'export { basename } from "node:path";',
        'import fs = require("node:fs");',
        'const util = require("node:util");',
        'const v8 = import("node:v8");',
        'const h2 = import("node:http2");',
        'const template = require(`node:fs`);',
        'type Fs = typeof import("node:fs");',
        'type Stats = import("node:fs").Stats;',
        'const text = "import x from node:crypto";',
        '// import x from "node:crypto";',
        'import fsBare from "fs";',
      ].join("\n"),
    );
    write("src/forms.test.ts", 'import { test } from "node:test";\n');
    write("tests/integration.ts", 'import { once } from "node:events";\n');
    const vendor = ["pi", "no"].join("");
    write(
      "scripts/build.ts",
      `import { execFile } from "node:child_process";\nimport pino from "${vendor}";\n`,
    );

    const report = auditConstitution({ service: wholeProjectService({ projectDir }) });
    const rawImports = report.violations.filter((v) =>
      v.rule === "CD-19" || v.rule === "CD-20",
    );
    expect(rawImports).toHaveLength(16);
    expect(rawImports.filter((v) => v.rule === "CD-20")).toHaveLength(15);
    expect(rawImports.filter((v) => v.rule === "CD-19")).toHaveLength(1);
    expect(rawImports.filter((v) => v.file.replaceAll("\\", "/").endsWith("scripts/build.ts"))).toHaveLength(2);
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
  } finally {
    rmSync(projectDir, { recursive: true, force: true });
  }
});
