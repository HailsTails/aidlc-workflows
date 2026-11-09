import { describe, expect, test } from "bun:test";
import type { CheckId } from "../domain/outcome.ts";
import type { GateCheck } from "./gate-check.ts";
import type { ScopeRequest } from "./gate-request.ts";
import type { Loaded } from "./ports.ts";
import { runGateRequest, type GateServices } from "./run-gate.ts";

const MISSING_LINK: Loaded<string> = {
  ok: false,
  problem: "no discipline-core install at H:/missing",
  fix: "Check out Helen's fork main beside the main checkout.",
};

const ranChecks: CheckId[] = [];

const recordingCheck = (id: CheckId): GateCheck => ({
  id,
  run: async () => {
    ranChecks.push(id);
    return { id, status: "green", findings: [], note: "ran" };
  },
});

const services = (ready: Loaded<string>): GateServices => ({
  plans: { load: () => ({ ok: true, value: { hotFiles: [], contracts: [], lanes: [] } }) },
  repository: {
    resolve: () => undefined,
    changesSince: () => [],
    arrivals: () => [],
    readAt: () => undefined,
    listFiles: () => [],
  },
  workspace: { read: () => undefined, write: () => undefined, filesMatching: () => ["lint/x.ts"] },
  lock: { acquire: async () => ({ acquired: true }), release: () => undefined },
  progress: { started: () => undefined, finished: () => undefined, note: () => undefined },
  runner: { capture: () => ({ exitCode: 0, output: "" }), attach: () => 0 },
  goldens: {
    runner: { capture: () => ({ exitCode: 0, output: "" }), attach: () => 0 },
    source: { measure: () => ({}) },
    store: { read: () => ({}), write: () => undefined },
    build: { ensure: () => undefined },
  },
  checksFor: () => [recordingCheck("lint"), recordingCheck("ownership")],
  toolchain: { ready: () => ready },
});

const scopeRequest = (only: ScopeRequest["only"]): ScopeRequest => ({
  kind: "scope",
  target: "lint/x.ts",
  baseRef: "origin/rebuild/foundation",
  record: false,
  only,
});

describe("runGateRequest toolchain", () => {
  test("stops before lint when the discipline-core link cannot be made", async () => {
    ranChecks.length = 0;

    const report = await runGateRequest(services(MISSING_LINK), scopeRequest(["lint"]));

    expect(report.verdict).toBe("error");
    expect(report.problem).toEqual({
      problem: "no discipline-core install at H:/missing",
      fix: "Check out Helen's fork main beside the main checkout.",
    });
    expect(ranChecks).toEqual([]);
  });

  test("runs checks that never load the ESLint config without the link", async () => {
    ranChecks.length = 0;

    const report = await runGateRequest(services(MISSING_LINK), scopeRequest(["ownership"]));

    expect(report.verdict).toBe("green");
    expect(ranChecks).toEqual(["ownership"]);
  });
});
