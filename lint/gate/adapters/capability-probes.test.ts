import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { capabilityProbes } from "./capability-probes.ts";

const SCRATCH = mkdtempSync(join(import.meta.dir, "../../../.cache/gate-tests-probe-"));

afterAll(() => {
  rmSync(SCRATCH, { recursive: true, force: true });
});

const canList = (directory: string): boolean => {
  try {
    readdirSync(directory);
    return true;
  } catch {
    return false;
  }
};

describe("capability probes", () => {
  test("the system temp probe agrees with an attempt to list the folder", () => {
    const directory = join(process.env["SystemRoot"] ?? "C:\\Windows", "Temp");
    const result = capabilityProbes(SCRATCH).probe("listable-system-temp");
    expect(result.available).toBe(canList(directory));
  });

  test("every probe states its evidence", () => {
    const probes = capabilityProbes(SCRATCH);
    const ids = ["symlinks", "short-names", "listable-system-temp"] as const;
    expect(ids.every((id) => probes.probe(id).evidence.length > 0)).toBe(true);
  });

  test("the short-names probe names the fixture root it checked", () => {
    const evidence = capabilityProbes(SCRATCH).probe("short-names").evidence.toLowerCase();
    const named = evidence.includes(SCRATCH.toLowerCase());
    expect(process.platform !== "win32" || named).toBe(true);
  });
});
