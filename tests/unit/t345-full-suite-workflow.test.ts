import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { classifyLiveFiles, discoverLiveFiles, FAMILIES, LIVE_MATRICES, liveFilter, liveMatrix, liveShardCount, liveRunnerArgs, liveRunnerCommand, liveRunnerEnvironment, PLATFORM_ONLY, selectedLiveFiles, VERIFICATION_FAMILIES, type LiveFamily, type LiveMatrixKind, type VerificationFamily } from "../../scripts/ci-live-filter.ts";
import { FULL_SUITE_COVERAGE_POLICY, FULL_SUITE_JOBS, RELEASE_OMITTED_JOBS, FULL_VERIFICATION_OMITTED_JOBS, LIVE_VERIFICATION_OMITTED_JOBS, fullSuiteResult, type SuiteNeeds, type SuitePurpose } from "../../scripts/ci-full-suite-result.ts";
import { CI_BEDROCK_MODELS } from "../../scripts/ci-credential-broker.ts";
import { macosNamedUnitFiles, macosUnitSelection, selectionOutput } from "../../scripts/ci-macos-unit-selection.ts";
import { brokerChildEnvironment } from "../../scripts/ci-start-credential-broker.ts";
import { sandboxEnvironment } from "../../scripts/ci-live-sandbox.ts";
import { discoverClaudeRequiredTests } from "../harness/claude-gate.ts";
import { REPO_ROOT } from "../harness/fixtures.ts";
import { setupCodexProject } from "../harness/exec-drive.ts";
import { NATIVE_FIXTURE_SETUP_TIMEOUT_MS, NATIVE_STARTUP_TIMEOUT_MS } from "../harness/test-budget.ts";
import type { ShardConfig } from "../lib/test-sharding.ts";
import { parse } from "smol-toml";
const liveKinds = Object.keys(LIVE_MATRICES) as LiveMatrixKind[];
const liveJobs = liveKinds.map((kind) => `live_${kind}`);

function aliases(file: string): string[] {
  const parts = file.split("/");
  const name = basename(file, ".test.ts");
  const legacy = parts[0] === "plugins" ? `plugin-${parts[1]}-${name}` : name;
  return [basename(file), legacy, `${parts[0] === "plugins" ? "plugins" : parts[1]}-${legacy}`];
}

function outputEntries(text: string): Record<string, string> {
  return Object.fromEntries(text.trim().split(/\r?\n/).map((line) => {
    const index = line.indexOf("=");
    return [line.slice(0, index), line.slice(index + 1)];
  }));
}

function allSuccess(omitted: readonly string[] = RELEASE_OMITTED_JOBS): SuiteNeeds {
  return Object.fromEntries(FULL_SUITE_JOBS.map((job) => [job, { result: omitted.includes(job) ? "skipped" : "success" }]));
}
function verificationNeeds(family: VerificationFamily = "all"): SuiteNeeds {
  const needs = allSuccess([]);
  for (const job of LIVE_VERIFICATION_OMITTED_JOBS) needs[job] = { result: "skipped" };
  if (family !== "all") needs.release_contract_windows = { result: "skipped" };
  return needs;
}
function fullVerificationNeeds(): SuiteNeeds {
  const needs = allSuccess([]);
  for (const job of FULL_VERIFICATION_OMITTED_JOBS) needs[job] = { result: "skipped" };
  return needs;
}
const identity = { sha: "a".repeat(40), runId: "123", runAttempt: "2" };
const excludedFamilies = Object.entries(FAMILIES).filter(([, family]) => family.hosting === "excluded")
  .map(([name]) => name).sort();

describe("t345 retained suite planning and evidence tools", () => {

  test("the macOS unit list is computed from each file's source, never kept by hand", () => {
    const root = mkdtempSync(join(tmpdir(), "t345-macos-named-"));
    try {
      writeFileSync(join(root, "a.test.ts"), 'if (process.platform === "darwin") {}\n');
      writeFileSync(join(root, "b.test.ts"), "// runs on the macOS runner\n");
      writeFileSync(join(root, "c.test.ts"), "// portable\n");
      writeFileSync(join(root, "d-helper.ts"), "// a darwin helper, not a test file\n");
      expect(macosNamedUnitFiles(root)).toEqual(["a.test.ts", "b.test.ts"]);
      writeFileSync(join(root, "c.test.ts"), "// now names MacOS\n");
      expect(macosNamedUnitFiles(root)).toEqual(["a.test.ts", "b.test.ts", "c.test.ts"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
    // Here, the twelve shards split the named files exactly once, and each
    // shard's exclude keeps exactly its share under every name --exclude reads.
    const named = macosNamedUnitFiles(join(REPO_ROOT, "tests", "unit"));
    expect(named.length).toBeGreaterThan(0);
    const all = readdirSync(join(REPO_ROOT, "tests", "unit")).filter((file) => file.endsWith(".test.ts"));
    const seen: string[] = [];
    for (let index = 1; index <= 12; index++) {
      const selection = macosUnitSelection(REPO_ROOT, [], `${index}/12`);
      expect(selection.mode).not.toBe("full");
      if (selection.mode !== "selected") continue;
      seen.push(...selection.files);
      const exclude = new RegExp(outputEntries(selectionOutput(selection)).exclude);
      for (const file of all) {
        const kept = !aliases(`tests/unit/${file}`).some((name) => exclude.test(name));
        expect([file, kept]).toEqual([file, selection.files.includes(file)]);
      }
    }
    // Plus the rest of any affinity group a named file is in.
    const config = JSON.parse(readFileSync(join(REPO_ROOT, "tests", "unit-shard-weights.json"), "utf8")) as ShardConfig;
    const grouped = config.affinityGroups.filter((group) => group.some((file) => named.includes(file))).flat();
    expect(seen.sort()).toEqual([...new Set([...named, ...grouped])].sort());
  });

  test("the macOS selection keeps affinity groups whole and runs everything for a name it cannot pass on", () => {
    const root = mkdtempSync(join(tmpdir(), "t345-macos-groups-"));
    try {
      mkdirSync(join(root, "tests", "unit"), { recursive: true });
      for (const name of ["builder.test.ts", "reader.test.ts", "other.test.ts", "mac.test.ts"]) {
        writeFileSync(join(root, "tests", "unit", name), name === "mac.test.ts" ? "// macOS only\n" : "// portable\n");
      }
      writeFileSync(join(root, "tests", "unit-shard-weights.json"), JSON.stringify({
        defaultSeconds: 10, weights: {}, affinityGroups: [["builder.test.ts", "reader.test.ts"]],
      }));
      // A change to the file that reads what the other builds brings its builder, in the same shard.
      const shards = ["1/2", "2/2"].map((shard) => macosUnitSelection(root, ["reader.test.ts"], shard));
      const together = shards.find((selection) => selection.mode === "selected" && selection.files.includes("reader.test.ts"));
      expect(together).toEqual({ mode: "selected", files: ["builder.test.ts", "reader.test.ts"] });
      expect(shards.flatMap((selection) => selection.mode === "selected" ? selection.files : []).sort())
        .toEqual(["builder.test.ts", "mac.test.ts", "reader.test.ts"]);
      // A selected name outside the test-file grammar could break the step's
      // output lines, so the shard runs every file instead.
      expect(macosUnitSelection(root, ["odd name.test.ts"], "1/2")).toEqual({ mode: "full" });
      const unsafe = process.platform === "win32" ? "mac os.test.ts" : "mac\nmode=none\n.test.ts";
      writeFileSync(join(root, "tests", "unit", unsafe), "// macOS only\n");
      expect(macosUnitSelection(root, [], "1/2")).toEqual({ mode: "full" });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("retained Linux preparation uses distro bubblewrap and a scoped AppArmor profile", () => {
    const source = readFileSync(join(REPO_ROOT, ".github/scripts/prepare-live-runtime.sh"), "utf8");
    const provisioning = source.slice(source.indexOf("prepare_linux_bwrap()"), source.indexOf("prove_linux_bwrap()"));
    expect(provisioning).toContain("sudo apt-get install -y -qq bubblewrap");
    expect(provisioning).toContain("sudo apt-get install -y -qq apparmor-profiles apparmor-utils");
    expect(provisioning).toContain('if [[ ! -f "$profile" ]]');
    expect(provisioning).toContain("profile=/etc/apparmor.d/bwrap-userns-restrict");
    expect(provisioning).toContain('sudo install -m 0644 /usr/share/apparmor/extra-profiles/bwrap-userns-restrict "$profile"');
    expect(provisioning).toContain('sudo apparmor_parser -r "$profile"');
    expect(provisioning).toContain('if [[ "$prior" == 1 ]]');
    expect(provisioning).toContain('$(cat "$restriction")" != "$prior"');
    expect(source).not.toMatch(/\bsysctl\b|apparmor_restrict_unprivileged_userns\s*=\s*0/);
    expect(source).toContain('if [[ "$family" == codex ]]; then prepare_linux_bwrap; fi');
    expect(source.indexOf("then prepare_linux_bwrap; fi")).toBeLessThan(source.indexOf("sudo adduser"));
    expect(source).toContain('sudo ln -s /usr/bin/bwrap "$live_tools/bin/bwrap"');
    const proofs = source.slice(source.indexOf('if [[ "$mode" == prepare || "$mode" == prove ]]'));
    expect(proofs).toContain('if [[ "$(uname -s)" == Linux && "$family" == codex ]]; then\n    prove_linux_bwrap');
    expect(proofs.indexOf("prove_linux_bwrap")).toBeGreaterThan(proofs.indexOf('if run_live test -r "$GITHUB_ENV"'));
  });

  test("Codex namespace proof requires distro PATH, propagates failure and cleans only its sentinels", () => {
    const source = readFileSync(join(REPO_ROOT, ".github/scripts/prepare-live-runtime.sh"), "utf8");
    const proof = source.match(/^prove_linux_bwrap\(\) \([\s\S]*?^\)/m)![0];
    const root = mkdtempSync(join(tmpdir(), "t345-bwrap-"));
    try {
      for (const directory of ["runner", "tools"]) mkdirSync(join(root, directory));
      const script = [
        "set -euo pipefail",
        'live_tools="$PROBE_ROOT/tools"; live_home="$PROBE_ROOT/live"; live_root="$live_home/workspace"',
        // Mock only the OS boundary; no real sudo, user creation or namespaces in unit tests.
        'sudo() { case "$1" in mktemp|rm) "$@" ;; *) return 99 ;; esac; }',
        'run_live() { if [[ "$1" == /bin/bash ]]; then printf "%s\\n" "$BWRAP_PATH"; else printf "%s\\0" "$@" > "$PROBE_ARGS"; return "$BWRAP_EXIT"; fi; }',
        proof, "prove_linux_bwrap", "echo PROBE_COMPLETE",
      ].join("\n");
      const argv = join(root, "argv.bin");
      for (const [path, exit, expected] of [["/usr/bin/bwrap", "0", 0], ["/usr/bin/bwrap", "17", 17], ["/bundled/bwrap", "0", 1]] as const) {
        rmSync(argv, { force: true });
        const result = spawnSync("bash", ["-c", script], {
          encoding: "utf8", timeout: NATIVE_STARTUP_TIMEOUT_MS,
          env: {
            ...process.env, PROBE_ROOT: root.replaceAll("\\", "/"), PROBE_ARGS: argv.replaceAll("\\", "/"),
            RUNNER_TEMP: join(root, "runner").replaceAll("\\", "/"), GITHUB_WORKSPACE: root.replaceAll("\\", "/"),
            GITHUB_ENV: join(root, "environment").replaceAll("\\", "/"), BWRAP_PATH: path, BWRAP_EXIT: exit,
          },
        });
        expect(result.status, result.stdout + result.stderr).toBe(expected);
        expect(result.stdout.includes("PROBE_COMPLETE")).toBe(expected === 0);
        expect(readdirSync(join(root, "runner"))).toEqual([]);
        expect(readdirSync(join(root, "tools"))).toEqual([]);
        if (path !== "/usr/bin/bwrap") {
          expect(existsSync(argv)).toBe(false);
          continue;
        }
        const args = readFileSync(argv, "utf8").split("\0").filter(Boolean);
        expect(args.slice(0, 11)).toEqual(["bwrap", "--unshare-user", "--uid", "0", "--gid", "0", "--cap-drop", "ALL", "--ro-bind", "/", "/"]);
        const body = args[args.indexOf("-c") + 1];
        expect(body).toContain('[[ "$(id -u)" == 0 ]]');
        expect(body).toContain('[[ "$(cat "$probe")" == namespace-write ]]');
        expect(body).toContain("bun --version");
        expect(body).toContain('if cat "$denied" >/dev/null 2>&1; then');
        expect(args.some((arg) => /^\/proc\/\d+\/environ$/.test(arg))).toBe(true);
        expect(args.at(-2)).toContain("/runner/bwrap-runner.");
        expect(args.at(-1)).toContain("/tools/bwrap-host.");
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }, NATIVE_FIXTURE_SETUP_TIMEOUT_MS);

  test("retained POSIX preparation transports a complete pinned Node prefix", () => {
    const source = readFileSync(join(REPO_ROOT, ".github/scripts/prepare-live-runtime.sh"), "utf8");
    expect(source).not.toContain('sudo install -m 755 "$node_bin"');
    expect(source).toContain('sudo cp -a "$node_root" "$live_tools/node"');
    expect(source).toContain('live_path="$live_tools/node/bin:');
    const protect = source.indexOf('sudo chmod 700 "$HOME" "$RUNNER_TEMP" "$GITHUB_WORKSPACE"');
    expect(source.indexOf("run_live node --version")).toBeGreaterThan(protect);
    expect(source.indexOf('run_live "$cli" --version')).toBeGreaterThan(protect);
  });

  test("prepared POSIX dependency archives retain Node libraries and refuse incomplete runtimes", () => {
    const root = mkdtempSync(join(tmpdir(), "t345-node-deps-"));
    try {
      const workspace = join(root, "source");
      const destination = join(root, "destination");
      const temporary = join(root, "temporary");
      const cli = join(root, "cli");
      const node = join(root, "node");
      for (const path of [destination, temporary, cli, join(node, "bin"), ...["node_modules", "dist", "dist-release"].map((name) => join(workspace, name))]) {
        mkdirSync(path, { recursive: true });
      }
      writeFileSync(join(node, "bin/node"), "prepared Node executable\n");
      const archive = join(root, "deps.tar.gz");
      const script = join(REPO_ROOT, "scripts/ci-live-deps.py");
      const run = (...args: string[]) => spawnSync(process.platform === "win32" ? "python" : "python3", [script, ...args], {
        encoding: "utf8", timeout: NATIVE_STARTUP_TIMEOUT_MS,
      });
      const pack = ["pack", archive, "--workspace", workspace, "--cli", cli];
      const missing = run(...pack);
      expect(missing.status).not.toBe(0);
      expect(missing.stderr).toContain("complete Node runtime");
      const incomplete = run(...pack, "--node-runtime", node);
      expect(incomplete.status).not.toBe(0);
      expect(incomplete.stderr).toContain("requires bin/node and its lib directory");
      const unpack = ["unpack", archive, "--workspace", destination, "--temporary", temporary, "--posix-clis"];
      expect(run(...unpack).status).not.toBe(0);
      expect(existsSync(join(destination, "node_modules"))).toBe(false);
      mkdirSync(join(node, "lib/node_modules/npm/bin"), { recursive: true });
      writeFileSync(join(node, "lib/libnode.fixture"), "required runtime library\n");
      writeFileSync(join(node, "lib/node_modules/npm/bin/npm-cli.js"), "prepared npm\n");
      const packed = run(...pack, "--node-runtime", node);
      expect(packed.status, packed.stderr).toBe(0);
      rmSync(node, { recursive: true, force: true });
      const unpacked = run(...unpack);
      expect(unpacked.status, unpacked.stderr).toBe(0);
      expect(readFileSync(join(temporary, "aidlc-node/bin/node"), "utf8")).toBe("prepared Node executable\n");
      expect(readFileSync(join(temporary, "aidlc-node/lib/libnode.fixture"), "utf8")).toBe("required runtime library\n");
      expect(readFileSync(join(temporary, "aidlc-node/lib/node_modules/npm/bin/npm-cli.js"), "utf8")).toBe("prepared npm\n");
      expect(existsSync(join(temporary, "aidlc-cli"))).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }, NATIVE_FIXTURE_SETUP_TIMEOUT_MS);

  test("POSIX collection retires macOS user domains and refuses remaining executable processes", () => {
    const source = readFileSync(join(REPO_ROOT, ".github/scripts/prepare-live-runtime.sh"), "utf8");
    const collect = source.slice(source.indexOf('elif [[ "$mode" == collect ]]'));
    expect(collect.indexOf('sudo launchctl bootout "$domain"')).toBeLessThan(collect.indexOf("sudo pkill"));
    expect(collect).toContain('"gui/$live_uid" "user/$live_uid"');
    expect(collect.indexOf('remaining="$(active_live_processes)"')).toBeLessThan(collect.indexOf('sudo cp -a "$live_root/tests/logs/."'));
    // Collection needs one observed empty inventory before its deadline; a
    // launchd respawn after that (macOS lsd) must not undo a complete drain.
    expect(collect).toContain('if [[ -z "$remaining" ]]; then drained=true; break; fi');
    expect(collect.indexOf('if [[ "$drained" != true ]]; then')).toBeLessThan(collect.indexOf('sudo cp -a "$live_root/tests/logs/."'));
    expect(collect.match(/remaining="\$\(active_live_processes\)"/g)).toHaveLength(1);
    const filter = source.match(/awk -v uid="\$live_uid" '([^']+)'/)![1];
    const result = spawnSync("bash", ["-c", 'awk -v uid=502 "$1"', "collection-filter", filter], {
      encoding: "utf8", timeout: NATIVE_STARTUP_TIMEOUT_MS,
      input: "501 10 S runner\n502 11 Z zombie\n502 12 Z+ zombie-child\n502 13 S worker\n502 14 R child\n",
    });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toBe("502 13 S worker\n502 14 R child\n");
  }, NATIVE_FIXTURE_SETUP_TIMEOUT_MS);

  test("credentialed startup is isolated from broker and agent environments", () => {
    const source = {
      PATH: "/bin", RUNNER_TRACKING_ID: "owned", GITHUB_ACTIONS: "true",
      BROKER_ACCESS_KEY_ID: "real-access", BROKER_SECRET_ACCESS_KEY: "real-secret", BROKER_SESSION_TOKEN: "real-token",
      AWS_ACCESS_KEY_ID: "real-access", AWS_SECRET_ACCESS_KEY: "real-secret", AWS_SESSION_TOKEN: "real-token",
      ACTIONS_ID_TOKEN_REQUEST_TOKEN: "oidc", GH_TOKEN: "github", GITHUB_TOKEN: "github",
      ANTHROPIC_API_KEY: "anthropic", KIRO_API_KEY: "kiro", CURSOR_API_KEY: "cursor",
      AIDLC_BROKER_URL: "http://127.0.0.1:1234", CLAUDE_CODE_SKIP_BEDROCK_AUTH: "1",
    };
    expect(brokerChildEnvironment(source)).toEqual({ PATH: "/bin", RUNNER_TRACKING_ID: "owned", GITHUB_ACTIONS: "true" });
    const agent = liveRunnerEnvironment(source);
    for (const key of ["BROKER_ACCESS_KEY_ID", "BROKER_SECRET_ACCESS_KEY", "BROKER_SESSION_TOKEN", "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_SESSION_TOKEN", "ACTIONS_ID_TOKEN_REQUEST_TOKEN", "GH_TOKEN", "GITHUB_TOKEN", "ANTHROPIC_API_KEY"]) {
      expect(agent[key]).toBeUndefined();
    }
    expect(agent.KIRO_API_KEY).toBeUndefined();
    expect(agent.CURSOR_API_KEY).toBeUndefined();
    expect(agent.AIDLC_BROKER_URL).toBe(source.AIDLC_BROKER_URL);
  });

  test("CI model allowlist and Codex profile preserve proxy routing without credential export", () => {
    expect(CI_BEDROCK_MODELS.claude).toMatchObject({
      ANTHROPIC_DEFAULT_FABLE_MODEL: "global.anthropic.claude-fable-5[1m]",
      ANTHROPIC_DEFAULT_OPUS_MODEL: "global.anthropic.claude-opus-4-8[1m]",
      ANTHROPIC_DEFAULT_SONNET_MODEL: "global.anthropic.claude-sonnet-4-6[1m]",
      ANTHROPIC_DEFAULT_HAIKU_MODEL: "global.anthropic.claude-haiku-4-5-20251001-v1:0",
    });
    expect(CI_BEDROCK_MODELS.claude.ANTHROPIC_DEFAULT_SONNET_MODEL.replace("[1m]", "")).toBe(CI_BEDROCK_MODELS.opencode);
    const previous = process.env.AIDLC_BROKER_URL;
    process.env.AIDLC_BROKER_URL = "http://127.0.0.1:1234";
    const project = setupCodexProject();
    try {
      const config = parse(readFileSync(join(project.home, "config.toml"), "utf8"));
      expect(config.model).toBe(CI_BEDROCK_MODELS.codex);
      expect(config.model_providers).toMatchObject({ "amazon-bedrock": { base_url: "http://127.0.0.1:1234/openai/v1" } });
      expect(config.shell_environment_policy).toEqual({
        exclude: ["AWS_*", "AIDLC_BROKER_*", "ANTHROPIC_*", "KIRO_API_KEY", "CURSOR_API_KEY", "GITHUB_TOKEN", "GH_TOKEN", "ACTIONS_*"],
        set: { AIDLC_RULES_DIR: ".codex/aidlc-rules" },
      });
    } finally {
      if (previous === undefined) delete process.env.AIDLC_BROKER_URL;
      else process.env.AIDLC_BROKER_URL = previous;
      rmSync(project.root, { recursive: true, force: true });
    }
  }, NATIVE_FIXTURE_SETUP_TIMEOUT_MS);

  test("live matrix shards cover every eligible hosted file exactly once", () => {
    const actual: string[] = [];
    const partition = classifyLiveFiles(REPO_ROOT);
    for (const kind of liveKinds) {
      for (const row of liveMatrix(kind).include) {
        const family = FAMILIES[row.family];
        expect(family, row.family).toBeDefined();
        const files = partition.get(row.family)!.filter((file) =>
          !PLATFORM_ONLY[file] || PLATFORM_ONLY[file].includes(row.platform));
        const [index, total] = row.shard.split("/").map(Number);
        expect(total).toBe(Math.min(liveShardCount(row.family, row.platform), files.length));
        expect(index).toBeGreaterThan(0);
        expect(index).toBeLessThanOrEqual(total);
        actual.push(...selectedLiveFiles(row.family, row.platform, row.shard)
          .map((file) => row.family + ":" + row.platform + ":" + file));
      }
    }
    const expected = Object.entries(FAMILIES).flatMap(([family, spec]) => spec.platforms.flatMap((platform) =>
      family === "release-contract" && platform === "win32" ? [] :
      partition.get(family as LiveFamily)!.filter((file) => !PLATFORM_ONLY[file] || PLATFORM_ONLY[file].includes(platform))
        .map((file) => family + ":" + platform + ":" + file)));
    expect(actual.sort()).toEqual(expected.sort());
  });

  test("exact-file verification preserves full-plan shard identities and declared platforms", () => {
    const file = "tests/integration/t238-user-stories-mob.sdk.test.ts";
    for (const kind of liveKinds) {
      const full = liveMatrix(kind, "claude-sdk").include;
      const selected = liveMatrix(kind, "claude-sdk", file).include;
      expect(selected).toHaveLength(1);
      for (const row of selected) {
        const { test: selectedTest, ...owner } = row;
        expect(full).toContainEqual(owner);
        expect(selectedLiveFiles(row.family, row.platform, row.shard, selectedTest)).toEqual([file]);
      }
      const cli = spawnSync(process.execPath, [
        join(REPO_ROOT, "scripts/ci-live-filter.ts"), "--matrix", kind, "--family", "claude-sdk", "--test", file,
      ], { encoding: "utf8", timeout: NATIVE_STARTUP_TIMEOUT_MS });
      expect(cli.status, cli.stderr).toBe(0);
      expect(JSON.parse(cli.stdout)).toEqual({ include: selected });
      expect(() => liveMatrix(kind, "all", file)).toThrow("requires one verification family");
      expect(() => liveMatrix(kind, "codex", file)).toThrow("must belong to codex");
      expect(() => liveMatrix(kind, "claude-sdk", "tests/integration/missing.test.ts")).toThrow();
    }
    const windowsFile = "tests/e2e/t-tui-windows-user-settings-isolation.serial.test.ts";
    expect(liveMatrix("linux", "claude-tui", windowsFile).include).toEqual([]);
    expect(liveMatrix("macos", "claude-tui", windowsFile).include).toEqual([]);
    const windows = liveMatrix("windows", "claude-tui", windowsFile).include;
    expect(windows).toHaveLength(1);
    expect(selectedLiveFiles(windows[0].family, windows[0].platform, windows[0].shard, windows[0].test)).toEqual([windowsFile]);
  }, NATIVE_FIXTURE_SETUP_TIMEOUT_MS);

  test("sandbox env is explicit and excludes runner control-plane and AWS secrets", () => {
    const inherited = {
      ACTIONS_ID_TOKEN_REQUEST_TOKEN: "mint-token", AWS_ACCESS_KEY_ID: "secret-key", GITHUB_TOKEN: "github",
      AIDLC_CODEX_AWS_PROFILE: "runner-profile",
      AIDLC_BROKER_URL: "http://127.0.0.1:1234", AIDLC_BROKER_IDENTITY: JSON.stringify({ account: "123456789012", arn: "arn:aws:sts::123456789012:assumed-role/ci/test" }),
    };
    for (const family of ["claude-sdk", "claude-tui", "codex", "opencode", "release-contract"] as const) {
      const env = sandboxEnvironment(family, "/home/aidlc-live", "/usr/local/lib/aidlc-live/bin:/usr/bin:/bin", inherited);
      expect(env.PATH).toBe("/usr/local/lib/aidlc-live/bin:/usr/bin:/bin");
      expect(env.HOME).toBe("/home/aidlc-live");
      expect(env.TMPDIR).toBe(join("/home/aidlc-live", "tmp"));
      expect(env.BUN_INSTALL).toBe(join("/home/aidlc-live", ".bun"));
      expect(env.XDG_CACHE_HOME).toBe(join("/home/aidlc-live", ".cache"));
      expect(Object.keys(env).filter((key) => /^(ACTIONS_|AWS_|GITHUB_TOKEN|GH_TOKEN)/.test(key)))
        .toEqual(family === "opencode" ? ["AWS_CONFIG_FILE", "AWS_PROFILE"] : family === "codex" ? ["AWS_CONFIG_FILE"] : []);
      if (family === "opencode") expect(env.AWS_PROFILE).toBe("broker");
      if (family === "codex") expect(env.AIDLC_CODEX_AWS_PROFILE).toBe("codex");
      else expect(env.AIDLC_CODEX_AWS_PROFILE).toBeUndefined();
      expect(env).toMatchObject(FAMILIES[family].env);
      const windows = sandboxEnvironment(family, "C:\\aidlc-live\\home", "C:\\aidlc-live\\tools", {
        ...inherited, PATHEXT: ".UNTRUSTED",
      });
      // The hook phase trace is on for the Windows live legs only.
      expect(windows.AIDLC_TEST_HOOK_TRACE).toBe("1");
      expect(env.AIDLC_TEST_HOOK_TRACE).toBeUndefined();
      // Native `where claude` needs the executable suffix list after scrubbing.
      expect(windows.PATHEXT).toBe(".COM;.EXE;.BAT;.CMD");
      expect(windows.PATH).toBe("C:\\aidlc-live\\tools");
      if (family === "codex") expect(windows.AIDLC_CODEX_AWS_PROFILE).toBe("codex");
      else expect(windows.AIDLC_CODEX_AWS_PROFILE).toBeUndefined();
      expect(Object.keys(windows).filter((key) => /^(ACTIONS_|AWS_|GITHUB_TOKEN|GH_TOKEN)/.test(key)))
        .toEqual(family === "opencode" ? ["AWS_CONFIG_FILE", "AWS_PROFILE"] : family === "codex" ? ["AWS_CONFIG_FILE"] : []);
    }
    const managed = "C:\\aidlc-live\\tools\\codex-managed.exe";
    const native = sandboxEnvironment("codex", "C:\\aidlc-live\\home", "C:\\aidlc-live\\tools", {
      ...inherited, AIDLC_CODEX_BIN: managed,
    });
    expect(native.AIDLC_CODEX_BIN).toBe(managed);
    expect(() => sandboxEnvironment("codex", "C:\\aidlc-live\\home", "C:\\aidlc-live\\tools", {
      ...inherited, AIDLC_CODEX_BIN: "C:\\runner\\untrusted.cmd",
    })).toThrow("sealed native Codex launcher");
  });

  test("the Windows wait loop snapshots stalled hooks for live runs only, from process metadata", () => {
    const source = readFileSync(join(REPO_ROOT, ".github/scripts/prepare-live-runtime.ps1"), "utf8");
    const snapshot = source.match(/^function Write-HookStallSnapshot\b[\s\S]*?^\}/m)?.[0] ?? "";
    expect(snapshot).toContain("Get-CimInstance Win32_Process");
    // Hooks enter the dispatcher both ways; an adapter runs its core hook as a child.
    expect(snapshot).toContain("Contains('engine hook ')");
    expect(snapshot).toContain("Contains('engine adapter ')");
    // Every CIM query is capped at what is left of the snapshot's budget (at
    // most 15 seconds), so a slow provider cannot hold the wait loop; ownership
    // is checked for the stalled processes and their parents, not every process.
    expect(snapshot).toContain("[int]$BudgetSeconds = 60");
    expect(snapshot).toContain("$remaining = { [int][Math]::Min(15, [Math]::Floor(($budget - [DateTime]::UtcNow).TotalSeconds)) }");
    const cimCalls = snapshot.match(/(?:Get-CimInstance|Invoke-CimMethod)[^\n]*/g) ?? [];
    expect(cimCalls.length).toBeGreaterThanOrEqual(3);
    for (const call of cimCalls) expect(call).toMatch(/-OperationTimeoutSec (?:\$seconds|\(\[Math\]::Max\(1, \(& \$remaining\)\)\))/);
    expect(snapshot).not.toMatch(/foreach \(\$process in \$processes\) \{[^}]*GetOwnerSid/);
    // A lookup that reports a failure without throwing is unknown, not "not owned".
    expect(snapshot).toContain("$owner.ReturnValue -ne 0 -or [string]::IsNullOrEmpty($owner.Sid)) { return $null }");
    // Reading files the isolated run uses could add a handle to the stall.
    expect(snapshot).not.toMatch(/Get-Content|ReadAll|OpenRead|::Open\(|Get-ChildItem/);
    // One call site, gated to the live run's scheduled-task wait and evidence-only.
    expect(source.match(/Write-HookStallSnapshot \$/g) ?? []).toHaveLength(1);
    expect(source).toMatch(
      /if \(\$Label -eq 'run' -and \[DateTime\]::UtcNow -ge \$nextStallCheck\) \{\s+\$nextStallCheck = \[DateTime\]::UtcNow\.AddMinutes\(1\)\s+try \{ Write-HookStallSnapshot \$stallDirectory \$stallSeen /,
    );
    // A runner-only sibling of the task's log root, collected with the launch logs.
    expect(source).toContain("$stallDirectory = Join-Path (Join-Path $tools 'logs') ('hook-stalls-' + $id)");
  });

  test("Kiro and Cursor are excluded without exposing vendor API keys", () => {
    for (const family of ["kiro-ide", "kiro-tui", "kiro-acp"] as const) {
      expect(FAMILIES[family]).toMatchObject({
        hosting: "excluded", platforms: [],
        reason: "needs a dedicated isolated Windows desktop host with a separate low-privilege Kiro identity; tracked as a follow-up",
      });
    }
    expect(FAMILIES.cursor).toMatchObject({ hosting: "excluded", platforms: [], reason: "no credential separation: vendor CLI reads the API key from the agent environment" });
  });

  for (const [family, spec] of Object.entries(FAMILIES)) {
    for (const platform of spec.platforms) {
      test(`${family}/${platform} arguments select only populated tiers and produce the exact e2e plan`, () => {
        const args = liveRunnerArgs(family as LiveFamily, platform);
        const selected = classifyLiveFiles(REPO_ROOT).get(family as LiveFamily)!
          .filter((file) => !PLATFORM_ONLY[file] || PLATFORM_ONLY[file].includes(platform));
        const tiers = new Set(selected.map((file) => file.startsWith("plugins/") ? "integration" : file.split("/")[1]));
        for (const tier of ["unit", "integration", "e2e"]) {
          expect(args.includes(`--${tier}`)).toBe(tiers.has(tier));
        }
        expect(args.includes("--require-coverage")).toBe(spec.requireCoverage);
        expect(args.at(-2)).toBe("--filter");
        const regex = new RegExp(args.at(-1)!);
        expect([...discoverLiveFiles(REPO_ROOT).keys()].filter((file) => aliases(file).some((alias) => regex.test(alias))).sort()).toEqual(selected);
        expect(liveRunnerCommand(family as LiveFamily, platform, [])).toEqual([join(REPO_ROOT, "tests/run-tests.ts"), ...args]);
        const passthrough = ["--debug", "-P", "4"];
        expect(liveRunnerCommand(family as LiveFamily, platform, passthrough)).toEqual([join(REPO_ROOT, "tests/run-tests.ts"), ...passthrough, ...args]);
        const result = spawnSync(process.execPath, [
          join(REPO_ROOT, "scripts/ci-live-filter.ts"), family, "--platform", platform, "--run", "--", "--e2e-plan",
        ], { cwd: tmpdir(), encoding: "utf8", timeout: NATIVE_STARTUP_TIMEOUT_MS });
        if (args.includes("--isolated-files") || args.includes("--e2e")) {
          expect(args).toContain(family === "release-contract" ? "--isolated-e2e" : "--isolated-files");
          expect(args[args.indexOf("--bedrock-parallel") + 1]).toBe("2");
          expect(args[args.indexOf("--e2e-file-timeout") + 1]).toBe("3600");
          expect(args).not.toContain("--kiro-parallel");
          expect(args).not.toContain("--ide-parallel");
          expect(result.status, result.stdout + result.stderr).toBe(0);
          const plan = JSON.parse(result.stdout) as { files: Array<{ file: string }> };
          expect(plan.files.map(({ file }) => file).sort()).toEqual(args.includes("--isolated-files") ? selected : selected.filter((file) => file.startsWith("tests/e2e/")));
        } else {
          for (const flag of ["--isolated-e2e", "--bedrock-parallel", "--kiro-parallel", "--ide-parallel"]) {
            expect(args).not.toContain(flag);
          }
          expect(result.status).toBe(2);
          expect(result.stdout).toBe("");
        }
      }, NATIVE_FIXTURE_SETUP_TIMEOUT_MS);
    }
  }

  test("result purposes require scope runs for release and omit them for verification", () => {
    // A release result requires it; the other purposes leave it out.
    expect(FULL_SUITE_JOBS).toContain("scope_runs");
    expect(RELEASE_OMITTED_JOBS).not.toContain("scope_runs");
    expect(FULL_VERIFICATION_OMITTED_JOBS).toContain("scope_runs");
    expect(LIVE_VERIFICATION_OMITTED_JOBS).toContain("scope_runs");
  });

  test("discovery forms a disjoint partition with exact runner-alias filters", () => {
    const partition = classifyLiveFiles(REPO_ROOT);
    const discovered = [...discoverLiveFiles(REPO_ROOT).keys()].sort();
    const flattened = [...partition.values()].flat();
    expect(flattened.sort()).toEqual(discovered);
    expect(new Set(flattened).size).toBe(flattened.length);
    for (const { file } of discoverClaudeRequiredTests()) expect(flattened).toContain(file);
    expect(partition.get("claude-sdk")).toContain("tests/integration/t300-plugin-kit.test.ts");
    expect(Object.keys(FAMILIES)).not.toContain("multi-provider");
    expect(FAMILIES["claude-sdk"].requireCoverage).toBe(true);
    expect(partition.get("claude-tui")).toContain("tests/integration/t-e2e-isolated-runner.test.ts");
    expect(flattened).not.toContain("tests/unit/t-e2e-plan.test.ts");
    expect(flattened).not.toContain("tests/unit/t-test-matrix.test.ts");
    for (const files of partition.values()) {
      const regex = new RegExp(liveFilter(files));
      expect(discovered.filter((file) => aliases(file).some((alias) => regex.test(alias))).sort()).toEqual(files);
      expect(regex.test("e2e-unrelated-test")).toBe(false);
    }
  });

  test("platform filters preserve portable files and require separately owned Windows controls", () => {
    for (const [file, platforms] of Object.entries(PLATFORM_ONLY)) {
      expect(existsSync(join(REPO_ROOT, file)), file).toBe(true);
      for (const platform of ["linux", "darwin", "win32"] as const) {
        const regex = new RegExp(liveFilter([file], platform));
        expect(aliases(file).some((alias) => regex.test(alias)), `${file}/${platform}`).toBe(platforms.includes(platform));
      }
    }
    const portable = "tests/e2e/t-tui-journey-orientation.serial.test.ts";
    expect(new RegExp(liveFilter([portable], "linux")).test(aliases(portable)[2])).toBe(true);
    const windows = "tests/e2e/t-tui-journey-orientation-windows.serial.test.ts";
    expect(PLATFORM_ONLY[windows]).toEqual(["win32"]);
    const orientation = discoverClaudeRequiredTests().filter(({ file }) => file === portable || file === windows);
    expect(orientation).toEqual([
      { file: windows, dependencies: ["tui"] },
      { file: portable, dependencies: ["tui"] },
    ]);
  });

  test("plugin helpers do not claim providers beyond each test file's own opt-ins", () => {
    const root = mkdtempSync(join(tmpdir(), "full-suite-discovery-"));
    const put = (file: string, code: string) => {
      mkdirSync(dirname(join(root, file)), { recursive: true });
      writeFileSync(join(root, file), code);
    };
    try {
      const gate = (family: LiveFamily) => Object.keys(FAMILIES[family].env)[0];
      put("tests/e2e/t-new.test.ts", `const enabled = process.env.${gate("kiro-tui")}; const shared = process.env.${gate("claude-tui")};`);
      put("tests/integration/t-new.test.ts", `const enabled = process.env.${gate("codex")};`);
      put("tests/unit/t-fixture.test.ts", `const fixture = "process.env.${gate("kiro-ide")}";`);
      put("tests/unit/t-release.test.ts", `const enabled = process.env.${gate("release-contract")};`);
      put("plugins/new/tests/plugin.test.ts", `const enabled = process.env.${gate("claude-sdk")}; invokeHarness(project, "claude", "status");`);
      put("plugins/new/tests/gate-contract.test.ts", 'liveGateFor(harness); invokeHarness(project, harness, "status");');
      const partition = classifyLiveFiles(root);
      expect(partition.get("kiro-tui")).toEqual(["tests/e2e/t-new.test.ts"]);
      expect(partition.get("codex")).toEqual(["tests/integration/t-new.test.ts"]);
      expect(partition.get("claude-sdk")).toEqual(["plugins/new/tests/plugin.test.ts"]);
      expect([...partition.values()].flat()).not.toContain("plugins/new/tests/gate-contract.test.ts");
      expect(partition.get("release-contract")).toEqual(["tests/unit/t-release.test.ts"]);
      expect([...partition.values()].flat()).not.toContain("tests/unit/t-fixture.test.ts");
      const regex = new RegExp(liveFilter(partition.get("codex")!));
      expect(regex.test("integration-t-new")).toBe(true);
      expect(regex.test("e2e-t-new")).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("CLI emits executable filters and rejects invalid family/platform arguments", () => {
    const script = join(REPO_ROOT, "scripts/ci-live-filter.ts");
    const result = spawnSync(process.execPath, [script, "claude-tui", "--platform", "linux"], {
      encoding: "utf8", timeout: NATIVE_STARTUP_TIMEOUT_MS,
    });
    expect(result.status, result.stderr).toBe(0);
    const regex = new RegExp(result.stdout.trim());
    expect(regex.test("e2e-t-tui-journey-orientation.serial")).toBe(true);
    expect(regex.test("e2e-t-tui-journey-orientation-windows.serial")).toBe(false);
    const emitted = spawnSync(process.execPath, [script, "release-contract", "--platform", "linux", "--args"], {
      encoding: "utf8", timeout: NATIVE_STARTUP_TIMEOUT_MS,
    });
    expect(emitted.status, emitted.stderr).toBe(0);
    expect(emitted.stdout.trim().split("\n")).toEqual(liveRunnerArgs("release-contract", "linux"));
    for (const args of [["missing"], ["claude-tui", "--platform", "other"], ["copilot", "--run", "--", "--e2e-plan"], ["codex", "--args", "--run"]]) {
      expect(spawnSync(process.execPath, [script, ...args], { timeout: NATIVE_STARTUP_TIMEOUT_MS }).status).toBe(2);
    }
  }, NATIVE_FIXTURE_SETUP_TIMEOUT_MS);

  test("skipped live lanes block readiness even when every other job passes", () => {
    const needs: SuiteNeeds = { ...allSuccess(), live_prepare_linux: { result: "skipped" } };
    for (const job of liveJobs) needs[job] = { result: "skipped" };
    expect(fullSuiteResult(needs, identity)).toMatchObject({
      coveragePolicy: FULL_SUITE_COVERAGE_POLICY,
      passed: false, complete: false, disabledLegs: [], excluded: excludedFamilies,
      legs: { live_prepare_linux: "skipped", live_linux: "skipped", live_macos: "skipped", live_windows: "skipped" },
    });
    // One OS's skipped live job is enough to block readiness.
    for (const job of liveJobs) {
      expect(fullSuiteResult({ ...allSuccess(), [job]: { result: "skipped" } }, identity), job).toMatchObject({ passed: false });
    }
  });

  for (const purpose of ["release"] as const) {
    test(`${purpose} requires hosted live lanes and every other declared job to succeed`, () => {
      const report = fullSuiteResult(allSuccess(), identity, purpose);
      expect(report).toMatchObject({
        ...identity, coveragePolicy: FULL_SUITE_COVERAGE_POLICY,
        purpose, verificationFamily: "all", passed: true, complete: false, disabledLegs: [], omittedLegs: [...RELEASE_OMITTED_JOBS], excluded: excludedFamilies,
        legs: Object.fromEntries(Object.entries(allSuccess()).map(([job, value]) => [job, value.result])),
      });
      expect(report.verificationTest).toBeUndefined();
      expect(report.verificationPlatforms).toBeUndefined();
      for (const job of FULL_SUITE_JOBS) {
        for (const status of ((RELEASE_OMITTED_JOBS as readonly string[]).includes(job) ? ["failure", "cancelled", "success"] as const : ["failure", "cancelled", "skipped"] as const)) {
          expect(fullSuiteResult({ ...allSuccess(), [job]: { result: status } }, identity, purpose), `${job}=${status}`)
            .toMatchObject({ passed: false, complete: false, legs: { [job]: status }, disabledLegs: [], omittedLegs: [...RELEASE_OMITTED_JOBS] });
        }
        const missing = allSuccess();
        delete missing[job];
        expect(fullSuiteResult(missing, identity, purpose), job)
          .toMatchObject({ passed: false, complete: false, legs: { [job]: "missing" }, disabledLegs: [], omittedLegs: [...RELEASE_OMITTED_JOBS] });
      }
      expect(fullSuiteResult({ ...allSuccess(), future_job: { result: "skipped" } }, identity, purpose))
        .toMatchObject({ passed: false, complete: false });
      expect(fullSuiteResult(allSuccess(), { ...identity, sha: "main" }, purpose)).toMatchObject({ passed: false, complete: false });
      expect(fullSuiteResult(verificationNeeds(), identity, purpose)).toMatchObject({ passed: false, omittedLegs: [...RELEASE_OMITTED_JOBS], disabledLegs: [] });
    });
  }

  test("full verification requires every credential-free job and never a credentialed one", () => {
    const report = fullSuiteResult(fullVerificationNeeds(), identity, "full-verification");
    expect(report).toMatchObject({
      ...identity, coveragePolicy: FULL_SUITE_COVERAGE_POLICY, purpose: "full-verification", verificationFamily: "all",
      passed: true, complete: false, disabledLegs: [], omittedLegs: [...FULL_VERIFICATION_OMITTED_JOBS], excluded: excludedFamilies,
    });
    for (const job of FULL_SUITE_JOBS) {
      const omitted = (FULL_VERIFICATION_OMITTED_JOBS as readonly string[]).includes(job);
      // A credentialed lane that ran, or a required job with any outcome but success, fails the evidence.
      const statuses = omitted ? ["success", "failure", "cancelled"] as const : ["failure", "cancelled", "skipped"] as const;
      for (const status of statuses) {
        expect(fullSuiteResult({ ...fullVerificationNeeds(), [job]: { result: status } }, identity, "full-verification"), `${job}=${status}`)
          .toMatchObject({ passed: false, complete: false });
      }
      const missing = fullVerificationNeeds();
      delete missing[job];
      expect(fullSuiteResult(missing, identity, "full-verification"), job).toMatchObject({ passed: false, legs: { [job]: "missing" } });
    }
    expect(fullSuiteResult(allSuccess(), identity, "full-verification")).toMatchObject({ passed: false });
    expect(fullSuiteResult(verificationNeeds(), identity, "full-verification")).toMatchObject({ passed: false });
  });

  test("full verification rejects family and exact-test filters even when all jobs succeed", () => {
    for (const family of [...VERIFICATION_FAMILIES.filter((value) => value !== "all"), "", "unknown", "release-contract"]) {
      expect(fullSuiteResult(fullVerificationNeeds(), identity, "full-verification", family as VerificationFamily), family)
        .toMatchObject({ passed: false, complete: false, omittedLegs: [...FULL_VERIFICATION_OMITTED_JOBS], disabledLegs: [] });
    }
    for (const family of VERIFICATION_FAMILIES) {
      for (const selected of ["tests/integration/t238-user-stories-mob.sdk.test.ts", "tests/e2e/*.test.ts", " "]) {
        expect(fullSuiteResult(fullVerificationNeeds(), identity, "full-verification", family, selected), `${family}/${selected}`)
          .toMatchObject({ passed: false, complete: false, verificationTest: selected, omittedLegs: [...FULL_VERIFICATION_OMITTED_JOBS], disabledLegs: [] });
      }
    }
  });

  test("unknown runtime purposes cannot produce passing evidence", () => {
    for (const purpose of ["", "unknown", "full_verification", "release\n"]) {
      expect(fullSuiteResult(allSuccess(), identity, purpose as SuitePurpose), JSON.stringify(purpose))
        .toMatchObject({ passed: false, complete: false });
    }
  });

  test("verification passes only with successful live jobs and exactly skipped omissions", () => {
    expect(fullSuiteResult(verificationNeeds(), identity, "live-verification")).toMatchObject({
      ...identity, purpose: "live-verification", verificationFamily: "all", passed: true, complete: false,
      omittedLegs: [...LIVE_VERIFICATION_OMITTED_JOBS], disabledLegs: [], excluded: excludedFamilies,
    });
    expect(fullSuiteResult(verificationNeeds(), identity)).toMatchObject({ purpose: "release", passed: false });
    for (const job of FULL_SUITE_JOBS) {
      const omitted = (LIVE_VERIFICATION_OMITTED_JOBS as readonly string[]).includes(job);
      for (const result of omitted ? ["success", "failure", "cancelled"] as const : ["skipped", "failure", "cancelled"] as const) {
        const needs = verificationNeeds();
        needs[job] = { result };
        expect(fullSuiteResult(needs, identity, "live-verification").passed, `${job}=${result}`).toBe(false);
      }
      const needs = verificationNeeds();
      delete needs[job];
      expect(fullSuiteResult(needs, identity, "live-verification")).toMatchObject({ passed: false, legs: { [job]: "missing" } });
    }
  });

  test("family verification omits Windows release contracts and cannot qualify as release evidence", () => {
    for (const family of VERIFICATION_FAMILIES.filter((value) => value !== "all")) {
      const needs = verificationNeeds(family);
      expect(fullSuiteResult(needs, identity, "live-verification", family)).toMatchObject({
        purpose: "live-verification", verificationFamily: family, passed: true, complete: false,
        omittedLegs: [...LIVE_VERIFICATION_OMITTED_JOBS, "release_contract_windows"],
      });
      expect(fullSuiteResult(allSuccess(), identity, "release", family).passed).toBe(false);
      for (const result of ["success", "failure", "cancelled"] as const) {
        expect(fullSuiteResult({ ...needs, release_contract_windows: { result } }, identity, "live-verification", family).passed).toBe(false);
      }
      delete needs.release_contract_windows;
      expect(fullSuiteResult(needs, identity, "live-verification", family)).toMatchObject({
        passed: false, legs: { release_contract_windows: "missing" },
      });
    }
    for (const family of ["", "release-contract", "unknown"]) {
      expect(fullSuiteResult(allSuccess(), identity, "live-verification", family as VerificationFamily).passed).toBe(false);
    }
  });

  test("exact-file results identify their selection and cannot qualify as release evidence", () => {
    const file = "tests/integration/t238-user-stories-mob.sdk.test.ts";
    expect(fullSuiteResult(verificationNeeds("claude-sdk"), identity, "live-verification", "claude-sdk", file))
      .toMatchObject({ passed: true, complete: false, verificationTest: file, verificationFamily: "claude-sdk",
        verificationPlatforms: ["linux", "darwin", "win32"] });
    expect(fullSuiteResult(allSuccess(), identity, "release", "all", file).passed).toBe(false);
    expect(fullSuiteResult(verificationNeeds(), identity, "live-verification", "all", file).passed).toBe(false);
    expect(fullSuiteResult(verificationNeeds("codex"), identity, "live-verification", "codex", file).passed).toBe(false);
    expect(fullSuiteResult(verificationNeeds("claude-sdk"), identity, "live-verification", "claude-sdk",
      "tests/integration/missing.test.ts").passed).toBe(false);
    const windowsFile = "tests/e2e/t-tui-windows-user-settings-isolation.serial.test.ts";
    const windowsNeeds = { ...verificationNeeds("claude-tui"), live_linux: { result: "skipped" as const }, live_macos: { result: "skipped" as const }, live_prepare_linux: { result: "skipped" as const }, live_prepare_macos: { result: "skipped" as const } };
    expect(fullSuiteResult(windowsNeeds, identity, "live-verification", "claude-tui", windowsFile))
      .toMatchObject({ passed: true, complete: false, verificationPlatforms: ["win32"],
        omittedLegs: [...LIVE_VERIFICATION_OMITTED_JOBS, "release_contract_windows", "live_linux", "live_prepare_linux", "live_macos", "live_prepare_macos"] });
    // Each OS job without a selected row must be skipped, never run.
    for (const job of ["live_linux", "live_macos"]) {
      expect(fullSuiteResult({ ...windowsNeeds, [job]: { result: "success" } },
        identity, "live-verification", "claude-tui", windowsFile).passed, job).toBe(false);
    }
    expect(fullSuiteResult(verificationNeeds("claude-tui"), identity, "live-verification", "claude-tui", windowsFile).passed).toBe(false);
    expect(fullSuiteResult({ ...windowsNeeds, live_windows: { result: "skipped" } },
      identity, "live-verification", "claude-tui", windowsFile).passed).toBe(false);
  });

  test("result CLI fails skipped lanes, retains diagnostics, and accepts required jobs with explicit exclusions", () => {
    const root = mkdtempSync(join(tmpdir(), "full-suite-result-"));
    try {
      const needs: SuiteNeeds = { ...allSuccess(), live_prepare_linux: { result: "skipped" } };
      for (const job of liveJobs) needs[job] = { result: "skipped" };
      const env = {
        ...process.env, FULL_SUITE_PURPOSE: "release", FULL_SUITE_VERIFICATION_FAMILY: "all",
        FULL_SUITE_VERIFICATION_TEST: "",
        FULL_SUITE_NEEDS: JSON.stringify(needs), FULL_SUITE_SHA: identity.sha,
      };
      const output = join(root, "result.json");
      const script = join(REPO_ROOT, "scripts/ci-full-suite-result.ts");
      const result = spawnSync(process.execPath, [script, output], { encoding: "utf8", env, timeout: NATIVE_STARTUP_TIMEOUT_MS });
      expect(result.status, result.stderr).toBe(1);
      expect(result.stderr).toContain(`::error::Incomplete full suite for ${identity.sha}`);
      for (const job of liveJobs) expect(result.stderr).toContain(`${job}=skipped`);
      expect(result.stderr).toContain(`::warning::Full suite excluded families: ${excludedFamilies.join(", ")}`);
      const report = JSON.parse(readFileSync(output, "utf8"));
      expect(report).toMatchObject({ coveragePolicy: FULL_SUITE_COVERAGE_POLICY, passed: false, complete: false, disabledLegs: [], excluded: excludedFamilies });
      delete needs.native_reconcile;
      const missing = spawnSync(process.execPath, [script, output], {
        encoding: "utf8", timeout: NATIVE_STARTUP_TIMEOUT_MS, env: { ...env, FULL_SUITE_NEEDS: JSON.stringify(needs) },
      });
      expect(missing.status).toBe(1);
      expect(missing.stderr).toContain("native_reconcile=missing");
      expect(JSON.parse(readFileSync(output, "utf8"))).toMatchObject({ passed: false, complete: false, excluded: excludedFamilies });
      const success = spawnSync(process.execPath, [script, output], {
        encoding: "utf8", timeout: NATIVE_STARTUP_TIMEOUT_MS, env: { ...env, FULL_SUITE_NEEDS: JSON.stringify(allSuccess()) },
      });
      expect(success.status, success.stderr).toBe(0);
      expect(success.stderr).toContain(`::warning::Full suite excluded families: ${excludedFamilies.join(", ")}`);
      expect(success.stderr).not.toContain("::error::");
      expect(JSON.parse(readFileSync(output, "utf8"))).toMatchObject({
        coveragePolicy: FULL_SUITE_COVERAGE_POLICY, passed: true, complete: false, disabledLegs: [], excluded: excludedFamilies,
      });
      const verification = spawnSync(process.execPath, [script, output], {
        encoding: "utf8", timeout: NATIVE_STARTUP_TIMEOUT_MS,
        env: { ...env, FULL_SUITE_PURPOSE: "live-verification", FULL_SUITE_NEEDS: JSON.stringify(verificationNeeds()) },
      });
      expect(verification.status, verification.stderr).toBe(0);
      expect(JSON.parse(readFileSync(output, "utf8"))).toMatchObject({
        purpose: "live-verification", passed: true, complete: false, omittedLegs: [...LIVE_VERIFICATION_OMITTED_JOBS],
      });
      const scoped = spawnSync(process.execPath, [script, output], {
        encoding: "utf8", timeout: NATIVE_STARTUP_TIMEOUT_MS,
        env: { ...env, FULL_SUITE_PURPOSE: "live-verification", FULL_SUITE_VERIFICATION_FAMILY: "codex", FULL_SUITE_NEEDS: JSON.stringify(verificationNeeds("codex")) },
      });
      expect(scoped.status, scoped.stderr).toBe(0);
      expect(JSON.parse(readFileSync(output, "utf8"))).toMatchObject({ verificationFamily: "codex", passed: true, complete: false });
      for (const family of ["", "unknown"]) {
        const invalidFamily = spawnSync(process.execPath, [script, output], {
          encoding: "utf8", timeout: NATIVE_STARTUP_TIMEOUT_MS, env: { ...env, FULL_SUITE_VERIFICATION_FAMILY: family },
        });
        expect(invalidFamily.status).toBe(1);
        expect(invalidFamily.stderr).toContain("Invalid verification family");
      }
      const invalid = spawnSync(process.execPath, [script, output], {
        encoding: "utf8", timeout: NATIVE_STARTUP_TIMEOUT_MS, env: { ...env, FULL_SUITE_PURPOSE: "unknown" },
      });
      expect(invalid.status).toBe(1);
      expect(invalid.stderr).toContain("Invalid full-suite purpose");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }, NATIVE_FIXTURE_SETUP_TIMEOUT_MS);

  test("full verification CLI preserves credential-free evidence and rejects extra omissions, filters and invalid purpose", () => {
    const root = mkdtempSync(join(tmpdir(), "full-suite-verification-result-"));
    const output = join(root, "result.json");
    const script = join(REPO_ROOT, "scripts/ci-full-suite-result.ts");
    const run = (extra: NodeJS.ProcessEnv = {}) => {
      rmSync(output, { force: true });
      return spawnSync(process.execPath, [script, output], {
        encoding: "utf8", timeout: NATIVE_STARTUP_TIMEOUT_MS,
        env: {
          ...process.env, FULL_SUITE_PURPOSE: "full-verification", FULL_SUITE_VERIFICATION_FAMILY: "all",
          FULL_SUITE_VERIFICATION_TEST: "", FULL_SUITE_NEEDS: JSON.stringify(fullVerificationNeeds()), FULL_SUITE_SHA: identity.sha,
          GITHUB_RUN_ID: identity.runId, GITHUB_RUN_ATTEMPT: identity.runAttempt, ...extra,
        },
      });
    };
    try {
      const success = run();
      expect(success.status, success.stdout + success.stderr).toBe(0);
      expect(JSON.parse(readFileSync(output, "utf8"))).toEqual({
        ...identity, purpose: "full-verification", verificationFamily: "all",
        coveragePolicy: FULL_SUITE_COVERAGE_POLICY, passed: true, complete: false,
        omittedLegs: [...FULL_VERIFICATION_OMITTED_JOBS], disabledLegs: [], excluded: excludedFamilies,
        legs: Object.fromEntries(FULL_SUITE_JOBS.map((job) => [
          job, (FULL_VERIFICATION_OMITTED_JOBS as readonly string[]).includes(job) ? "skipped" : "success",
        ])),
      });
      for (const status of ["missing", "failure", "cancelled", "skipped"] as const) {
        const needs = fullVerificationNeeds();
        if (status === "missing") delete needs.release_contract_windows;
        else needs.release_contract_windows = { result: status };
        const result = run({ FULL_SUITE_NEEDS: JSON.stringify(needs) });
        expect(result.status, result.stderr).toBe(1);
        expect(result.stderr).toContain(`release_contract_windows=${status}`);
        expect(JSON.parse(readFileSync(output, "utf8"))).toMatchObject({
          purpose: "full-verification", passed: false, complete: false,
          legs: { release_contract_windows: status }, omittedLegs: [...FULL_VERIFICATION_OMITTED_JOBS], disabledLegs: [],
        });
      }
      const omitted = run({ FULL_SUITE_NEEDS: JSON.stringify(verificationNeeds()) });
      expect(omitted.status, omitted.stderr).toBe(1);
      // Jobs both purposes omit (the nightly-only scope_runs) are not required here either.
      for (const job of LIVE_VERIFICATION_OMITTED_JOBS.filter((job) => !(FULL_VERIFICATION_OMITTED_JOBS as readonly string[]).includes(job))) {
        expect(omitted.stderr).toContain(`${job}=skipped`);
      }
      for (const family of VERIFICATION_FAMILIES.filter((value) => value !== "all")) {
        const filtered = run({ FULL_SUITE_VERIFICATION_FAMILY: family });
        expect(filtered.status, filtered.stderr).toBe(1);
        expect(filtered.stderr).toContain("Full verification requires verificationFamily=all");
        expect(JSON.parse(readFileSync(output, "utf8"))).toMatchObject({
          purpose: "full-verification", verificationFamily: family, passed: false, complete: false, omittedLegs: [...FULL_VERIFICATION_OMITTED_JOBS], disabledLegs: [],
        });
      }
      const selected = "tests/integration/t238-user-stories-mob.sdk.test.ts";
      const filtered = run({ FULL_SUITE_VERIFICATION_TEST: selected });
      expect(filtered.status, filtered.stderr).toBe(1);
      expect(filtered.stderr).toContain("Exact test selection requires live-verification mode and one verification family");
      expect(JSON.parse(readFileSync(output, "utf8"))).toMatchObject({
        purpose: "full-verification", verificationTest: selected, passed: false, complete: false, omittedLegs: [...FULL_VERIFICATION_OMITTED_JOBS], disabledLegs: [],
      });
      for (const family of ["", "unknown", "release-contract"]) {
        const invalid = run({ FULL_SUITE_VERIFICATION_FAMILY: family });
        expect(invalid.status, invalid.stderr).toBe(1);
        expect(invalid.stderr).toContain("Invalid verification family");
        expect(existsSync(output)).toBe(false);
      }
      for (const purpose of ["", "unknown", "full_verification"]) {
        const invalid = run({ FULL_SUITE_PURPOSE: purpose });
        expect(invalid.status, invalid.stderr).toBe(1);
        expect(invalid.stderr).toContain("Invalid full-suite purpose");
        expect(existsSync(output)).toBe(false);
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }, NATIVE_FIXTURE_SETUP_TIMEOUT_MS);
});
