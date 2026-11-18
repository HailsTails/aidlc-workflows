import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { processRunner } from "./process-runner.ts";
import { runTemp } from "./run-temp.ts";

const ROOT = join(import.meta.dir, "../../..");
const failedOutput = [
  "(pass) unrelated success", "17 | expect(actual).toBe(expected)",
  "error: Expected: 0", "Received: 1", "at fixture.test.ts:17:4",
  "(fail) the deliberate fixture failure [2ms]", "(pass) another success",
].join("\n");
const command = (code: number) => ({
  label: "retention probe",
  argv: [process.execPath, "-e",
    `console.error(${JSON.stringify(failedOutput)});process.exit(${code})`],
});
const evidence = (root: string): string[] => {
  const parent = join(root, ".cache", "gate-failures");
  return readdirSync(parent).map((name) => readFileSync(join(parent, name, "output.log"), "utf8"));
};

describe("failure evidence outlives the runner temp", () => {
  test("both capture paths keep assertions after temp disposal", async () => {
    const root = runTemp(ROOT);
    const temp = mkdtempSync(join(root.path, "runner-"));
    try {
      const runner = processRunner(root.path, temp);
      expect(runner.capture(command(1)).exitCode).toBe(1);
      const results = await runner.captureAll({ commands: [command(1)], concurrency: 1 });
      expect(results[0]?.exitCode).toBe(1);
      rmSync(temp, { recursive: true, force: true });
      const logs = evidence(root.path);
      expect(logs).toHaveLength(2);
      for (const log of logs) {
        expect(log).toContain("Expected: 0");
        expect(log).toContain("Received: 1");
        expect(log).toContain("fixture.test.ts:17:4");
        expect(log).toContain("(fail) the deliberate fixture failure");
        expect(log).not.toContain("(pass)");
      }
    } finally { root.dispose(); }
  });

  test("green commands create no failure artifacts", () => {
    const root = runTemp(ROOT);
    try {
      expect(processRunner(root.path, root.path).capture(command(0)).exitCode).toBe(0);
      expect(existsSync(join(root.path, ".cache", "gate-failures"))).toBe(false);
    } finally { root.dispose(); }
  });
});
