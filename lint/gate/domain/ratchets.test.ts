import { describe, expect, test } from "bun:test";
import { driftFinding, goldenDrift, goldenGroupOf } from "./golden.ts";
import { judgeKernelSurface } from "./kernel-surface.ts";
import { isStale, LOCK_MAX_AGE_MS, type LockOwner } from "./machine-lock.ts";
import { countLines, judgeMonolith, shrunkRecord } from "./monolith.ts";
import { categoryOf, increasesOver, withMeasured } from "./violation-ratchet.ts";

describe("violation ratchet", () => {
  test("restricted-rule findings are grouped by the category their message names", () => {
    const message =
      "'./aidlc-lib.ts' import is restricted from being used by a pattern. Monolith: move it";
    expect(categoryOf({ ruleId: "no-restricted-imports", message })).toBe("Monolith");
    const syntax = { ruleId: "no-restricted-syntax", message: "One owner: Stage belongs to x" };
    expect(categoryOf(syntax)).toBe("One owner");
    expect(categoryOf({ ruleId: "max-len", message: "This line: long" })).toBe("max-len");
    expect(categoryOf({ ruleId: null, message: "Parsing error" })).toBe("parse-error");
  });

  test("only a count above its record is an increase; new files start at zero", () => {
    const recorded = { "a.ts": { "max-len": 2 } };
    const measured = { "a.ts": { "max-len": 2 }, "b.ts": { "max-len": 1 } };
    expect(increasesOver({ recorded, measured })).toEqual([
      { file: "b.ts", category: "max-len", recorded: 0, measured: 1 },
    ]);
  });

  test("recording keeps unmeasured files, replaces measured ones and drops removed ones", () => {
    const recorded = { "a.ts": { x: 3 }, "b.ts": { x: 1 }, "c.ts": { x: 1 } };
    const measured = { "a.ts": { x: 2 }, "b.ts": {} };
    const next = withMeasured({ recorded, measured, removed: ["c.ts"] });
    expect(next).toEqual({ "a.ts": { x: 2 } });
  });
});

describe("monolith ratchet", () => {
  const recorded = { file: "lib.ts", declarations: ["a", "b"], lines: 10 };

  test("a new declaration and growth are both refused", () => {
    const measured = { file: "lib.ts", declarations: ["a", "b", "c"], lines: 11 };
    expect(judgeMonolith({ recorded, measured }).map((f) => f.violation)).toEqual([
      "is a new top-level declaration in a monolith",
      "grew from 10 to 11 lines",
    ]);
  });

  test("a shrunk monolith lowers its record", () => {
    const measured = { file: "lib.ts", declarations: ["a"], lines: 7 };
    expect(shrunkRecord({ recorded, measured })).toEqual({
      file: "lib.ts",
      declarations: ["a"],
      lines: 7,
    });
  });

  test("line counting ignores CRLF and the trailing newline", () => {
    expect(countLines("a\r\nb\n")).toBe(2);
  });
});

describe("kernel surface", () => {
  test("only names on the record may be exported from the kernel", () => {
    const measured = [
      { file: "src/kernel/result.ts", name: "Result" },
      { file: "src/kernel/shared.ts", name: "StageHelpers" },
    ];
    const findings = judgeKernelSurface({ recorded: ["Result"], measured });
    expect(findings.map((finding) => finding.subject)).toEqual([
      "src/kernel/shared.ts · StageHelpers",
    ]);
  });
});

describe("goldens", () => {
  const harnesses = ["claude", "codex"];

  test("outputs group by harness, including plugin trees", () => {
    expect(goldenGroupOf({ path: "dist/claude/.claude/x.md", harnesses })).toBe("claude");
    expect(goldenGroupOf({ path: "dist-release/codex/a", harnesses })).toBe("codex");
    expect(goldenGroupOf({ path: "dist/plugins/test-pro/codex/a", harnesses })).toBe("codex");
    expect(goldenGroupOf({ path: "dist/claude.staging/a", harnesses })).toBeUndefined();
    const marketplace = "dist/plugins/.claude-plugin/marketplace.json";
    expect(goldenGroupOf({ path: marketplace, harnesses })).toBe("plugin-marketplaces");
  });

  test("drift names each added, removed and changed path", () => {
    const expected = { claude: { a: "1", b: "2" } };
    const actual = { claude: { a: "1", b: "3", c: "4" } };
    expect(goldenDrift({ expected, actual })).toEqual([
      { group: "claude", path: "b", change: "changed" },
      { group: "claude", path: "c", change: "added" },
    ]);
  });
});

describe("machine lock staleness", () => {
  const owner: LockOwner = {
    pid: 42,
    host: "rin",
    lane: "A",
    command: "gate full",
    cwd: "H:/x",
    startedAt: 0,
  };

  test("a live holder on this host keeps the lock however long it runs", () => {
    expect(isStale({ owner, ageMs: 1000, ownerAlive: true, host: "rin" })).toBe(false);
    const longRun = { owner, ageMs: LOCK_MAX_AGE_MS * 3, ownerAlive: true, host: "rin" };
    expect(isStale(longRun)).toBe(false);
  });

  test("a dead holder on this host is stale at once", () => {
    expect(isStale({ owner, ageMs: 1000, ownerAlive: false, host: "rin" })).toBe(true);
  });

  test("a holder on another host is stale only after the maximum age", () => {
    const young = { owner, ageMs: 1000, ownerAlive: false, host: "ci" };
    expect(isStale(young)).toBe(false);
    expect(isStale({ ...young, ageMs: LOCK_MAX_AGE_MS + 1 })).toBe(true);
  });

  test("an unreadable owner gets a short grace before it is stale", () => {
    const unread = { owner: undefined, ageMs: 1000, ownerAlive: false, host: "rin" };
    expect(isStale(unread)).toBe(false);
    expect(isStale({ ...unread, ageMs: 61_000 })).toBe(true);
  });
});

describe("driftFinding", () => {
  const drift = { group: "claude", path: "dist/claude/a.md", change: "changed" } as const;

  test("sends the agent to the pinned output contract, never to updating the goldens", () => {
    const { fix } = driftFinding(drift);

    expect(fix).toContain("pinned output contract");
    expect(fix).not.toContain("bun scripts/gate.ts --update-goldens");
  });
});
