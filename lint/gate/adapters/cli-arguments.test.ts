import { describe, expect, test } from "bun:test";
import { gateRequestFrom } from "./cli-arguments.ts";

const DEFAULTS = { baseRef: "origin/rebuild/foundation", waitSeconds: 1800 };

describe("sweep arguments", () => {
  test("full sweep is explicit", () => {
    expect(gateRequestFrom(["--full", "--sweep"], DEFAULTS)).toMatchObject({
      ok: true, value: { kind: "full", sweep: true, build: true, only: "all" },
    });
  });
  test.each([
    { args: ["--scope", "G", "--sweep"] },
    { args: ["--full", "--sweep", "--only", "tests"] },
    { args: ["--full", "--sweep", "--no-build"] },
    { args: ["--full", "--sweep", "--record"] },
  ])("partial or mutating invocation cannot be a sweep: %j", ({ args }) => {
    expect(gateRequestFrom(args, DEFAULTS).ok).toBe(false);
  });
});