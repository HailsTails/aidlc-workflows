import type { SweepTree } from "./sweep-run.ts";
import { CHECK_IDS } from "../domain/outcome.ts";
import type { FullRequest } from "./gate-request.ts";
import type { SweepEntry } from "../domain/sweep.ts";
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

const SWEEP: FullRequest = {
  kind: "full", laneId: undefined, baseRef: "origin/rebuild/foundation", build: true,
  record: false, allTests: false, waitMs: 0, only: "all", sweep: true,
};
const FOUNDATION = "abcdef0123456789";
const GREEN_SWEEP: SweepEntry = {
  commit: FOUNDATION, result: "green", finishedAt: 10, durationMs: 5,
};
const RED_SWEEP: SweepEntry = { ...GREEN_SWEEP, result: "red" };

const CLEAN_TREE = { head: FOUNDATION, foundation: FOUNDATION, clean: true };
const sweepFixture = (entry?: SweepEntry, tree: () => SweepTree = () => CLEAN_TREE) => {
  const entries = new Map<string, SweepEntry>(entry === undefined ? [] : [[entry.commit, entry]]);
  const weights: number[] = [];
  const allTests: boolean[] = [];
  const base = { ref: SWEEP.baseRef, commit: FOUNDATION };
  const original = services({ ok: true, value: "ready" });
  const configured: GateServices = {
    ...original,
    repository: { ...original.repository, resolve: () => base },
    lock: {
      acquire: async (request) => { weights.push(request.slots ?? 1); return { acquired: true }; },
      release: () => undefined,
    },
    checksFor: () => CHECK_IDS.map((id) => ({
      id,
      run: async (scope) => {
        allTests.push(scope.allTests);
        return { id, status: "green", findings: [], note: "fixture" };
      },
    })),
    sweeps: {
      tree,
      ledger: {
        find: (commit) => entries.get(commit),
        record: (value) => entries.set(value.commit, value),
      },
      slots: 3,
    },
  };
  return { services: configured, entries, weights, allTests };
};

describe("foundation sweeps", () => {
  test("a sweep holds every slot, forces every test and caches its exact SHA", async () => {
    const fixture = sweepFixture();
    const first = await runGateRequest(fixture.services, SWEEP);
    const second = await runGateRequest(fixture.services, SWEEP);
    expect(first.verdict).toBe("green");
    expect(first.sweepCached).toBe(false);
    expect(second.sweepCached).toBe(true);
    expect(second.outcomes).toEqual([]);
    expect(fixture.weights).toEqual([3, 3]);
    expect(fixture.allTests).toEqual([
      true, true, true, true, true, true, true, true, true, true, true,
    ]);
    expect(fixture.entries.get(FOUNDATION)?.result).toBe("green");
  });

  test("a red sweep is reused, not retried into green", async () => {
    const fixture = sweepFixture(RED_SWEEP);
    const report = await runGateRequest(fixture.services, SWEEP);
    expect(report.verdict).toBe("red");
    expect(report.sweepCached).toBe(true);
    expect(fixture.allTests).toEqual([]);
  });

  test("partial checks cannot create full sweep evidence", async () => {
    const fixture = sweepFixture();
    const report = await runGateRequest(fixture.services, { ...SWEEP, only: ["tests"] });
    expect(report.verdict).toBe("red");
    expect(fixture.entries.size).toBe(0);
    expect(fixture.allTests).toEqual([]);
  });

  test("a partial execution stays red even if every executed check passed", async () => {
    const fixture = sweepFixture();
    const configured = { ...fixture.services, checksFor: () => [recordingCheck("tests")] };
    const report = await runGateRequest(configured, SWEEP);
    expect(report.verdict).toBe("red");
    expect(fixture.entries.get(FOUNDATION)?.result).toBe("red");
  });

  test("a thrown sweep leaves a blocking red record", async () => {
    const fixture = sweepFixture();
    const configured = {
      ...fixture.services, checksFor: (): GateCheck[] => { throw new Error("stop"); },
    };
    await expect(runGateRequest(configured, SWEEP)).rejects.toThrow("stop");
    expect(fixture.entries.get(FOUNDATION)?.result).toBe("red");
  });

});

describe("candidate sweep reliance", () => {
  test("candidate checks qualify while missing runtime evidence remains explicit", async () => {
    const fixture = sweepFixture();
    const report = await runGateRequest(fixture.services, { ...SWEEP, sweep: false });
    expect(report.verdict).toBe("green");
    expect(report.sweep).toEqual({ commit: FOUNDATION, state: "none" });
    expect(fixture.entries.size).toBe(0);
  });

  test("a candidate names its green foundation sweep", async () => {
    const fixture = sweepFixture(GREEN_SWEEP);
    const report = await runGateRequest(fixture.services, { ...SWEEP, sweep: false });
    expect(report.verdict).toBe("green");
    expect(report.sweep).toEqual({ commit: FOUNDATION, state: "green" });
  });

  test("cheap-only checks remain usable on a red foundation", async () => {
    const fixture = sweepFixture(RED_SWEEP);
    const report = await runGateRequest(fixture.services, {
      ...SWEEP, sweep: false, only: ["ownership"],
    });
    expect(report.verdict).toBe("green");
    expect(report.sweep).toBeUndefined();
  });
});
describe("sweep identity", () => {
  test("dirty foundation cannot create evidence", async () => {
    const fixture = sweepFixture(undefined, () => ({ ...CLEAN_TREE, clean: false }));
    const report = await runGateRequest(fixture.services, SWEEP);
    expect(report.verdict).toBe("red");
    expect(fixture.entries.size).toBe(0);
  });
  test("a clean candidate cannot impersonate its foundation", async () => {
    const fixture = sweepFixture(undefined, () => ({ ...CLEAN_TREE, head: "other" }));
    const report = await runGateRequest(fixture.services, SWEEP);
    expect(report.verdict).toBe("red");
    expect(fixture.entries.size).toBe(0);
  });
  test("a green old sweep is reported as superseded, not current runtime proof", async () => {
    const fixture = sweepFixture(GREEN_SWEEP, () => ({ ...CLEAN_TREE, foundation: "new" }));
    const report = await runGateRequest(fixture.services, { ...SWEEP, sweep: false });
    expect(report.verdict).toBe("green");
    expect(report.sweep).toEqual({
      commit: FOUNDATION, state: "superseded", currentFoundation: "new",
    });
  });
});
const changingTree = (): (() => SweepTree) => {
  let observed = false;
  return () => {
    const clean = !observed;
    observed = true;
    return { ...CLEAN_TREE, clean };
  };
};

test("source changed during a passing sweep leaves red evidence", async () => {
  const fixture = sweepFixture(undefined, changingTree());
  const report = await runGateRequest(fixture.services, SWEEP);
  expect(report.verdict).toBe("red");
  expect(fixture.entries.get(FOUNDATION)?.result).toBe("red");
});

describe("pending sweep is not a red sweep", () => {
  test("in-flight evidence does not block passing candidate checks", async () => {
    const fixture = sweepFixture({ ...GREEN_SWEEP, result: "pending", finishedAt: 0 });
    const report = await runGateRequest(fixture.services, { ...SWEEP, sweep: false });
    expect(report.verdict).toBe("green");
    expect(report.sweep?.state).toBe("pending");
  });
  test("an actual recorded failure blocks candidate qualification", async () => {
    const report = await runGateRequest(sweepFixture(RED_SWEEP).services, {
      ...SWEEP, sweep: false,
    });
    expect(report.verdict).toBe("red");
    expect(report.sweep?.state).toBe("red");
  });
  test("a red current foundation blocks an older-base candidate", async () => {
    const fixture = sweepFixture(GREEN_SWEEP, () => ({ ...CLEAN_TREE, foundation: "new" }));
    fixture.entries.set("new", { ...RED_SWEEP, commit: "new" });
    const report = await runGateRequest(fixture.services, { ...SWEEP, sweep: false });
    expect(report.verdict).toBe("red");
    expect(report.sweep?.state).toBe("superseded");
  });
});
