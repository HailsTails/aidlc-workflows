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
  clock: { nowMs: () => 0 },
  runner: { capture: () => ({ exitCode: 0, output: "" }), captureAll: async () => [],
    attach: () => 0 },
  goldens: {
    runner: { capture: () => ({ exitCode: 0, output: "" }), captureAll: async () => [],
    attach: () => 0 },
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
  allTests: false,
  waitMs: 0,
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

const heavyCheck = (outcomes: string[]): GateCheck => ({
  id: "tests",
  run: async (scope) => {
    const slot = await scope.heavy.ensure();
    outcomes.push(slot.acquired ? "acquired" : "refused");
    return { id: "tests", status: "green", findings: [], note: "ran" };
  },
});

const lockedServices = (events: string[], granted: boolean): GateServices => ({
  ...services({ ok: true, value: "ready" }),
  lock: {
    acquire: async (request) => {
      events.push(`acquire ${request.command}`);
      return granted ? { acquired: true } : { acquired: false, reason: "no free slot" };
    },
    release: () => events.push("release"),
  },
  checksFor: () => [heavyCheck(events)],
});

describe("runGateRequest machine slot", () => {

  test("a scope run takes a slot for heavy work and gives it back afterwards", async () => {
    const events: string[] = [];

    await runGateRequest(lockedServices(events, true), scopeRequest(["tests"]));

    expect(events).toEqual(["acquire gate scope", "acquired", "release"]);
  });

  test("a scope run that never needs a slot never asks for one", async () => {
    const events: string[] = [];
    const lightServices = { ...lockedServices(events, true), checksFor: () => [] };

    await runGateRequest(lightServices, scopeRequest(["lint"]));

    expect(events).toEqual(["release"]);
  });

  test("red: a scope run is refused heavy work when no slot is free", async () => {
    const events: string[] = [];

    await runGateRequest(lockedServices(events, false), scopeRequest(["tests"]));

    expect(events).toContain("refused");
  });

  test("a full run does not ask for a second slot from inside", async () => {
    const events: string[] = [];
    const request = {
      kind: "full" as const,
      laneId: undefined,
      baseRef: "origin/rebuild/foundation",
      build: false,
      record: false,
      allTests: false,
      waitMs: 0,
      only: ["tests" as const],
    };

    const base = { ref: request.baseRef, commit: "abc" };
    const withBase = lockedServices(events, true);
    const repository = { ...withBase.repository, resolve: () => base };

    await runGateRequest({ ...withBase, repository }, request);

    expect(events).toEqual(["acquire gate full", "acquired", "release"]);
  });
});
