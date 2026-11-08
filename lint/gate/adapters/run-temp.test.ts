import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { processRunner } from "./process-runner.ts";
import { runTemp } from "./run-temp.ts";

const ROOT = join(import.meta.dir, "../../..");
const PRINT = "console.log([process.env.TEMP, process.env.TMP, process.env.TMPDIR].join('|'))";
const PRINT_TEMPS = [process.execPath, "-e", PRINT];

describe("the per-run temp folder", () => {
  test("it is made beside the main checkout, not in the user temp, and removed on dispose", () => {
    const temp = runTemp(ROOT);
    expect(existsSync(temp.path)).toBe(true);
    expect(dirname(temp.path).endsWith(join(".cache", "tmp"))).toBe(true);
    temp.dispose();
    expect(existsSync(temp.path)).toBe(false);
  });

  test("every child gets it as TEMP, TMP and TMPDIR, whatever the caller had set", () => {
    const temp = runTemp(ROOT);
    const runner = processRunner(ROOT, temp.path);
    const inherited = runner.capture({ label: "inherit", argv: PRINT_TEMPS });
    const explicit = runner.capture({
      label: "explicit",
      argv: PRINT_TEMPS,
      env: { TEMP: "C:\\elsewhere", PATH: process.env["PATH"] ?? "" },
    });
    temp.dispose();
    const expected = [temp.path, temp.path, temp.path].join("|");
    expect(inherited.output.trim()).toBe(expected);
    expect(explicit.output.trim()).toBe(expected);
  });
});
