import "../../core/tools/aidlc-command.test.ts";
// t150-codex-packaging: dist/codex determinism + trust-seed recipe.
//
// covers: file:tools/aidlc-lib.ts
//
// WHAT. Three contracts land here:
//   (1) `bun scripts/package.ts codex --check` produces byte-identical clean
//       builds, including the single sanctioned prefix-transform class.
//   (2) Core parity: every .ts under dist/codex/.codex/tools/ and the core
//       hook bodies are BYTE-IDENTICAL to their dist/claude sources, except
//       for aidlc-runtime-paths.ts's single projected invocation constant.
//   (3) The S9a trust-hash recipe in the packager reproduces the hash the
//       spike recorded live (findings §S9a) — the installer pre-seed is only
//       sound while this stays true.
//
// WHY SUBPROCESS. Same idiom as kiro's t141: the packager is a CLI; we pin
// its observable behavior, not its internals.

import {
  NATIVE_FIXTURE_SETUP_TIMEOUT_MS,
  NATIVE_STARTUP_TIMEOUT_MS,
  remainingOperationTimeoutMs,
} from "../harness/test-budget.ts";
import { afterAll, describe, expect, test, setDefaultTimeout } from "bun:test";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { parse } from "smol-toml";
import { z } from "zod";
import type { CodexHookTrustIdentityInput } from "../../core/tools/aidlc-plugin-hook-registrations.ts";
import { trustEntries as emitCodexTrustEntries, trustHash as hashCodexHookIdentity } from "../../harness/codex/emit.ts";
import { TRUSTED_ROUTE_NAMESPACE } from "../../core/tools/aidlc-command.ts";
import { REPO_ROOT } from "../harness/fixtures.ts";
import { composePluginFixture } from "../harness/plugin-kit.ts";

setDefaultTimeout(NATIVE_FIXTURE_SETUP_TIMEOUT_MS);

const PACKAGE_SCRIPT = join(REPO_ROOT, "scripts", "package.ts");
const TEST_PRO_AGENT_PATH = join(REPO_ROOT, "plugins", "test-pro", "agents", "test-pro-metrics-agent.md");
const CLAUDE_SRC = join(REPO_ROOT, "dist", "claude", ".claude");
const CODEX_DST = join(REPO_ROOT, "dist", "codex", ".codex");
// Codex's own event→trust-key spelling: trust keys are snake_case while
// hooks.json names events in PascalCase, so comparing the two surfaces needs
// this translation. TOTAL by construction — an event present in hooks.json with
// no mapping throws here, at arrange time, rather than degrading to a count of
// zero that an assertion would then read as a real (and wrong) measurement.
const SNAKE_BY_EVENT: Record<string, string> = {
  SessionStart: "session_start",
  UserPromptSubmit: "user_prompt_submit",
  PreToolUse: "pre_tool_use",
  PostToolUse: "post_tool_use",
  PreCompact: "pre_compact",
  SubagentStop: "subagent_stop",
  Stop: "stop",
};

// A trust key is "<path>:<event_snake>:<group>:<idx>", so the event spelling is
// the third field from the end. Total by construction for the same reason as
// snakeForEvent: a key that does not carry one must fail loudly rather than be
// dropped from the tally, where it would quietly lower a trusted count and turn
// a real coverage gap into a passing comparison.
const trustKeyEventSpelling = (key: string): string => {
  const spelling = key.split(":").at(-3);
  if (spelling === undefined) {
    throw new Error(`trust key "${key}" carries no event field`);
  }
  return spelling;
};

// A repoRoot carrying no plugins/ directory, so pluginHookRows returns [] and
// the generator reports CORE wiring alone. Used to separate core rows from
// plugin-contributed ones without hardcoding either set.
const PLUGINLESS_ROOT = mkdtempSync(join(tmpdir(), "t150-core-only-"));

function selectedCodexProject(): string {
  return composePluginFixture({
    plugin: "rin", harness: "codex", projectDir: join(PLUGINLESS_ROOT, "selected-codex"),
    pluginBuilt: join(REPO_ROOT, "dist", "plugins", "rin", "codex"),
    beforeCompose: ({ projectDir }) => {
      mkdirSync(join(projectDir, ".git"), { recursive: true });
      const file = join(projectDir, ".codex", "tools", "data", "harness.json");
      writeFileSync(file, `${JSON.stringify({ ...JSON.parse(readFileSync(file, "utf-8")), plugins: ["aidlc", "rin"] }, null, 2)}\n`);
    },
  }).projectDir;
}

const snakeForEvent = (event: string): string => {
  const snake = SNAKE_BY_EVENT[event];
  if (snake === undefined) {
    throw new Error(
      `hooks.json carries event "${event}" with no trust-key spelling — add it to SNAKE_BY_EVENT`,
    );
  }
  return snake;
};

// Read from the COMMITTED dist artefact, never from trustEntries(). Deriving it
// from the generator would compare the generator against itself — the exact
// blindness that let plugin rows ship untrusted, since both sides would then
// move together and agree no matter what they said. dist/codex is kept honest by
// test 1's `package.ts codex --check`, which is what makes this an independent
// source rather than a stale one.
//
// The trust surface is a SET of keys, each naming an event and a group index.
// hooks.json groups by event while trustEntries emits in wiring order, so the
// two agree on membership but not on sequence — and sequence here is an artefact
// of how each surface is serialised, not a property of the contract. What IS
// load-bearing is that every shipped group has a key and no key names a group
// that does not exist, which is membership. Callers therefore compare sorted.
const trustSuffixesFromShippedWiring = (): string[] => {
  const wiring = JSON.parse(
    readFileSync(join(CODEX_DST, "hooks.json"), "utf-8"),
  ) as { hooks: Record<string, unknown[]> };
  return Object.entries(wiring.hooks).flatMap(([event, groups]) =>
    groups.map((_group, index) => `${snakeForEvent(event)}:${index}:0`),
  );
};

type TrustDocument = {
  hooks: {
    state: Record<string, { trusted_hash: string }>;
  };
};

type TrustEntries = (
  project: string,
  hooksJson: string | undefined,
  harnessDir: string,
  repoRoot: string,
  harnessName?: string,
  invoke?: string,
) => string;

const SOURCE_INVOKE = "bun .codex/tools/aidlc.ts";

function parseTrustDocument(source: string): TrustDocument {
  return parse(source) as unknown as TrustDocument;
}

type CodexEmitter = {
  trustEntries: TrustEntries;
  trustHash: (input: CodexHookTrustIdentityInput) => string;
};

type CodexHookDocument = {
  hooks: Record<string, Array<{ matcher?: string | undefined; hooks: Array<{ command: string; timeout?: number | undefined }> }>>;
};

function parseCodexHookDocument(input: { source: string }): CodexHookDocument {
  return z.object({
    hooks: z.record(z.string(), z.array(z.object({
      matcher: z.string().optional(),
      hooks: z.array(z.object({ command: z.string(), timeout: z.number().optional() })),
    }))),
  }).parse(JSON.parse(input.source));
}

function codexEmitter(): CodexEmitter {
  return {
    trustEntries: (
      project,
      hooksJson,
      harnessDir,
      repoRoot,
      harnessName = "codex",
      invoke = "aidlc",
    ) =>
      emitCodexTrustEntries(
        project,
        hooksJson,
        harnessDir,
        repoRoot,
        harnessName,
        invoke,
        TRUSTED_ROUTE_NAMESPACE,
      ),
    trustHash: hashCodexHookIdentity,
  };
}

function trustEntries(): TrustEntries {
  return codexEmitter().trustEntries;
}

function trustHash(input: CodexHookTrustIdentityInput): string {
  return codexEmitter().trustHash(input);
}

// Sorted, because the two surfaces serialise in different orders (hooks.json
// groups by event, trustEntries emits in wiring order) while carrying the same
// set. Callers compare against sortedTrustKeys(actual) so the assertion is about
// MEMBERSHIP — every shipped group trusted, no key naming a group that does not
// exist — which is the property that was actually broken.
//
// Sorting genuinely gives up the sequence check, and no other assertion in this
// file recovers it (see the honest bound in 6b). Sequence is not free of
// meaning — Codex trusts positionally — so this is a real, named gap rather than
// a property covered somewhere else.
function expectedTrustKeys(hooksJsonPath: string): string[] {
  return trustSuffixesFromShippedWiring()
    .map((suffix) => `${hooksJsonPath}:${suffix}`)
    .sort();
}

const sortedTrustKeys = (document: TrustDocument): string[] =>
  Object.keys(document.hooks.state).sort();

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir).sort()) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) yield* walk(full);
    else yield full;
  }
}

function runDoctorWithCodexVersion(version: string): {
  status: number;
  output: string;
} {
  const root = mkdtempSync(join(tmpdir(), "t150-codex-version-"));
  try {
    const project = join(root, "project");
    cpSync(join(REPO_ROOT, "dist", "codex", ".codex"), join(project, ".codex"), {
      recursive: true,
    });
    cpSync(join(REPO_ROOT, "dist", "codex", "aidlc"), join(project, "aidlc"), {
      recursive: true,
    });

    const binDir = join(root, "bin");
    mkdirSync(binDir, { recursive: true });
    if (process.platform === "win32") {
      // The doctor executes the resolved path without a shell. Node-compatible
      // spawnSync rejects .cmd files; use a small native CLI (as in t255).
      const source = join(binDir, "codex.cs");
      const executable = join(binDir, "codex.exe");
      writeFileSync(source, `using System;
public static class CodexVersionFixture {
  public static int Main(string[] args) {
    if (args.Length != 1 || args[0] != "--version") return 2;
    Console.WriteLine(${JSON.stringify(`codex-cli ${version}`)});
    return 0;
  }
}
`);
      const compiler = join(
        process.env.WINDIR ?? "C:\\Windows",
        "Microsoft.NET", "Framework64", "v4.0.30319", "csc.exe",
      );
      const compiled = spawnSync(
        compiler,
        ["/nologo", "/optimize+", "/target:exe", `/out:${executable}`, source],
        { encoding: "utf-8", timeout: remainingOperationTimeoutMs(NATIVE_STARTUP_TIMEOUT_MS) },
      );
      if (compiled.error || compiled.status !== 0) {
        throw new Error(`Codex fixture compile failed: ${compiled.error?.message || compiled.stderr || compiled.stdout}`);
      }
      const probe = spawnSync(executable, ["--version"], { encoding: "utf-8", timeout: remainingOperationTimeoutMs(NATIVE_STARTUP_TIMEOUT_MS) });
      expect(probe.error).toBeUndefined();
      expect(probe.status, probe.stderr).toBe(0);
      expect(probe.stdout.trim()).toBe(`codex-cli ${version}`);
    } else {
      const fakeCodex = join(binDir, "codex");
      writeFileSync(fakeCodex, `#!/bin/sh\necho "codex-cli ${version}"\n`);
      chmodSync(fakeCodex, 0o755);
    }

    const tool = join(project, ".codex", "tools", "aidlc-utility.ts");
    const result = spawnSync(
      process.execPath,
      [tool, "doctor", "--verbose", "--project-dir", project],
      {
      timeout: remainingOperationTimeoutMs(NATIVE_STARTUP_TIMEOUT_MS),
      cwd: project,
      encoding: "utf-8",
      env: {
        ...process.env,
        // The version-floor fixture exercises copied source, not the host install.
        AIDLC_INSTALL_ROOT: join(root, "install"),
        PATH: `${binDir}${delimiter}${process.env.PATH ?? ""}`,
      },
      },
    );
    return {
      status: result.status ?? -1,
      output: `${result.stdout ?? ""}${result.stderr ?? ""}`,
    };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

// CD-47's "removes it afterwards" clause: PLUGINLESS_ROOT is module-scope, so it
// has no try/finally to ride like the per-call root above. Without this it leaks
// one empty directory per run — hermetic, but litter the rule asks us not to
// leave.
afterAll(() => {
  rmSync(PLUGINLESS_ROOT, { recursive: true, force: true });
});

function buildSyntheticCodexPluginAgent(args: {
  readonly label: string;
  readonly source: string;
}): { readonly status: number | null; readonly stderr: string; readonly nativeAgent: string | null } {
  const fixtureRoot = mkdtempSync(join(tmpdir(), `t150-${args.label}-`));
  try {
    for (const directory of ["scripts", "core", "harness"]) {
      cpSync(join(REPO_ROOT, directory), join(fixtureRoot, directory), { recursive: true });
    }
    cpSync(join(REPO_ROOT, "tsconfig.json"), join(fixtureRoot, "tsconfig.json"));
    cpSync(join(REPO_ROOT, "plugins", "test-pro"), join(fixtureRoot, "plugins", "test-pro"), { recursive: true });
    symlinkSync(join(REPO_ROOT, "node_modules"), join(fixtureRoot, "node_modules"), "dir");
    writeFileSync(join(fixtureRoot, "plugins", "test-pro", "agents", "test-pro-metrics-agent.md"), args.source, "utf-8");
    const outputRoot = join(fixtureRoot, "output");
    const result = spawnSync("bun", [join(fixtureRoot, "scripts", "package.ts"), "plugin", "build", "test-pro", "codex", outputRoot], {
      cwd: fixtureRoot,
      encoding: "utf-8",
      env: { ...process.env, AIDLC_TIER_CAP: "" },
    });
    const nativePath = join(outputRoot, "agents", "test-pro-metrics-agent.toml");
    return {
      status: result.status,
      stderr: String(result.stderr ?? ""),
      nativeAgent: existsSync(nativePath) ? readFileSync(nativePath, "utf-8") : null,
    };
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
}

describe("t150 dist/codex packaging determinism + trust", () => {
  test("1: codex package generation is deterministic", () => {
    const r = spawnSync("bun", [PACKAGE_SCRIPT, "codex", "--check"], {
      timeout: remainingOperationTimeoutMs(NATIVE_FIXTURE_SETUP_TIMEOUT_MS),
      encoding: "utf-8",
      cwd: REPO_ROOT,
    });
    if (r.status !== 0) {
      // Surface the script's path-level mismatch list.
      console.error(r.stderr);
    }
    expect(r.status).toBe(0);
    expect(r.stdout).toContain(
      "deterministic across two independent build(s) for codex",
    );
  }, NATIVE_FIXTURE_SETUP_TIMEOUT_MS);

  test("native dispatch matcher is emitted on the stage-rule delivery group", () => {
    const wiring = parseCodexHookDocument({
      source: readFileSync(join(CODEX_DST, "hooks.json"), "utf-8"),
    });
    expect(wiring.hooks.PreToolUse?.filter((group) =>
      group.hooks.some((hook) => hook.command.endsWith(" adapter codex deliver-stage-rules")),
    )).toEqual([{
      matcher: "^(spawn_agent|collaborationspawn_agent)$",
      hooks: [{ command: "bun .codex/tools/aidlc.ts engine adapter codex deliver-stage-rules", timeout: 1800 }],
    }]);
  });

  test("2: packaged .ts files differ only at declared projection tokens", () => {
    // tools/ + hooks/ carry the deterministic core. The codex adapter
    // (authored shell, aidlc-codex-*.ts) has no claude counterpart and is
    // exempt. Harness-local Bun paths are the declared source projection.
    const divergent: string[] = [];
    for (const sub of ["tools", "hooks"]) {
      const dstDir = join(CODEX_DST, sub);
      for (const file of walk(dstDir)) {
        if (!file.endsWith(".ts")) continue;
        if (/aidlc-codex-[^/]+\.ts$/.test(file)) continue;
        const rel = file.slice(dstDir.length + 1);
        const src = join(CLAUDE_SRC, sub, rel);
        let codex = readFileSync(file, "utf-8");
        const claude = readFileSync(src, "utf-8");
        codex = codex.replaceAll(
          "bun .codex/tools/",
          "bun .claude/tools/",
        );
        if (rel === "aidlc-plugin.ts") {
          codex = codex.replace(
            '.replaceAll(".codex", harnessDir)',
            '.replaceAll(".claude", harnessDir)',
          );
        }
        if (codex !== claude) divergent.push(`${sub}/${rel}`);
      }
    }
    expect(divergent).toEqual([]);
  });

  test("3: shipped codex prose carries no bun .claude/tools commands", () => {
    const r = spawnSync(
      "grep",
      ["-rn", "bun .claude/tools/", join(REPO_ROOT, "dist", "codex")],
      { timeout: remainingOperationTimeoutMs(NATIVE_STARTUP_TIMEOUT_MS), encoding: "utf-8" },
    );
    // grep exits 1 on no matches — exactly what we want.
    expect(r.status).toBe(1);
  });

  test("3b: the session skills name the commands a Codex user types, and leave paths alone", () => {
    const skills = join(REPO_ROOT, "dist", "codex", ".agents", "skills");
    const read = (skill: string) => readFileSync(join(skills, skill, "SKILL.md"), "utf-8");
    expect(read("aidlc-session-cost")).toContain("Run $aidlc to\nbegin, then re-run $aidlc-session-cost.");
    expect(read("aidlc-replay")).toContain("start a workflow with $aidlc before running\n$aidlc-replay.");
    expect(read("aidlc-replay")).toContain("`$aidlc-outcomes-pack`");
    expect(read("aidlc-outcomes-pack")).toContain("Run $aidlc to completion first.");
    for (const skill of ["aidlc-session-cost", "aidlc-replay", "aidlc-outcomes-pack"]) {
      expect(read(skill), skill).not.toMatch(/(^|[\s(`"])\/aidlc(?![a-z0-9-]*\.[a-z])/m);
    }
    // Paths keep their slash, and the Claude tree keeps its slash commands.
    expect(read("aidlc-replay")).toContain("`<record>/aidlc-state.md`");
    expect(read("aidlc-replay")).toContain("bun .codex/tools/aidlc.ts engine runtime summary");
    expect(readFileSync(join(CLAUDE_SRC, "skills", "aidlc-replay", "SKILL.md"), "utf-8")).toContain("/aidlc-replay.");
  });

  test("4: method relocated to workspace-root aidlc/spaces/default/memory/; native rules/ is Starlark-only", () => {
    // The AIDLC method ("memory") no longer ships under .codex/aidlc-rules/ (the
    // old D-10 rename target). It relocated OUT of the harness dir to the
    // workspace root — one hand-editable copy, neutral filenames, identical
    // across harnesses. Reached via AGENTS.md auto-merge + AIDLC_RULES_DIR.
    const memoryDir = join(REPO_ROOT, "dist", "codex", "aidlc", "spaces", "default", "memory");
    const memoryTop = readdirSync(memoryDir);
    expect(memoryTop).toContain("org.md");
    expect(memoryTop).toContain("team.md");
    expect(memoryTop).toContain("project.md");
    expect(readdirSync(join(memoryDir, "phases"))).toContain("construction.md");
    // .codex/aidlc-rules/ is GONE — the method left the harness dir entirely.
    expect(() => readdirSync(join(CODEX_DST, "aidlc-rules"))).toThrow();
    // .codex/rules/ remains Codex's native Starlark permission-rules dir.
    const nativeRules = readdirSync(join(CODEX_DST, "rules"));
    expect(nativeRules).toEqual(["default.rules"]);
    const defaultRules = readFileSync(join(CODEX_DST, "rules", "default.rules"), "utf-8");
    expect(defaultRules).toContain(
      'prefix_rule(pattern = ["bun", ".codex/tools/"], decision = "allow")',
    );
    expect(defaultRules).not.toContain('prefix_rule(pattern = ["aidlc"]');
    // The resolver seam re-points at the relocated method (relative to the
    // workspace root, where codex runs), NOT the old .codex/aidlc-rules.
    const config = readFileSync(join(CODEX_DST, "config.toml"), "utf-8");
    expect(config).toContain('AIDLC_RULES_DIR = "aidlc/spaces/default/memory"');
    expect(config).not.toMatch(/^model\s*=/m);
    expect(config).not.toMatch(/^model_provider\s*=/m);
    expect(config).not.toContain("[model_providers.");
    expect(config).toContain('model_reasoning_effort = "high"');
    expect(config).toContain("[agents]\nmax_depth = 1");
    // The compiled graph's rule display paths are harness-neutral now.
    const graph = readFileSync(join(CODEX_DST, "tools", "data", "stage-graph.json"), "utf-8");
    expect(graph).toContain('"aidlc/spaces/default/memory/org.md"');
    expect(graph).not.toContain(".codex/aidlc-rules/");
    expect(graph).not.toContain('".claude/rules/');
  });

  test("Codex config injects the native onboarding in both distribution channels", () => {
    for (const channel of ["dist", "dist-release"]) {
      const root = join(REPO_ROOT, channel, "codex", ".codex");
      const raw = readFileSync(join(root, "config.toml"), "utf-8");
      // The parser's object return type omits these shipped Codex config fields.
      const config = Bun.TOML.parse(raw) as {
        developer_instructions?: string;
        shell_environment_policy?: { set?: Record<string, string> };
        suppress_unstable_features_warning?: boolean;
        features?: { default_mode_request_user_input?: boolean };
      };
      // The gate picker is a Codex under-development feature AI-DLC turns on,
      // so the start-up warning about it is turned off in the same file.
      expect(config.features?.default_mode_request_user_input).toBe(true);
      expect(config.suppress_unstable_features_warning).toBe(true);
      const onboarding = readFileSync(join(root, "onboarding.md"), "utf-8");
      expect(typeof config.developer_instructions).toBe("string");
      // Bun 1.3.14 incorrectly preserves the opening newline of a TOML literal string.
      const instructions = config.developer_instructions as string;
      expect(instructions.replace(/^\n/, "")).toBe(onboarding);
      const standardConfig = parse(raw) as typeof config;
      expect(standardConfig.developer_instructions).toBe(onboarding);
      expect(config.developer_instructions).toContain("# AI-DLC on Codex CLI");
      // AI-DLC's questions keep its words; the agent's own words are for the rest.
      expect(config.developer_instructions).toContain("Show AI-DLC's questions and choices with their meaning unchanged, in the\nperson's language;");
      expect(config.developer_instructions).toContain("are still named by path.");
      expect(config.developer_instructions).toContain("When they ask about one, answer them.");
      expect(config.developer_instructions).toContain("Plan Approval's choice labels stay exactly as AI-DLC gives\nthem.");
      expect(config.developer_instructions).not.toContain("say it in your own words");
      expect(config.developer_instructions).toContain(".agents/skills/");
      expect(config.shell_environment_policy).toMatchObject({
        set: { AIDLC_RULES_DIR: "aidlc/spaces/default/memory" },
      });
      expect(raw).toContain('set = { AIDLC_RULES_DIR = "aidlc/spaces/default/memory" }');
      if (channel === "dist-release") {
        expect(config.developer_instructions).toContain("- **Runtime**:");
        expect(config.developer_instructions).not.toMatch(/\bbun\b/);
      }
    }
  });

  test("5: hooks.json wires only Codex-real events through the adapter (no SessionEnd)", () => {
    const wiring = JSON.parse(readFileSync(join(CODEX_DST, "hooks.json"), "utf-8")) as {
      hooks: Record<string, Array<{ matcher?: string; hooks: Array<{ command: string; timeout: number }> }>>;
    };
    expect(Object.keys(wiring.hooks).sort()).toEqual(
      ["PostToolUse", "PreCompact", "PreToolUse", "SessionStart", "Stop", "SubagentStop", "UserPromptSubmit"].sort(),
    );
    // Matchers per the verified tool-name map.
    const postMatchers = wiring.hooks.PostToolUse.slice(0, 4).map((g) => g.matcher).sort();
    expect(postMatchers).toEqual(["Bash", "apply_patch", "request_user_input", "update_plan"]);
    expect(
      wiring.hooks.PostToolUse.find((group) => group.matcher === "request_user_input")
        ?.hooks[0]?.command,
    ).toBe("bun .codex/tools/aidlc.ts engine adapter codex record-human-turn");
    // One matcher-free PreToolUse group runs the five checks in one process
    // (#2066); deliver-stage-rules keeps its spawn_agent row.
    expect(wiring.hooks.PreToolUse.map((group) => group.matcher)).toEqual([undefined, "^(spawn_agent|collaborationspawn_agent)$"]);
    expect(wiring.hooks.PreToolUse[0]?.hooks[0]?.command).toBe(
      "bun .codex/tools/aidlc.ts engine adapter codex guard-tool-call",
    );
    expect(wiring.hooks.PreToolUse[0]?.hooks).toHaveLength(1);
    // Every registration routes through the single authored adapter.
    for (const groups of Object.values(wiring.hooks)) {
      for (const g of groups) {
        for (const h of g.hooks) {
          expect(h.command).toMatch(
            /^bun \.codex\/tools\/aidlc\.ts engine adapter codex [a-z-]+$/,
          );
          const compound = /(?:continue-workflow|audit-and-sensors)$/.test(h.command);
          expect(h.timeout, h.command).toBe(compound ? 3600 : 1800);
        }
      }
    }
  });

  test("6: the complete shipped trust-seed is valid TOML and exactly matches trustEntries()", () => {
    // The installer generates entries through the trust command and pastes its
    // stdout into $CODEX_HOME/config.toml, so paths always pass through the TOML
    // serializer and Codex runs the hooks without a TUI trust pass.
    // The pre-seed is only sound while every shipped hash matches the live hook
    // identity emit.ts hashes. Guard that by calling the REAL exported
    // trustEntries() (not an inlined copy of the recipe) and asserting it
    // reproduces the shipped body verbatim for the <PROJECT_DIR> template. If
    // trustHash's recipe, HOOK_WIRING, or the adapter command ever drifts, the
    // shipped hashes go stale and Codex silently rejects every hook — this fails
    // then, where --check cannot (a buggy emit regenerates the same wrong bytes).
    const emitTrustEntries = trustEntries();
    const shipped = readFileSync(join(CODEX_DST, "trust-seed.toml"), "utf-8");
    const parsed = parseTrustDocument(shipped);
    expect(sortedTrustKeys(parsed)).toEqual(
      expectedTrustKeys("<PROJECT_DIR>/.codex/hooks.json"),
    );
    // The shipped file is a header comment block + the trustEntries() body. The
    // body begins at the first [hooks.state ...] line.
    const bodyStart = shipped.indexOf("[hooks.state");
    expect(bodyStart).toBeGreaterThan(-1);
    const header = shipped.slice(0, bodyStart);
    expect(header).toContain(
      "projected `bun .codex/tools/aidlc.ts engine adapter codex ...`",
    );
    expect(header).toContain("replace the full set");
    expect(header).toContain("appending a second set creates invalid TOML");
    expect(header).not.toMatch(/replac\w*\s+<PROJECT_DIR>/i);
    const shippedBody = shipped.slice(bodyStart).trimEnd();
    const produced = emitTrustEntries(
      "<PROJECT_DIR>",
      undefined,
      ".codex",
      REPO_ROOT,
      "codex",
      SOURCE_INVOKE,
    ).trimEnd();
    expect(produced).toBe(shippedBody);
    // And the real session_start hash is a sha256 over the live adapter identity
    // — a concrete anchor so a silent recipe change can't pass by emitting a
    // self-consistent but wrong hash for every entry.
    expect(shippedBody).toContain(
      'session_start:0:0"]\ntrusted_hash = "sha256:58956c1f8f0b66e96c0f4d02e26946e79979e0f30599e8dc06a512ebecf03843"',
    );
    // Codex hashes a group's matcher too. This is the hash Codex 0.160.0
    // itself wrote for the Bash-matched PostToolUse hook after "Trust all": a
    // seed without the matcher left every matched hook untrusted, and they
    // never ran. (The Bash-matched PreToolUse row it was pinned beside became
    // the matcher-free guard-tool-call group, #2066; its hash is the recipe's,
    // pinned below.)
    expect(shippedBody).toContain(
      'post_tool_use:3:0"]\ntrusted_hash = "sha256:5f9a79604c580af77ffe63c58e0b76871e229f051df824b8add818dfbd44c388"',
    );
    expect(shippedBody).toContain(
      'pre_tool_use:0:0"]\ntrusted_hash = "sha256:b1ea78813660ef5ca5039c39fa0c7c6b0a67d9cf1f88cdb3a73f789eab1884ae"',
    );
  });

  test("6b: selected plugin trust seed covers every final registered group with its matching identity", () => {
    // THE INVARIANT NO OTHER TEST STATES. Codex identifies a trusted hook
    // POSITIONALLY ("<hooks.json>:<event>:<group>:0") and silently declines to
    // run any group without a matching trusted_hash. So a trust set that omits
    // rows leaves them registered-but-dead: the file lists the guard, the guard
    // never spawns, and every registration-shaped check still passes. Test 6
    // cannot see this — it compares trustEntries() against a seed generated BY
    // trustEntries(), so a source that omits plugin rows agrees with itself.
    //
    // Measured live on 2026-08-26 (codex-cli 0.149.1): shipped hooks.json
    // carried 17 PreToolUse groups while the trust command emitted 5, so all 12
    // rin guard rows were untrusted and a forbidden `node -e` write reached disk
    // with no denial recorded.
    //
    // Both sides are derived INDEPENDENTLY here: group counts from the shipped
    // artefact, trust keys from the generator. A test that read one source for
    // both would reproduce exactly the defect it is meant to catch.
    const project = selectedCodexProject();
    const hooksPath = join(project, ".codex", "hooks.json");
    const wiring = parseCodexHookDocument({ source: readFileSync(hooksPath, "utf-8") });
    const shippedGroupCounts = Object.fromEntries(
      Object.entries(wiring.hooks).map(([event, groups]) => [
        event,
        groups.length,
      ]),
    );

    const trustState = parseTrustDocument(readFileSync(join(project, ".codex", "trust-seed.toml"), "utf-8")).hooks.state;
    const trustedKeys = Object.keys(trustState);
    const trustedCounts = Object.fromEntries(
      Object.entries(Object.groupBy(trustedKeys, trustKeyEventSpelling)).map(
        ([event, keys]) => [event, keys?.length ?? 0],
      ),
    );

    const untrusted = Object.entries(shippedGroupCounts)
      .map(([event, shippedCount]) => ({
        event,
        shippedCount,
        trustedCount: trustedCounts[snakeForEvent(event)] ?? 0,
      }))
      .filter(({ shippedCount, trustedCount }) => trustedCount !== shippedCount);

    expect(untrusted).toEqual([]);

    // THE ANTI-VACUITY FLOOR, and without it everything above is decoration.
    //
    // Both surfaces read plugin rows through pluginHookRows(REPO_ROOT), which
    // resolves <REPO_ROOT>/plugins — a GITIGNORED staging dir the rin packager
    // populates. In a fresh clone it is absent, both sides collapse to the core
    // wiring, and every comparison above agrees at 5 === 5 while asserting
    // nothing about the defect this test exists for. That is the same
    // self-agreement pathology the trust surface itself had, one layer up.
    //
    // So assert the subject directly: at least one PLUGIN-CONTRIBUTED row must
    // be present and trusted. A plugin row is one whose target is absent from
    // the core HOOK_WIRING set — derived from the emitted commands rather than
    // matched on a "rin-" prefix, because the property under test is
    // "contributed by a plugin", not "belonging to one particular plugin".

    // The core row count per event, obtained by pointing the generator at a
    // repoRoot with NO plugins directory — so it reports the core wiring alone.
    // A literal would go stale the moment core's wiring changes; this cannot.
    const coreOnlyKeys = Object.keys(
      parseTrustDocument(
        trustEntries()("<PROJECT_DIR>", undefined, ".codex", PLUGINLESS_ROOT, "codex", SOURCE_INVOKE),
      ).hooks.state,
    );
    const groupedCoreKeys = Object.groupBy(coreOnlyKeys, trustKeyEventSpelling);
    const coreOnlyCounts = Object.fromEntries(
      Object.entries(groupedCoreKeys).map(([event, keys]) => [event, keys?.length ?? 0]),
    );

    // Groups past the core count for their event are plugin-contributed —
    // identified STRUCTURALLY (position beyond core's rows) rather than by a
    // "rin-" prefix, because the property under test is "contributed by a
    // plugin", not "belonging to one particular plugin".
    const pluginGroups = Object.entries(wiring.hooks).flatMap(
      ([event, groups]) =>
        groups
          .map((group, index) => ({ event, index, group }))
          .filter(
            ({ event: groupEvent, index }) =>
              index >= (coreOnlyCounts[snakeForEvent(groupEvent)] ?? 0),
          ),
    );

    expect(pluginGroups.length).toBeGreaterThan(0);

    const untrustedPluginGroups = pluginGroups.filter(({ event, index }) => {
      const key = `${hooksPath}:${snakeForEvent(event)}:${index}:0`;
      return trustState[key] === undefined;
    });

    expect(untrustedPluginGroups).toEqual([]);

    // Counts alone leave the key→identity pairing unchecked. Codex resolves a
    // trust entry positionally, then compares the stored hash against the
    // identity of whatever group actually sits at that index — and the hash
    // covers the group's COMMAND. So a trust surface can carry exactly the right
    // NUMBER of keys per event while every one of them is bound to the wrong
    // row, and Codex would silently decline every mismatched hook: the same
    // registered-but-dead fail-open, arriving through a door counting cannot
    // watch. This asserts each shipped group's own command hashes to the entry
    // stored at that group's key, with the command read from the committed
    // artefact and the hash from the generator.
    //
    // HONEST BOUND, because the comment that used to sit here overstated it: this
    // does NOT catch a reorder of HOOK_WIRING itself. Both surfaces regenerate
    // from that one list, so a swap moves the command and the hash together and
    // every assertion here still agrees. Catching that needs an anchor outside
    // the generator — the pinned session_start hash in test 6 is one such anchor
    // but binds only the first row. Nothing in this file currently binds the
    // order of the rest, and that gap is real rather than covered elsewhere.
    const misbound = Object.entries(wiring.hooks).flatMap(([event, groups]) =>
      groups.flatMap((group, index) => {
        const snake = snakeForEvent(event);
        const key = `${hooksPath}:${snake}:${index}:0`;
        const shippedCommand = group.hooks[0]?.command ?? "";
        const stored = trustState[key]?.trusted_hash;
        const expectedHash = trustHash({ eventSnake: snake, command: shippedCommand, matcher: group.matcher, timeout: group.hooks[0]?.timeout });
        return stored === expectedHash
          ? []
          : [{ key, shippedCommand, stored, expectedHash }];
      }),
    );

    expect(misbound).toEqual([]);
  });

  test("7: default trust paths round-trip Unix and Windows path characters exactly", () => {
    const emitTrustEntries = trustEntries();
    const cases = [
      {
        project: "/tmp/example-proj",
        hooksJson: "/tmp/example-proj/.codex/hooks.json",
      },
      {
        project: '/srv/AI DLC/project "quoted"\\literal',
        hooksJson: '/srv/AI DLC/project "quoted"\\literal/.codex/hooks.json',
      },
      {
        project: String.raw`C:\Users\Jane Doe\AI "DLC"`,
        hooksJson: String.raw`C:\Users\Jane Doe\AI "DLC"\.codex\hooks.json`,
      },
      {
        project: String.raw`\\server\shared projects\AI "DLC"`,
        hooksJson: String.raw`\\server\shared projects\AI "DLC"\.codex\hooks.json`,
      },
      {
        project: "//server/share/project",
        hooksJson: String.raw`\\server\share\project\.codex\hooks.json`,
      },
    ];

    for (const { project, hooksJson } of cases) {
      // repoRoot passed so the key set matches what an install really trusts:
      // this case is about PATH round-tripping, and it must exercise the same
      // row set the shipped wiring registers rather than a core-only subset.
      const output = emitTrustEntries(project, undefined, ".codex", REPO_ROOT);
      const parsed = parseTrustDocument(output);
      expect(sortedTrustKeys(parsed)).toEqual(expectedTrustKeys(hooksJson));
      for (const entry of Object.values(parsed.hooks.state)) {
        expect(entry.trusted_hash).toMatch(/^sha256:[0-9a-f]{64}$/);
      }
    }

    // Pin the installed-command identity separately from the copy-channel
    // anchor above; its explicit SessionStart timeout is also 1800 seconds.
    expect(emitTrustEntries("/tmp/example-proj", undefined, ".codex", REPO_ROOT)).toStartWith(
      '[hooks.state."/tmp/example-proj/.codex/hooks.json:session_start:0:0"]\n' +
        'trusted_hash = "sha256:0ba8b12bad0f77c2bf9a996ec8e533c53a6e451fe37c31de2626e27514e35e63"\n\n',
    );
  });

  test("8: explicit hooks-json paths are preserved and complete CLI stdout parses", () => {
    const project = "/tmp/project path that must not replace the hook path";
    const hooksJson = String.raw`D:\custom hooks\hook "set"\hooks.json`;
    const emitTrustEntries = trustEntries();
    const expected = emitTrustEntries(project, hooksJson, ".codex", REPO_ROOT, "codex", SOURCE_INVOKE);
    const direct = parseTrustDocument(expected);
    expect(sortedTrustKeys(direct)).toEqual(expectedTrustKeys(hooksJson));

    const r = spawnSync(
      "bun",
      [PACKAGE_SCRIPT, "codex", "trust", "--project", project, "--hooks-json", hooksJson],
      {
        timeout: remainingOperationTimeoutMs(NATIVE_FIXTURE_SETUP_TIMEOUT_MS),
        encoding: "utf-8",
        cwd: REPO_ROOT,
      },
    );
    expect(r.status).toBe(0);
    expect(r.stderr).toBe("");
    // console.log adds one newline to the already newline-terminated TOML.
    expect(r.stdout).toBe(`${expected}\n`);
    const parsedStdout = parseTrustDocument(r.stdout);
    expect(sortedTrustKeys(parsedStdout)).toEqual(expectedTrustKeys(hooksJson));
    expect(r.stdout).not.toContain(project);
  });

  test("9: trust subcommand accepts fully qualified Windows project roots", () => {
    const cases = [
      {
        project: String.raw`C:\workspace\AI DLC`,
        hooksJson: String.raw`C:\workspace\AI DLC\.codex\hooks.json`,
      },
      {
        project: String.raw`\\server\share\AI DLC`,
        hooksJson: String.raw`\\server\share\AI DLC\.codex\hooks.json`,
      },
      {
        project: "//server/share/AI DLC",
        hooksJson: String.raw`\\server\share\AI DLC\.codex\hooks.json`,
      },
    ];

    for (const { project, hooksJson } of cases) {
      const r = spawnSync("bun", [PACKAGE_SCRIPT, "codex", "trust", "--project", project], {
        timeout: remainingOperationTimeoutMs(NATIVE_FIXTURE_SETUP_TIMEOUT_MS),
        encoding: "utf-8",
        cwd: REPO_ROOT,
      });
      expect(r.status, project).toBe(0);
      expect(r.stderr, project).toBe("");
      expect(sortedTrustKeys(parseTrustDocument(r.stdout))).toEqual(
        expectedTrustKeys(hooksJson),
      );
    }
  });

  test("10: trust subcommand rejects malformed, non-qualified, unknown, and duplicate arguments", () => {
    const cases: Array<{ args: string[]; error: string }> = [
      {
        args: ["codex", "trust", "--hooks-json", "--project", "/tmp/project"],
        error: "--hooks-json requires an absolute path",
      },
      {
        args: ["codex", "trust", "--project", "relative/project"],
        error: "--project must be a fully qualified absolute path",
      },
      {
        args: ["codex", "trust", "--project", "/tmp/project", "--hooks-json", "hooks.json"],
        error: "--hooks-json must be a fully qualified absolute path",
      },
      {
        args: ["codex", "trust", "--project", String.raw`\workspace`],
        error: "--project must be a fully qualified absolute path",
      },
      {
        args: ["codex", "trust", "--project", String.raw`\\server`],
        error: "--project must be a fully qualified absolute path",
      },
      {
        args: ["codex", "trust", "--project", "//server"],
        error: "--project must be a fully qualified absolute path",
      },
      {
        args: [
          "codex",
          "trust",
          "--project",
          "/tmp/project",
          "--hooks-json",
          String.raw`\custom\hooks.json`,
        ],
        error: "--hooks-json must be a fully qualified absolute path",
      },
      {
        args: ["codex", "trust", "--project", "/tmp/project", "--hooks-josn", "/tmp/hooks.json"],
        error: 'unknown argument "--hooks-josn"',
      },
      {
        args: [
          "codex",
          "trust",
          "--project",
          "/tmp/project",
          "--project",
          "/tmp/other",
        ],
        error: "--project may be specified only once",
      },
    ];

    for (const { args, error } of cases) {
      const r = spawnSync("bun", [PACKAGE_SCRIPT, ...args], {
        timeout: remainingOperationTimeoutMs(NATIVE_FIXTURE_SETUP_TIMEOUT_MS),
        encoding: "utf-8",
        cwd: REPO_ROOT,
      });
      expect(r.status, args.join(" ")).toBe(1);
      expect(r.stdout, args.join(" ")).toBe("");
      expect(r.stderr, args.join(" ")).toContain(error);
      expect(r.stderr, args.join(" ")).toContain(
        "usage: package.ts codex trust --project <abs-dir> [--hooks-json <abs-path>]",
      );
    }
  });

  test("11: skills tree — every runner carries the S9f implicit-invocation guard; the orchestrator does not", () => {
    const skillsDir = join(REPO_ROOT, "dist", "codex", ".agents", "skills");
    const dirs = readdirSync(skillsDir).filter((d) =>
      statSync(join(skillsDir, d)).isDirectory(),
    );
    // 42 skills: orchestrator + 30 stage runners + init + compose + 5 scope runners
    // + 3 session + aidlc-knowledge. The last one only ships here because
    // harness/codex/emit.ts names it explicitly: codex does not enumerate
    // core/skills/, so this count is what catches a skill missing from that array.
    expect(dirs.length).toBe(42);
    for (const d of dirs) {
      const guard = join(skillsDir, d, "agents", "openai.yaml");
      if (d === "aidlc") {
        // The entry point stays implicitly invocable.
        let exists = true;
        try {
          statSync(guard);
        } catch {
          exists = false;
        }
        expect(exists).toBe(false);
        // The orchestrator ships its question-rendering and composer annexes beside SKILL.md.
        expect(readdirSync(join(skillsDir, d)).sort()).toEqual([
          "SKILL.md",
          "composer.md",
          "question-rendering.md",
        ]);
      } else {
        expect(readFileSync(guard, "utf-8")).toContain("allow_implicit_invocation: false");
      }
    }
    // Stage runners drive the source-channel Bun tool.
    const probe = readFileSync(join(skillsDir, "aidlc-intent-capture", "SKILL.md"), "utf-8");
    expect(probe).toContain(
      "bun .codex/tools/aidlc-orchestrate.ts next --stage intent-capture --single",
    );
  });

  test("12: trust subcommand substitutes the project path into every entry", () => {
    const r = spawnSync("bun", [PACKAGE_SCRIPT, "codex", "trust", "--project", "/tmp/example-proj"], {
      timeout: remainingOperationTimeoutMs(NATIVE_FIXTURE_SETUP_TIMEOUT_MS),
      encoding: "utf-8",
      cwd: REPO_ROOT,
    });
    expect(r.status).toBe(0);
    const parsed = parseTrustDocument(r.stdout);
    const entries = Object.keys(parsed.hooks.state);
    const wiring = JSON.parse(readFileSync(join(CODEX_DST, "hooks.json"), "utf-8")) as {
      hooks: Record<string, Array<unknown>>;
    };
    const groupCount = Object.values(wiring.hooks).reduce((n, g) => n + g.length, 0);
    expect(entries.length).toBe(groupCount);
    expect([...entries].sort()).toEqual(
      expectedTrustKeys("/tmp/example-proj/.codex/hooks.json"),
    );
    expect(r.stdout).not.toContain("<PROJECT_DIR>");
    // It trusts the hooks the copied dist/codex runs (`bun .codex/tools/aidlc.ts
    // ...`): the shipped seed's entries for this project, hash for hash. Native
    // `aidlc ...` hashes here left every hook in a copied project untrusted.
    const seed = readFileSync(join(CODEX_DST, "trust-seed.toml"), "utf-8");
    expect(r.stdout.trimEnd()).toBe(
      seed.slice(seed.indexOf("[hooks.state")).replaceAll("<PROJECT_DIR>", "/tmp/example-proj").trimEnd(),
    );
  });

  test.each(["0.144.9", "0.145.0"])("13: doctor enforces the compact-session reload floor for Codex %s", (version) => {
    const result = runDoctorWithCodexVersion(version);
    expect(result.status, result.output).toBe(0);
    if (version === "0.144.9") {
      expect(result.output).toContain(
        "Harness CLI: codex codex-cli 0.144.9 is below 0.145.0",
      );
      expect(result.output).toContain(
        "Install or upgrade Codex CLI to 0.145.0 or later",
      );
    } else {
      expect(result.output).toContain("Harness CLI: codex codex-cli 0.145.0");
    }
    // Each version owns one native fixture and doctor run, including cleanup.
    // Compiler/probe backstops use the shared native policy for each version.
  }, NATIVE_FIXTURE_SETUP_TIMEOUT_MS);

  test("14: both generated Codex configs select workspace-write at the TOML root", () => {
    for (const output of ["dist", "dist-release"]) {
      const configPath = join(REPO_ROOT, output, "codex", ".codex", "config.toml");
      const config = parse(readFileSync(configPath, "utf-8"));
      // A text match also accepts sandbox_mode inside shell_environment_policy,
      // where it does not select the sandbox. Check the generated TOML structure.
      expect(config.sandbox_mode, configPath).toBe("workspace-write");
      expect(config.shell_environment_policy, configPath).toEqual({
        set: { AIDLC_RULES_DIR: "aidlc/spaces/default/memory" },
      });
      // Keep the existing network policy and absence of extra grants/approval
      // overrides while correcting only the sandbox setting's table placement.
      expect(config.sandbox_workspace_write, configPath).toEqual({
        network_access: true,
      });
      expect(config.approval_policy, configPath).toBeUndefined();
    }
  });

  test("14: packaged Rin plugin agents have native Codex roles with projected policy and instructions", () => {
    const agentRoot = join(REPO_ROOT, "dist", "plugins", "rin", "codex", "agents");
    const sourceAgents = readdirSync(join(REPO_ROOT, "plugins", "rin", "agents"))
      .filter((file) => file.endsWith("-agent.md"))
      .map((file) => file.replace(/\.md$/, ".toml"))
      .sort();
    const nativeAgents = readdirSync(agentRoot)
      .filter((file) => file.endsWith(".toml"))
      .sort();
    expect(nativeAgents).toEqual(sourceAgents);
    const documents = nativeAgents.map((file) =>
      parse(readFileSync(join(agentRoot, file), "utf-8")) as Record<string, unknown>
    );
    expect(documents.every((document) =>
      typeof document.developer_instructions === "string" &&
      !/\{\{[A-Z_]+\}\}/.test(document.developer_instructions)
    )).toBe(true);
    const balanced = parse(readFileSync(join(agentRoot, "rin-pr-evades-reviewer-agent.toml"), "utf-8")) as Record<string, unknown>;
    expect(balanced.model).toBe("gpt-5.6-terra");
    expect(balanced.model_reasoning_effort).toBe("medium");
    expect(balanced.developer_instructions).toContain(".codex/knowledge/");
    const judgment = parse(readFileSync(join(agentRoot, "rin-pr-checkers-reviewer-agent.toml"), "utf-8")) as Record<string, unknown>;
    expect(judgment.model).toBeUndefined();
    expect(judgment.model_reasoning_effort).toBeUndefined();
    expect(judgment.description).toContain(".codex/");
    const tierless = parse(readFileSync(join(REPO_ROOT, "dist", "plugins", "test-pro", "codex", "agents", "test-pro-metrics-agent.toml"), "utf-8")) as Record<string, unknown>;
    expect(tierless.model).toBeUndefined();
    expect(tierless.model_reasoning_effort).toBeUndefined();
    expect(tierless.developer_instructions).toContain(".codex/aidlc-rules/");
  });

  test("15: isolated Codex plugin build applies the pack-time tier cap", () => {
    const outDir = mkdtempSync(join(tmpdir(), "t150-codex-plugin-cap-"));
    try {
      const built = spawnSync("bun", [PACKAGE_SCRIPT, "plugin", "build", "rin", "codex", outDir], {
        cwd: REPO_ROOT,
        encoding: "utf-8",
        env: { ...process.env, AIDLC_TIER_CAP: "balanced" },
      });
      expect(built.status, built.stderr).toBe(0);
      const judgment = parse(readFileSync(join(outDir, "agents", "rin-pr-checkers-reviewer-agent.toml"), "utf-8")) as Record<string, unknown>;
      expect(judgment.model).toBe("gpt-5.6-terra");
      expect(judgment.model_reasoning_effort).toBe("medium");
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  });

  test("16: packaged Codex plugin instructions preserve TOML-sensitive content", () => {
    const regression = [
      "Regex \\d",
      "Path C:\\Users",
      "Literal \\n",
      '"""quoted"""',
      'model = "literal instruction"',
    ].join("\n");
    const source = `${readFileSync(TEST_PRO_AGENT_PATH, "utf-8")
      .replace("model: sonnet", "tier: balanced")}\n${regression}\n`;
    const result = buildSyntheticCodexPluginAgent({ label: "escaping", source });
    expect(result.status, result.stderr).toBe(0);
    const agent = parse(result.nativeAgent ?? "") as Record<string, unknown>;
    expect(agent.model).toBe("gpt-5.6-terra");
    expect(agent.model_reasoning_effort).toBe("medium");
    expect(agent.developer_instructions).toContain(regression);
  });

  test("17: unresolved plugin tokens refuse native Codex projection", () => {
    const source = `${readFileSync(TEST_PRO_AGENT_PATH, "utf-8")}\n{{UNKNOWN_TOKEN}}\n`;
    const result = buildSyntheticCodexPluginAgent({ label: "unresolved-token", source });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("unresolved Codex agent token {{UNKNOWN_TOKEN}}");
    expect(result.nativeAgent).toBeNull();
  });

  test("18: invalid plugin agent tiers refuse native Codex projection", () => {
    const source = readFileSync(TEST_PRO_AGENT_PATH, "utf-8")
      .replace("model: sonnet", "tier: unsupported");
    const result = buildSyntheticCodexPluginAgent({ label: "invalid-tier", source });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("invalid agent tier");
    expect(result.nativeAgent).toBeNull();
  });
});
