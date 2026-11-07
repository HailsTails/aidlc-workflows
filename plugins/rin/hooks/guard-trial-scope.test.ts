// The negative assertion that makes the trial's safety claim STRUCTURAL.
//
// rin-requirements 5.1 claims the six kept-on guards cannot be disabled by any
// value of RIN_GUARD_TRIAL, because they never read it. That is only true while
// it stays true: a later edit adding the token to one of those hooks would
// silently convert a mechanism back into a promise, and every other test in the
// suite would still pass.
//
// So this asserts ABSENCE across the tree rather than behaviour at one call
// site. It is the single test defending the property against drift.

import { existsSync, mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import {
  LOG_PATH_VARIABLE,
  RELAX_TOKEN_VARIABLE,
  SHADOW_LOG_RUNTIME_FILE,
  shadowLogPath,
} from "./guard-trial.ts";
import { invokeBashHook, scrubbedHookEnv } from "./run-hook-process.ts";

const hooksDirectory = dirname(fileURLToPath(import.meta.url));

// The fixture command the relaxed deny logs. Named so the content assertion
// binds to the exact spawn under test rather than to any line in the sink.
const FIXTURE_RELAXED_COMMAND = "git -C /elsewhere status";

// Resolved by the writers' own function so the ratchet watches the SAME file a
// leaking spawn would append to, rather than a second spelling of the path.
const gitCommonDirectory = dirname(
  shadowLogPath({ environment: { ["CLAUDE_PROJECT_DIR"]: hooksDirectory } }),
);

// The only files permitted to mention the token: the shared module, the two
// relaxed guards, and the tests that exercise them.
//
// `run-hook-process.ts` is the one entry that is NOT a token reader. It is the
// test harness, and it names the token only to SCRUB it from a spawned hook's
// environment — the opposite purpose. Admitted because a hook test must
// construct the rail state it asserts rather than inherit the runner's, and
// naming the variable is the only way to strip it. Measured 2026-09-05 (capture
// 01a0719d): with the trial active and no scrub, 46 tests across three files
// asserted the opposite of what they were written to assert.
//
// The distinction this list must preserve is READS-TO-RELAX versus
// STRIPS-TO-ISOLATE. A future entry that reads the token to change behaviour is
// a real widening of the trial and does not belong here.
const PERMITTED_TOKEN_READERS: readonly string[] = [
  "guard-trial.ts",
  "guard-navigation.mjs",
  "block-inline-exec.ts",
  "guard-trial.test.ts",
  "guard-trial-relaxation.test.ts",
  "guard-trial-scope.test.ts",
  "run-hook-process.ts",
];

// Named explicitly rather than derived, so that deleting a guard file cannot
// quietly shrink what this test checks.
// All six named in rin-requirements section 4 as kept-on, plus two adjacent
// rails. The tree-wide absence test above already governs every file in this
// directory, so these are covered either way — they are named explicitly so a
// failure reports the SAFETY PROPERTY by name rather than as an opaque list
// diff, and so a reader can see the requirements' six reflected one-to-one.
const GUARDS_THAT_MUST_NEVER_READ_THE_TOKEN: readonly string[] = [
  "guard-primary-commit.mjs",
  "guard-vault-write.ts",
  "guard-github-writes.mjs",
  "guard-destructive-git.mjs",
  "rin-gates-audit-guard.ts",
  "rin-gates-verdict-guard.ts",
  "guard-shell-syntax.mjs",
  "guard-unbounded-scan.mjs",
];

const hookSourceFileNames = (): readonly string[] =>
  readdirSync(hooksDirectory, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => name.endsWith(".ts") || name.endsWith(".mjs"));

// Matches the token by name OR by the shared module's accessor. Checking only
// the literal string would let a guard reach the switch through the import and
// pass this test — the exact evasion the property must not permit.
const mentionsToken = ({
  fileName,
}: {
  readonly fileName: string;
}): boolean => {
  const source = readFileSync(join(hooksDirectory, fileName), "utf8");
  return (
    source.includes(RELAX_TOKEN_VARIABLE) ||
    source.includes("guardIsRelaxed") ||
    source.includes("guard-trial.ts")
  );
};

describe("the relax token reaches only the guards the trial may relax", () => {
  test("no hook source outside the permitted set mentions the token", () => {
    const unexpected = hookSourceFileNames()
      .filter((fileName) => !PERMITTED_TOKEN_READERS.includes(fileName))
      .filter((fileName) => mentionsToken({ fileName }));
    expect(unexpected).toStrictEqual([]);
  });

  // Stated as its own case so a failure names the safety property directly
  // rather than surfacing as an opaque list diff.
  test("no safety-critical guard reads the token", () => {
    const compromised = GUARDS_THAT_MUST_NEVER_READ_THE_TOKEN.filter(
      (fileName) => mentionsToken({ fileName }),
    );
    expect(compromised).toStrictEqual([]);
  });

  // Guards against the list rotting into a no-op: if a named guard is renamed
  // or removed, the absence check above would pass vacuously.
  test("every guard named in the must-never list still exists", () => {
    const present = hookSourceFileNames();
    const missing = GUARDS_THAT_MUST_NEVER_READ_THE_TOKEN.filter(
      (fileName) => !present.includes(fileName),
    );
    expect(missing).toStrictEqual([]);
  });

  // Consults the token by ANY means — guard-navigation.mjs cannot import the
  // shared TS module so it names the variable directly, while block-inline-exec
  // imports guardIsRelaxed. Asserting the literal string in both would pass for
  // the wrong reason on one and fail on the other; what matters is that each
  // reaches the trial switch.
  test("the two relaxed guards DO consult the trial switch", () => {
    const consultsSwitch = ({
      fileName,
    }: {
      readonly fileName: string;
    }): boolean => {
      const source = readFileSync(join(hooksDirectory, fileName), "utf8");
      return (
        source.includes(RELAX_TOKEN_VARIABLE) ||
        source.includes("guardIsRelaxed")
      );
    };
    expect(consultsSwitch({ fileName: "guard-navigation.mjs" })).toBe(true);
    expect(consultsSwitch({ fileName: "block-inline-exec.ts" })).toBe(true);
  });
});

// The ratchet that closes the class rather than the instance. The 46-test
// inversion happened because hook spawns inherited the runner's environment;
// the fix is one scrub in the shared harness, and this asserts the scrub is
// still there. Deleting it silently re-opens every hook test to the runner's
// trial state, which is invisible until someone activates the trial again.
describe("the hook-test harness strips rail state from spawned hooks", () => {
  test("run-hook-process scrubs the relax token from the default child env", () => {
    const harness = readFileSync(
      join(hooksDirectory, "run-hook-process.ts"),
      "utf8",
    );
    expect(harness).toContain("RAIL_ENVIRONMENT_VARIABLES");
    expect(harness).toContain(RELAX_TOKEN_VARIABLE);
  });

  test("every spawn path uses the scrubbed env, not the raw git-only scrub", () => {
    const harness = readFileSync(
      join(hooksDirectory, "run-hook-process.ts"),
      "utf8",
    );
    expect(harness).not.toContain("env ?? withoutInheritedGitBindings()");
    expect(harness).not.toContain("...withoutInheritedGitBindings(),");
  });

  // BEHAVIOURAL, not a source-text match: a relaxed guard appends to the trial's
  // shadow log, which resolves through the git common dir, so an unpinned spawn
  // writes FIXTURE commands into the live measurement corpus. Measured
  // 2026-09-06: 16 such entries had already reached the 312-line corpus from
  // this suite's own runs. Those are silent — unlike a stray file under
  // .claude/, they are indistinguishable from real denials and inflate the exact
  // count the keep-or-drop call reads.
  //
  // Deleting the variable would NOT do: unset falls through to the git-dir
  // resolution, which is the defect. It must be pinned somewhere discardable.
  //
  // WHY THIS ASSERTS ON A PER-TEST SINK RATHER THAN THE SHARED CORPUS (capture
  // 01a071fe). An earlier revision measured an unchanged byte length on the
  // common-dir corpus. That instrument was not hermetic, and the reason is
  // sharper than suite-level parallelism: the corpus at that path is the LIVE
  // fleet-wide measurement file, appended to by every agent session on this
  // machine through the shared git common dir. Observed 2026-09-06 while
  // diagnosing a push-gate failure — consecutive entries from `lane-h` and
  // `lane-l`, twenty seconds apart, during a run of this suite from `lane-i`.
  // No amount of intra-suite serialisation can fix that: the writers are other
  // processes, so the assertion was measuring the machine rather than the spawn,
  // and it failed for reasons wholly unrelated to the property it defends.
  //
  // The property is unchanged and is now measured directly rather than by
  // absence-elsewhere: the spawn's own log lands where the harness pinned it,
  // and carries the fixture command. Asserting the sink GREW with our own
  // fixture in it is strictly stronger than asserting a shared file did not —
  // the old shape passed vacuously if the spawn never logged at all.
  test("a relaxed deny logs to the harness-pinned sink, not the shared corpus", async () => {
    const pinnedLogPath = join(
      mkdtempSync(join(tmpdir(), "rin-guard-trial-scope-")),
      SHADOW_LOG_RUNTIME_FILE,
    );
    const relaxedDeny = await invokeBashHook({
      hookFileName: "guard-navigation.mjs",
      command: FIXTURE_RELAXED_COMMAND,
      runtime: "node",
      environmentAdditions: {
        [RELAX_TOKEN_VARIABLE]: "navigation",
        [LOG_PATH_VARIABLE]: pinnedLogPath,
      },
    });

    expect(relaxedDeny.exitCode).toBe(0);
    expect(existsSync(pinnedLogPath)).toBe(true);
    expect(readFileSync(pinnedLogPath, "utf8")).toContain(
      FIXTURE_RELAXED_COMMAND,
    );
  });

  // The other half of the same property, and the one that actually guards the
  // harness: with NO log path supplied, the default child env must still pin the
  // spawn away from the common-dir corpus. Asserted through the harness's own
  // resolution rather than by watching the shared file, so it stays hermetic.
  //
  // `scrubbedHookEnv` is the seam under test. A regression that dropped the pin
  // would leave RIN_GUARD_TRIAL_LOG unset here, and an unset value falls through
  // to the git-dir resolution — which is exactly the defect.
  test("the default child env pins the shadow log away from the real corpus", () => {
    const defaultChildLogPath = scrubbedHookEnv()[LOG_PATH_VARIABLE];

    expect(defaultChildLogPath).toBeDefined();
    expect(
      shadowLogPath({
        environment: {
          [LOG_PATH_VARIABLE]: defaultChildLogPath,
          ["CLAUDE_PROJECT_DIR"]: hooksDirectory,
        },
      }),
    ).not.toBe(join(gitCommonDirectory, SHADOW_LOG_RUNTIME_FILE));
  });
});
