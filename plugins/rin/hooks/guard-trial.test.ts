import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import {
  builtInCoverageOf,
  COMMON_DIR_TOKEN_FILE,
  denyShadowEntry,
  guardIsRelaxed,
  PROJECT_DIR_VARIABLE,
  parseRelaxSet,
  RELAX_TOKEN_VARIABLE,
  recordDenyShadow,
  shadowLogPath,
} from "./guard-trial.ts";

const RELAXED_BOTH = "relax-inline-exec,navigation";

describe("parseRelaxSet admits only recognised guard names", () => {
  test("admits both relaxable guards from a comma-separated token", () => {
    const admitted = parseRelaxSet({ token: RELAXED_BOTH });
    expect(admitted.has("relax-inline-exec")).toBe(true);
    expect(admitted.has("navigation")).toBe(true);
  });

  test("tolerates surrounding whitespace around each name", () => {
    const admitted = parseRelaxSet({
      token: " navigation , relax-inline-exec",
    });
    expect(admitted.size).toBe(2);
  });

  test("an absent token admits nothing", () => {
    expect(parseRelaxSet({ token: undefined }).size).toBe(0);
  });

  test("an empty token admits nothing", () => {
    expect(parseRelaxSet({ token: "" }).size).toBe(0);
  });

  test("a malformed token admits nothing rather than widening the set", () => {
    expect(parseRelaxSet({ token: ",,,;garbage;," }).size).toBe(0);
  });

  // The blanket-kill shape the enumerative token exists to refuse.
  test("a truthy non-name token admits nothing", () => {
    expect(parseRelaxSet({ token: "1" }).size).toBe(0);
    expect(parseRelaxSet({ token: "true" }).size).toBe(0);
    expect(parseRelaxSet({ token: "all" }).size).toBe(0);
  });

  // The safety property stated as a test: no token value names a guard the
  // trial is not permitted to relax, so none can be admitted.
  test("no token can admit a safety-critical guard", () => {
    const admitted = parseRelaxSet({
      token:
        "guard-primary-commit,guard-vault-write,guard-github-writes,rin-gates-audit-guard,rin-gates-verdict-guard,guard-destructive-git",
    });
    expect(admitted.size).toBe(0);
  });

  test("an unrecognised name alongside a valid one admits only the valid one", () => {
    const admitted = parseRelaxSet({
      token: "guard-vault-write,navigation",
    });
    expect(admitted.has("navigation")).toBe(true);
    expect(admitted.size).toBe(1);
  });
});

describe("guardIsRelaxed reads the token from an injected environment", () => {
  test("reports relaxed when the token names that guard", () => {
    expect(
      guardIsRelaxed({
        guard: "navigation",
        environment: { [RELAX_TOKEN_VARIABLE]: RELAXED_BOTH },
      }),
    ).toBe(true);
  });

  test("reports enforcing when the token names only the other guard", () => {
    expect(
      guardIsRelaxed({
        guard: "navigation",
        environment: { [RELAX_TOKEN_VARIABLE]: "relax-inline-exec" },
      }),
    ).toBe(false);
  });

  test("reports enforcing when the variable is absent and no token is on disk", () => {
    const emptyRoot = mkdtempSync(join(tmpdir(), "guard-trial-empty-"));
    try {
      expect(
        guardIsRelaxed({
          guard: "relax-inline-exec",
          environment: { [PROJECT_DIR_VARIABLE]: emptyRoot },
        }),
      ).toBe(false);
    } finally {
      rmSync(emptyRoot, { recursive: true, force: true });
    }
  });

  test("falls back to the common-dir token when the variable is absent", () => {
    const seededRoot = mkdtempSync(join(tmpdir(), "guard-trial-seeded-"));
    try {
      mkdirSync(join(seededRoot, ".git"), { recursive: true });
      writeFileSync(
        join(seededRoot, ".git", COMMON_DIR_TOKEN_FILE),
        "relax-inline-exec",
        "utf8",
      );
      expect(
        guardIsRelaxed({
          guard: "relax-inline-exec",
          environment: { [PROJECT_DIR_VARIABLE]: seededRoot },
        }),
      ).toBe(true);
      expect(
        guardIsRelaxed({
          guard: "navigation",
          environment: { [PROJECT_DIR_VARIABLE]: seededRoot },
        }),
      ).toBe(false);
    } finally {
      rmSync(seededRoot, { recursive: true, force: true });
    }
  });
});

describe("denyShadowEntry records what the analysis needs", () => {
  test("carries the rule, command, spawn cwd and session", () => {
    const entry = denyShadowEntry({
      guard: "navigation",
      rule: "git-dash-c",
      command: "git -C /elsewhere status",
      environment: {
        ["CLAUDE_PROJECT_DIR"]: "/repo/root",
        ["CLAUDE_SESSION_ID"]: "session-abc",
      },
      nowIso: "2026-09-04T12:00:00.000Z",
    });
    expect(entry).toStrictEqual({
      at: "2026-09-04T12:00:00.000Z",
      guard: "navigation",
      rule: "git-dash-c",
      command: "git -C /elsewhere status",
      cwd: "/repo/root",
      session: "session-abc",
      builtInCoverage: "likely-covered",
    });
  });

  // Spawn cwd is what lets the analysis exclude subdir sessions, where no hook
  // loaded and silence therefore means nothing. An entry without it would let
  // that population average in invisibly.
  test("falls back to a readable session marker when the id is absent", () => {
    const entry = denyShadowEntry({
      guard: "navigation",
      rule: "cd-then-chain",
      command: "cd packages/kernel && pnpm test",
      environment: { ["CLAUDE_PROJECT_DIR"]: "/repo/root" },
      nowIso: "2026-09-04T12:00:00.000Z",
    });
    expect(entry.session).toBe("unknown");
    expect(entry.cwd).toBe("/repo/root");
  });
});

// The column that decides how much of guard-navigation's value the built-in
// already provides. A line the built-in also covers is evidence the repo rule is
// redundant; one it would not catch is that rule's residual value.
describe("builtInCoverageOf splits redundant shadows from residual ones", () => {
  test("git -C is likely covered — the built-in refuses it too", () => {
    expect(
      builtInCoverageOf({ guard: "navigation", command: "git -C /x status" }),
    ).toBe("likely-covered");
  });

  test("a chained git form is likely covered", () => {
    expect(
      builtInCoverageOf({
        guard: "navigation",
        command: "git status && git log",
      }),
    ).toBe("likely-covered");
  });

  // THE REGRESSION THIS CLASSIFIER SHIPPED WITH. The first version anchored at
  // `git` and scanned forward, so a chained command with git in the TAIL read as
  // not-covered and was credited to the repo rule as residual value. The bias
  // ran one way only — toward a wrong KEEP — on plausibly the highest-volume
  // navigation rule. Neither original case caught it: `cd … && pnpm test` is
  // correctly not-covered, `git status && git log` is correctly likely-covered,
  // and the defect lived precisely in their overlap.
  test("a cd chain with git in the TAIL is covered — git position must not matter", () => {
    expect(
      builtInCoverageOf({
        guard: "navigation",
        command: "cd /elsewhere && git status",
      }),
    ).toBe("likely-covered");
  });

  test("a cd chain with git after a semicolon is covered", () => {
    expect(
      builtInCoverageOf({
        guard: "navigation",
        command: "cd ../other-worktree; git log",
      }),
    ).toBe("likely-covered");
  });

  test("a piped git form is covered wherever git sits", () => {
    expect(
      builtInCoverageOf({
        guard: "navigation",
        command: "cat list.txt | git hash-object --stdin",
      }),
    ).toBe("likely-covered");
  });

  // The residual-value case: a plain cd the built-in has no opinion about.
  test("a bare cd chain is NOT covered — this is the rule's own value", () => {
    expect(
      builtInCoverageOf({
        guard: "navigation",
        command: "cd packages/kernel && pnpm test",
      }),
    ).toBe("not-covered");
  });

  test("cd into an absolute path is NOT covered", () => {
    expect(
      builtInCoverageOf({
        guard: "navigation",
        command: "cd H:\\Development\\rin",
      }),
    ).toBe("not-covered");
  });

  // The built-in guards worktree containment; it says nothing about inline
  // code, so the question is not applicable rather than answered "no".
  test("inline-exec shadows are not-applicable, never a false negative", () => {
    expect(
      builtInCoverageOf({
        guard: "relax-inline-exec",
        command: 'node -e "1"',
      }),
    ).toBe("not-applicable");
  });
});

describe("shadowLogPath resolves where the measurement lands", () => {
  test("prefers an explicitly configured log path", () => {
    expect(
      shadowLogPath({
        environment: { ["RIN_GUARD_TRIAL_LOG"]: "/tmp/explicit.jsonl" },
      }),
    ).toBe("/tmp/explicit.jsonl");
  });

  test("ignores a blank configured path and still resolves a log location", () => {
    const path = shadowLogPath({
      environment: {
        ["RIN_GUARD_TRIAL_LOG"]: "   ",
        ["CLAUDE_PROJECT_DIR"]: "/nowhere-that-is-a-repo",
      },
    });
    expect(path).toBe(
      join("/nowhere-that-is-a-repo", ".claude", "guard-trial-shadow.jsonl"),
    );
  });

  // The regression. A hook spawned from `.claude/hooks/` has THAT as its cwd, so
  // the old project-dir fallback wrote the log to
  // `.claude/hooks/.claude/guard-trial-shadow.jsonl` — INSIDE the composed tree,
  // which made harness:refresh-check report a diverging composed copy and refuse
  // pushes repo-wide. The log is per-clone runtime and must never land under a
  // projected plugin path.
  test("NEVER resolves inside the composed hooks tree", () => {
    const path = shadowLogPath({
      environment: { ["CLAUDE_PROJECT_DIR"]: process.cwd() },
    });
    expect(path).not.toContain(join(".claude", "hooks"));
  });

  test("resolves into the git directory, which is untracked by construction", () => {
    const path = shadowLogPath({
      environment: { ["CLAUDE_PROJECT_DIR"]: process.cwd() },
    });
    expect(path).toContain(".git");
    expect(path).toContain("rin-guard-trial-shadow.jsonl");
  });

  test("an explicit path still wins over the git-directory resolution", () => {
    expect(
      shadowLogPath({
        environment: {
          ["RIN_GUARD_TRIAL_LOG"]: "/tmp/pinned.jsonl",
          ["CLAUDE_PROJECT_DIR"]: process.cwd(),
        },
      }),
    ).toBe("/tmp/pinned.jsonl");
  });
});

describe("recordDenyShadow appends one JSON line per shadowed deny", () => {
  let logDirectory = "";

  beforeEach(() => {
    logDirectory = mkdtempSync(join(tmpdir(), "guard-trial-"));
  });

  afterEach(() => {
    rmSync(logDirectory, { recursive: true, force: true });
  });

  test("writes a parseable entry and appends rather than overwrites", () => {
    const logPath = join(logDirectory, "shadow.jsonl");
    const environment = {
      ["RIN_GUARD_TRIAL_LOG"]: logPath,
      ["CLAUDE_PROJECT_DIR"]: "/repo/root",
      ["CLAUDE_SESSION_ID"]: "session-abc",
    };
    recordDenyShadow({
      guard: "navigation",
      rule: "git-dash-c",
      command: "git -C /elsewhere status",
      environment,
      nowIso: "2026-09-04T12:00:00.000Z",
    });
    recordDenyShadow({
      guard: "relax-inline-exec",
      rule: "arbitrary-execution",
      command: 'node -e "1"',
      environment,
      nowIso: "2026-09-04T12:00:01.000Z",
    });
    const lines = readFileSync(logPath, "utf8").trimEnd().split("\n");
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0] ?? "").rule).toBe("git-dash-c");
    expect(JSON.parse(lines[1] ?? "").guard).toBe("relax-inline-exec");
  });

  // A trial is an observation, never a gate: an unwritable log must not turn an
  // allowed command into a failure.
  test("an unwritable log path does not throw", () => {
    expect(() =>
      recordDenyShadow({
        guard: "navigation",
        rule: "git-dash-c",
        command: "git -C /elsewhere status",
        environment: { ["RIN_GUARD_TRIAL_LOG"]: join(logDirectory, "\0bad") },
        nowIso: "2026-09-04T12:00:00.000Z",
      }),
    ).not.toThrow();
  });
});
