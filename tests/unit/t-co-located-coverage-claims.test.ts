// covers: harness-instrument:coverage-registry-generator

import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NATIVE_STARTUP_TIMEOUT_MS } from "../harness/test-budget.ts";

test("co-located claims use the selected claims tree and keep their source-relative identity", () => {
  const fixture = mkdtempSync(join(tmpdir(), "co-located-claims-"));
  try {
    const tests = join(fixture, "tests");
    mkdirSync(tests, { recursive: true });
    mkdirSync(join(fixture, "core", "tools"), { recursive: true });
    writeFileSync(join(fixture, "core", "tools", "selection.test.ts"), "// covers: function:compareComposerPlans\n");
    const tool = join(import.meta.dir, "..", "gen-coverage-registry.ts").replaceAll("\\", "/");
    const run = spawnSync(process.execPath, ["--eval", `import { discoverClaims } from ${JSON.stringify(tool)}; console.log(JSON.stringify(discoverClaims()));`], {
      env: { ...process.env, AIDLC_COVERAGE_TESTS_DIR: tests },
      encoding: "utf8", timeout: NATIVE_STARTUP_TIMEOUT_MS,
    });
    expect(run.status, run.stderr).toBe(0);
    expect(JSON.parse(run.stdout)).toEqual([{
      file: "core/tools/selection.test.ts", mechanisms: ["none"], unitIds: ["function:compareComposerPlans"],
    }]);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
}, NATIVE_STARTUP_TIMEOUT_MS);

test("real source claims retain their mechanism and source-relative owner", () => {
  const tool = join(import.meta.dir, "..", "gen-coverage-registry.ts").replaceAll("\\", "/");
  const env = { ...process.env };
  delete env.AIDLC_COVERAGE_TESTS_DIR;
  const run = spawnSync(process.execPath, ["--eval", `import { discoverClaims } from ${JSON.stringify(tool)}; console.log(JSON.stringify(discoverClaims().filter(claim => claim.file === 'core/tools/aidlc-composer-plan-selection.test.ts')));`], {
    env, encoding: "utf8", timeout: NATIVE_STARTUP_TIMEOUT_MS,
  });
  expect(run.status, run.stderr).toBe(0);
  expect(JSON.parse(run.stdout)).toEqual([{
    file: "core/tools/aidlc-composer-plan-selection.test.ts", mechanisms: ["none"],
    unitIds: ["function:compareComposerPlans", "function:composerPlansShown"],
  }]);
}, NATIVE_STARTUP_TIMEOUT_MS);
