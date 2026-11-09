import { describe, expect, test } from "bun:test";
import type { GateScope } from "./gate-scope.ts";
import { goldensCheck } from "./goldens-check.ts";

const scope = (path: string): GateScope => ({
  lane: undefined, base: { ref: "foundation", commit: "abc" },
  changes: [{ path, kind: "modified" }], everything: false,
  build: false, record: false, allTests: false,
  heavy: { ensure: async () => ({ acquired: true }) },
});

const fixture = (install = true) => {
  const calls: string[] = [];
  const check = goldensCheck({
    runner: { capture: () => ({ exitCode: 0, output: "" }),
      captureAll: async () => [], attach: () => 0 },
    build: { ensure: () => { calls.push("build"); return undefined; } },
    store: { read: () => ({}), write: () => undefined },
    source: { measure: () => { calls.push("outputs"); return {}; } },
    ...(install ? { install: () => { calls.push("install"); return []; } } : {}),
  });
  return { check, calls };
};

describe("scoped Phase 1 goldens", () => {
  test.each(["src/projection/render.ts", "scripts/package.ts",
    "docs/reference/15-stage-definition.md", "harness/kiro-ide/manifest.ts"])(
    "%s builds and judges both output and install goldens", async (path) => {
      const f = fixture();
      expect((await f.check.run(scope(path))).status).toBe("green");
      expect(f.calls).toEqual(["build", "outputs", "install"]);
    },
  );
  test("missing install qualification cannot be green", async () => {
    expect((await fixture(false).check.run(scope("src/x.ts"))).status).toBe("red");
  });
  test("admission denial runs neither build nor fixtures", async () => {
    const f = fixture();
    const outcome = await f.check.run({ ...scope("src/x.ts"),
      heavy: { ensure: async () => ({ acquired: false, reason: "no free slot" }) },
    });
    expect(outcome.status).toBe("red");
    expect(f.calls).toEqual([]);
  });
});
