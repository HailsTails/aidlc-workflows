import { describe, expect, test } from "bun:test";
import type { BaseRevision, ChangedFile } from "../domain/change.ts";
import type { CountsByFile } from "../domain/violation-ratchet.ts";
import type { GateScope } from "./gate-scope.ts";
import type { DisciplineSelection, RatchetRecords, Repository } from "./ports.ts";
import { recordsCheck } from "./records-check.ts";
import { zonesCheck } from "./zones-check.ts";

const BASE: BaseRevision = { ref: "foundation", commit: "base" };
const ARRIVED = "tests/unit/arrived.test.ts";
const LANE_MODULE = "tests/unit/lane.test.ts";

const repositoryWith = (arrivals: readonly string[]): Repository => ({
  resolve: () => BASE,
  changesSince: () => [],
  arrivals: () => arrivals,
  readAt: () => undefined,
  listFiles: () => [],
});

const scopeWith = (changes: readonly ChangedFile[]): GateScope => ({
  lane: undefined,
  base: BASE,
  changes,
  everything: false,
  build: false,
  record: false,
  heavy: { ensure: async () => ({ acquired: true }) },
});

const selection: DisciplineSelection = {
  excludes: () => [],
  saveExcludes: () => undefined,
  exceptions: () => ({ ok: true, value: [] }),
};

const recordsWith = (request: {
  readonly base: CountsByFile;
  readonly head: CountsByFile;
}): RatchetRecords => ({
  globs: [],
  monolithFiles: [],
  boundary: (source) => (source.kind === "head" ? request.head : request.base),
  monolith: () => undefined,
  saveBoundary: () => undefined,
  saveMonoliths: () => undefined,
});

const added = (path: string): ChangedFile => ({ path, kind: "added" });

describe("zones admit an arrival and refuse lane-authored debt", () => {
  const run = async (arrivals: readonly string[]) => {
    const check = zonesCheck({
      repository: repositoryWith(arrivals),
      selection,
      records: recordsWith({ base: {}, head: {} }),
    });
    const outcome = await check.run(scopeWith([added(ARRIVED), added(LANE_MODULE)]));
    return outcome.findings.map((finding) => finding.subject);
  };

  test("green: a byte-identical arrival passes", async () => {
    expect(await run([ARRIVED])).not.toContain(ARRIVED);
  });

  test("red: a lane-authored new debt module is still refused", async () => {
    expect(await run([ARRIVED])).toContain(LANE_MODULE);
  });

  test("red: with no arrival recorded the same file is refused", async () => {
    expect(await run([])).toContain(ARRIVED);
  });
});

describe("records admit a raise only on an arrival", () => {
  const base: CountsByFile = { "core/a.ts": { "max-len": 1 }, "core/b.ts": { "max-len": 1 } };
  const head: CountsByFile = { "core/a.ts": { "max-len": 3 }, "core/b.ts": { "max-len": 3 } };

  const run = async (arrivals: readonly string[]) => {
    const check = recordsCheck({
      repository: repositoryWith(arrivals),
      records: recordsWith({ base, head }),
      ruleInputs: [],
    });
    const outcome = await check.run(scopeWith([]));
    return outcome.findings.map((finding) => finding.subject);
  };

  test("green: a raise on an arrived file passes", async () => {
    const subjects = await run(["core/a.ts"]);
    expect(subjects.some((subject) => subject.includes("core/a.ts"))).toBe(false);
  });

  test("red: a raise on a file that did not arrive is still refused", async () => {
    const subjects = await run(["core/a.ts"]);
    expect(subjects.some((subject) => subject.includes("core/b.ts"))).toBe(true);
  });
});
