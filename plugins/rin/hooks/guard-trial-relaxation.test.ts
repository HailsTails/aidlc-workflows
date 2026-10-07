// Both faces of the trial switch, exercised against the LIVE hook processes.
//
// guard-trial.test.ts covers the shared module in isolation. This file proves
// the wiring: that the real hooks read the token, that a relaxed guard both
// allows AND logs, and — the half that matters more — that every other token
// state still denies. A relaxation that silently failed closed would look
// identical to a quiet trial in the log, which is exactly the inert-switch
// hazard the whole-chain probe exists to catch.

import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import {
  LOG_PATH_VARIABLE,
  RELAX_TOKEN_VARIABLE,
  SHADOW_LOG_RUNTIME_FILE,
} from "./guard-trial.ts";
import { invokeBashHook } from "./run-hook-process.ts";

const NAVIGATION_HOOK = "guard-navigation.mjs";
const INLINE_EXEC_HOOK = "block-inline-exec.ts";

const NAVIGATION_BREACH = "git -C /elsewhere status";
const INLINE_EXEC_BREACH = 'node -e "console.log(1)"';
const RECLONE_BREACH = "git clone https://example.invalid/rin.git";

const DENIED = 2;
const ALLOWED = 0;

let logDirectory = "";

// Computed keys: these are the harness's wire-level variable names, not our
// vocabulary, so they are spelled once via the exported constants rather than
// re-typed as camelCase-violating literals at each call site.
const trialEnvironment = ({
  token,
}: {
  readonly token: string;
}): Readonly<Record<string, string>> => ({
  [RELAX_TOKEN_VARIABLE]: token,
  [LOG_PATH_VARIABLE]: join(logDirectory, "shadow.jsonl"),
  ["CLAUDE_PROJECT_DIR"]: "/repo/root",
  ["CLAUDE_SESSION_ID"]: "session-under-test",
});

// An absent log file IS the zero-lines case: nothing was shadowed, so nothing
// created it. Treating that as an error would fail every enforcing-path test.
const shadowLines = (): readonly string[] => {
  const path = join(logDirectory, "shadow.jsonl");
  if (!existsSync(path)) return [];
  const raw = readFileSync(path, "utf8").trimEnd();
  return raw === "" ? [] : raw.split("\n");
};

beforeEach(() => {
  logDirectory = mkdtempSync(join(tmpdir(), "guard-trial-live-"));
});

afterEach(() => {
  rmSync(logDirectory, { recursive: true, force: true });
});

describe("guard-navigation under the trial token", () => {
  test("relaxed: allows the breach AND writes one deny-shadow line", async () => {
    const outcome = await invokeBashHook({
      hookFileName: NAVIGATION_HOOK,
      command: NAVIGATION_BREACH,
      runtime: "node",
      environmentAdditions: trialEnvironment({ token: "navigation" }),
    });
    expect(outcome.exitCode).toBe(ALLOWED);
    const lines = shadowLines();
    expect(lines).toHaveLength(1);
    const entry = JSON.parse(lines[0] ?? "");
    expect(entry.guard).toBe("navigation");
    expect(entry.rule).toBe("git-dash-c");
    expect(entry.command).toBe(NAVIGATION_BREACH);
    expect(entry.cwd).toBe("/repo/root");
    // git -C is territory Claude Code's own worktree isolation also refuses, so
    // this shadow is evidence the repo rule is redundant rather than load-bearing.
    expect(entry.builtInCoverage).toBe("likely-covered");
  });

  // The regression case, on the SHIPPED hook rather than the module: a cd chain
  // with git in the tail must read as covered. An earlier classifier anchored at
  // `git` and scanned forward, biasing this shape toward a wrong KEEP.
  test("relaxed: a cd chain with git in the tail is logged as COVERED", async () => {
    await invokeBashHook({
      hookFileName: NAVIGATION_HOOK,
      command: "cd /elsewhere && git status",
      runtime: "node",
      environmentAdditions: trialEnvironment({ token: "navigation" }),
    });
    const entry = JSON.parse(shadowLines()[0] ?? "");
    expect(entry.rule).toBe("cd-then-chain");
    expect(entry.builtInCoverage).toBe("likely-covered");
  });

  // The complement, from the live hook: a bare cd is the rule's residual value,
  // because the built-in has no opinion about it. The two cases together are
  // what make the end-of-trial keep/drop call decidable.
  test("relaxed: a bare cd chain is logged as NOT covered by the built-in", async () => {
    await invokeBashHook({
      hookFileName: NAVIGATION_HOOK,
      command: "cd packages/kernel && pnpm test",
      runtime: "node",
      environmentAdditions: trialEnvironment({ token: "navigation" }),
    });
    const entry = JSON.parse(shadowLines()[0] ?? "");
    expect(entry.rule).toBe("cd-then-chain");
    expect(entry.builtInCoverage).toBe("not-covered");
  });

  // The absent-token case must be CONSTRUCTED, never inherited. Omitting
  // environmentAdditions passes no env at all, so the hook inherits the runner's
  // — and once the trial is genuinely activated the runner carries the token,
  // which inverts this assertion in exactly the configuration the property
  // matters most. Measured 2026-09-05 (capture 01a0719d): activating the trial
  // turned this test and its inline-exec twin red, and clearing the variable
  // turned them green. Pinning the token to empty makes the test hermetic; the
  // safety property it asserts is unchanged.
  test("absent token: still denies", async () => {
    const outcome = await invokeBashHook({
      hookFileName: NAVIGATION_HOOK,
      command: NAVIGATION_BREACH,
      runtime: "node",
      environmentAdditions: trialEnvironment({ token: "" }),
    });
    expect(outcome.exitCode).toBe(DENIED);
  });

  test("absent token: denies AND writes no shadow line", async () => {
    await invokeBashHook({
      hookFileName: NAVIGATION_HOOK,
      command: NAVIGATION_BREACH,
      runtime: "node",
      environmentAdditions: trialEnvironment({ token: "" }),
    });
    expect(shadowLines()).toHaveLength(0);
  });

  test("malformed token: still denies, and logs nothing", async () => {
    const outcome = await invokeBashHook({
      hookFileName: NAVIGATION_HOOK,
      command: NAVIGATION_BREACH,
      runtime: "node",
      environmentAdditions: trialEnvironment({ token: ",,garbage,," }),
    });
    expect(outcome.exitCode).toBe(DENIED);
    expect(shadowLines()).toHaveLength(0);
  });

  test("blanket-kill token shape: still denies", async () => {
    const outcome = await invokeBashHook({
      hookFileName: NAVIGATION_HOOK,
      command: NAVIGATION_BREACH,
      runtime: "node",
      environmentAdditions: trialEnvironment({ token: "1" }),
    });
    expect(outcome.exitCode).toBe(DENIED);
  });

  test("token naming only the OTHER guard: still denies", async () => {
    const outcome = await invokeBashHook({
      hookFileName: NAVIGATION_HOOK,
      command: NAVIGATION_BREACH,
      runtime: "node",
      environmentAdditions: trialEnvironment({ token: "relax-inline-exec" }),
    });
    expect(outcome.exitCode).toBe(DENIED);
  });

  // Rule 4 is RETAINED under the trial (rin-requirements 3.2): re-cloning is a
  // higher-blast-radius failure than the friction being measured.
  test("relaxed: the retained re-clone rule STILL denies", async () => {
    const outcome = await invokeBashHook({
      hookFileName: NAVIGATION_HOOK,
      command: RECLONE_BREACH,
      runtime: "node",
      environmentAdditions: trialEnvironment({ token: "navigation" }),
    });
    expect(outcome.exitCode).toBe(DENIED);
    expect(shadowLines()).toHaveLength(0);
  });

  test("relaxed: a clean command is untouched and logs nothing", async () => {
    const outcome = await invokeBashHook({
      hookFileName: NAVIGATION_HOOK,
      command: "pnpm test",
      runtime: "node",
      environmentAdditions: trialEnvironment({ token: "navigation" }),
    });
    expect(outcome.exitCode).toBe(ALLOWED);
    expect(shadowLines()).toHaveLength(0);
  });
});

// THE PATH-RESOLUTION PARITY GAP, closed. Every case above pins
// LOG_PATH_VARIABLE, so the env-override branch was the only one either live
// hook ever exercised -- and the FALLBACK is what broke. guard-trial.ts was
// fixed to resolve through the git common dir while both hooks kept their
// inlined cwd-rooted copy, and no test could see the divergence: the shared
// module's own suite tests the module, and this file overrode the branch.
//
// These cases run the real hooks with NO configured log path, which is the
// production configuration, and assert the property that actually matters --
// the log never lands inside the composed tree. Asserting the absence of
// `.claude/hooks` rather than an exact path keeps them true on any checkout.
// A faked git directory, not a spawned `git init`: the resolver's whole input is
// a `.git` directory's existence, so a real git process would add runtime cost
// and a subsystem dependency for no additional fidelity (CD-47 -- the test fakes
// what it can fake). The production shape is a git checkout, which is the branch
// these cases exist to reach.
//
// The BLANK log path is load-bearing, not noise. run-hook-process pins every
// spawn's RIN_GUARD_TRIAL_LOG to a temp sink so fixture denials never reach the
// real corpus; that pin would otherwise short-circuit the very fallback these
// cases exist to exercise. Blank reads as unset in all three resolvers, so the
// hook takes the git-dir walk against the constructed checkout.
describe("the live hooks resolve the log outside the composed tree", () => {
  const gitCheckout = (): string => {
    const root = join(logDirectory, "checkout");
    mkdirSync(join(root, ".git"), { recursive: true });
    mkdirSync(join(root, ".claude", "hooks"), { recursive: true });
    return root;
  };

  test("guard-navigation logs into the git directory, never the composed tree", async () => {
    const root = gitCheckout();
    await invokeBashHook({
      hookFileName: NAVIGATION_HOOK,
      command: NAVIGATION_BREACH,
      runtime: "node",
      environmentAdditions: {
        [RELAX_TOKEN_VARIABLE]: "navigation",
        ["CLAUDE_PROJECT_DIR"]: root,
        [LOG_PATH_VARIABLE]: "",
      },
    });
    expect(existsSync(join(root, ".git", SHADOW_LOG_RUNTIME_FILE))).toBe(true);
    expect(existsSync(join(root, ".claude", "hooks", ".claude"))).toBe(false);
  });

  test("block-inline-exec logs into the git directory, never the composed tree", async () => {
    const root = gitCheckout();
    await invokeBashHook({
      hookFileName: INLINE_EXEC_HOOK,
      command: INLINE_EXEC_BREACH,
      runtime: "bun",
      environmentAdditions: {
        [RELAX_TOKEN_VARIABLE]: "relax-inline-exec",
        ["CLAUDE_PROJECT_DIR"]: root,
        [LOG_PATH_VARIABLE]: "",
      },
    });
    expect(existsSync(join(root, ".git", SHADOW_LOG_RUNTIME_FILE))).toBe(true);
    expect(existsSync(join(root, ".claude", "hooks", ".claude"))).toBe(false);
  });
});

describe("block-inline-exec under the trial token", () => {
  test("relaxed: allows the breach AND writes one deny-shadow line", async () => {
    const outcome = await invokeBashHook({
      hookFileName: INLINE_EXEC_HOOK,
      command: INLINE_EXEC_BREACH,
      runtime: "bun",
      environmentAdditions: trialEnvironment({ token: "relax-inline-exec" }),
    });
    expect(outcome.exitCode).toBe(ALLOWED);
    const lines = shadowLines();
    expect(lines).toHaveLength(1);
    const entry = JSON.parse(lines[0] ?? "");
    expect(entry.guard).toBe("relax-inline-exec");
    expect(entry.rule).toBe("arbitrary-execution");
    expect(entry.command).toBe(INLINE_EXEC_BREACH);
  });

  test("relaxed: a pipe-fed interpreter logs its own rule name", async () => {
    const outcome = await invokeBashHook({
      hookFileName: INLINE_EXEC_HOOK,
      command: "cat payload.txt | python3",
      runtime: "bun",
      environmentAdditions: trialEnvironment({ token: "relax-inline-exec" }),
    });
    expect(outcome.exitCode).toBe(ALLOWED);
    const entry = JSON.parse(shadowLines()[0] ?? "");
    expect(entry.rule).toBe("pipe-into-interpreter");
  });

  // Constructed, not inherited — see the navigation twin above (capture 01a0719d).
  test("absent token: still denies", async () => {
    const outcome = await invokeBashHook({
      hookFileName: INLINE_EXEC_HOOK,
      command: INLINE_EXEC_BREACH,
      runtime: "bun",
      environmentAdditions: trialEnvironment({ token: "" }),
    });
    expect(outcome.exitCode).toBe(ALLOWED);
    expect(outcome.stdout).toContain("deny");
  });

  test("absent token: denies AND writes no shadow line", async () => {
    await invokeBashHook({
      hookFileName: INLINE_EXEC_HOOK,
      command: INLINE_EXEC_BREACH,
      runtime: "bun",
      environmentAdditions: trialEnvironment({ token: "" }),
    });
    expect(shadowLines()).toHaveLength(0);
  });

  test("malformed token: still denies, and logs nothing", async () => {
    const outcome = await invokeBashHook({
      hookFileName: INLINE_EXEC_HOOK,
      command: INLINE_EXEC_BREACH,
      runtime: "bun",
      environmentAdditions: trialEnvironment({ token: ",,garbage,," }),
    });
    expect(outcome.stdout).toContain("deny");
    expect(shadowLines()).toHaveLength(0);
  });

  test("token naming only the OTHER guard: still denies", async () => {
    const outcome = await invokeBashHook({
      hookFileName: INLINE_EXEC_HOOK,
      command: INLINE_EXEC_BREACH,
      runtime: "bun",
      environmentAdditions: trialEnvironment({ token: "navigation" }),
    });
    expect(outcome.stdout).toContain("deny");
  });

  test("relaxed: a clean command is untouched and logs nothing", async () => {
    const outcome = await invokeBashHook({
      hookFileName: INLINE_EXEC_HOOK,
      command: "pnpm run typecheck",
      runtime: "bun",
      environmentAdditions: trialEnvironment({ token: "relax-inline-exec" }),
    });
    expect(outcome.exitCode).toBe(ALLOWED);
    expect(shadowLines()).toHaveLength(0);
  });
});
