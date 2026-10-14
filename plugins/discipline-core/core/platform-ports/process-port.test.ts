import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const PROBE = join(import.meta.dirname, "test-fixtures", "process-port-probe.ts");

const runProbe = () =>
  spawnSync(process.execPath, [PROBE, "first", "--second"], {
    encoding: "utf8",
  });

describe("createProcessPort", () => {
  it("reads the arguments after the script path, excluding the runtime binary and the script", () => {
    expect(runProbe().stdout).toBe('["first","--second"]');
  });

  it("exits with the code given to exitWith", () => {
    expect(runProbe().status).toBe(2);
  });
});
