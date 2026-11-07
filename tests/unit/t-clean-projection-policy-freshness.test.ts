// covers: file:scripts/projection/src/adapters/core-agent-policy.ts
import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { projectTier } from "../../core/tools/aidlc-tiers.ts";
import { createCoreAgentPolicyReader } from "../../scripts/projection/src/adapters/core-agent-policy.ts";
import type { NativeCompilerSpawnInput } from "../../scripts/projection/src/adapters/native-compiler-process.ts";

const modulePath = "core/tools/aidlc-tiers.ts";
const original = readFileSync(join(import.meta.dir, "../..", modulePath), "utf8");
const modified = original.replace("return TIER_PROJECTIONS[capTier(t, cap)][harness];", 'return { ...TIER_PROJECTIONS[capTier(t, cap)][harness], model: "fresh-" + harness };');
const tiers = ["judgment", "balanced", "templated"] as const;
const digest = (text: string) => createHash("sha256").update(text).digest("hex");
function fixture() {
  const root = mkdtempSync(join(tmpdir(), "fresh-tier-policy-"));
  const sourceRoot = join(root, "source"), workRoot = join(root, "work");
  mkdirSync(join(sourceRoot, "core/tools"), { recursive: true });
  mkdirSync(join(sourceRoot, "core/memory"), { recursive: true });
  mkdirSync(workRoot);
  writeFileSync(join(sourceRoot, modulePath), original);
  for (const name of ["org.md", "team.md", "project.md"]) writeFileSync(join(sourceRoot, "core/memory", name), "---\n---\n");
  return { root, sourceRoot, workRoot };
}
const basis = { source: { kind: "core", id: "framework" }, pin: "a".repeat(40) } as const;
const binding = { harness: "kiro-ide", directory: ".kiro" } as const;

for (const binding of [{ harness: "claude", directory: ".claude" }, { harness: "codex", directory: ".codex" }, { harness: "cursor", directory: ".cursor" }, { harness: "kiro", directory: ".kiro" }, { harness: "kiro-ide", directory: ".kiro" }, { harness: "copilot", directory: ".aidlc" }] as const) {
  const { harness } = binding;
  test(`fresh selected-source policy at the same path is A/B/A for ${harness}`, async () => {
    const f = fixture();
    try {
      expect(modified).not.toBe(original);
      const reader = createCoreAgentPolicyReader({ workRoot: f.workRoot, binary: process.execPath });
      const flavor = harness === "kiro-ide" ? "kiro" : harness;
      for (const text of [original, modified, original]) {
        writeFileSync(join(f.sourceRoot, modulePath), text);
        const result = await reader.load({ sourceRoot: f.sourceRoot, basis, binding, environmentCap: null });
        if (result.status !== "ok") throw new Error(JSON.stringify(result.findings));
        for (const tier of tiers) {
          const expected = projectTier(tier, flavor, null);
          expect(result.value.models.tiers[tier].model).toBe(text === modified ? `fresh-${flavor}` : expected.model);
        }
        expect(result.value.inputs.find(input => input.path === modulePath)?.sha256).toBe(digest(text));
        expect(readdirSync(f.workRoot)).toEqual([]);
      }
    } finally { rmSync(f.root, { recursive: true, force: true }); }
  }, 30000);
}

test("fresh evaluation receives explicit source, profile and missing states in an isolated work root", async () => {
  const f = fixture();
  try {
    rmSync(join(f.sourceRoot, "core/memory/team.md"));
    const calls: NativeCompilerSpawnInput[] = [];
    const reader = createCoreAgentPolicyReader({ workRoot: f.workRoot, operations: {
      environment: () => ({ ...process.env, AIDLC_TIER_CAP: "invalid", AIDLC_BUILD_VERSION: "invalid" }),
      spawn: input => { calls.push(input); return { exitCode: 0, stdout: JSON.stringify({ memoryCap: "balanced", tiers: Object.fromEntries(tiers.map(tier => [tier, { model: `explicit-${tier}` }])) }), stderr: "", error: null }; },
    } });
    const result = await reader.load({ sourceRoot: f.sourceRoot, basis, binding, environmentCap: "templated" });
    expect(result.status === "ok" && result.value.tierCap).toBe("templated");
    expect(calls).toHaveLength(1);
    const call = calls[0]!, request = JSON.parse(call.input);
    expect(request.harness).toBe("kiro"); expect(request.environmentCap).toBe("templated");
    expect(request.expected).toHaveLength(4);
    expect(request.expected.find((entry: { path: string }) => entry.path === "core/memory/team.md").sha256).toBeNull();
    expect(call.cwd.startsWith(f.workRoot)).toBe(true);
    expect(call.env.HOME).toBe(call.cwd); expect(call.env.TEMP).toBe(call.cwd);
    expect(call.env.BUN_RUNTIME_TRANSPILER_CACHE_PATH).toBe("0"); expect(call.env.BUN_INSTALL_AUTO).toBe("disable");
    expect(call.env.AIDLC_TIER_CAP).toBeUndefined(); expect(call.env.AIDLC_BUILD_VERSION).toBeUndefined();
    expect(readdirSync(f.workRoot)).toEqual([]);
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

test("tier evaluation refuses malformed results and changed source after a process reply", async () => {
  const f = fixture();
  try {
    for (const value of [{ memoryCap: "invalid", tiers: {} }, { memoryCap: null, tiers: { judgment: { model: null } } }, { memoryCap: null, tiers: Object.fromEntries(tiers.map(tier => [tier, { model: null, effort: "unbounded" }])) }]) {
      const reader = createCoreAgentPolicyReader({ workRoot: f.workRoot, operations: { environment: () => ({}), spawn: () => ({ exitCode: 0, stdout: JSON.stringify(value), stderr: "", error: null }) } });
      expect((await reader.load({ sourceRoot: f.sourceRoot, basis, binding })).status).toBe("invalid");
    }
    const reader = createCoreAgentPolicyReader({ workRoot: f.workRoot, operations: { environment: () => ({}), spawn: () => {
      writeFileSync(join(f.sourceRoot, "core/memory/team.md"), "changed");
      return { exitCode: 0, stdout: JSON.stringify({ memoryCap: null, tiers: Object.fromEntries(tiers.map(tier => [tier, { model: null }])) }), stderr: "", error: null };
    } } });
    expect((await reader.load({ sourceRoot: f.sourceRoot, basis, binding })).status).toBe("invalid");
    expect(readdirSync(f.workRoot)).toEqual([]);
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

test("tier evaluation refuses unwitnessed imports and source mutation within the child", async () => {
  const f = fixture();
  try {
    const reader = createCoreAgentPolicyReader({ workRoot: f.workRoot, binary: process.execPath });
    for (const prefix of ['import "unwitnessed-package";\n', 'import "./unwitnessed.ts";\n', 'import "file:///unwitnessed.ts";\n']) {
      writeFileSync(join(f.sourceRoot, modulePath), prefix + original);
      expect((await reader.load({ sourceRoot: f.sourceRoot, basis, binding })).status).toBe("invalid");
    }
    writeFileSync(join(f.sourceRoot, modulePath), original.replace('import { existsSync, readFileSync }', 'import { existsSync, readFileSync, writeFileSync }').replace('return TIER_PROJECTIONS[capTier(t, cap)][harness];', 'writeFileSync(join(import.meta.dir, "../memory/team.md"), "changed"); return TIER_PROJECTIONS[capTier(t, cap)][harness];'));
    const result = await reader.load({ sourceRoot: f.sourceRoot, basis, binding });
    expect(result.status).toBe("invalid");
    if (result.status === "invalid") expect(result.findings[0]?.detail).toContain("source changed");
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

test("tier evaluation refuses relative, overlapping and reparse roots before spawning", async () => {
  const f = fixture();
  try {
    mkdirSync(join(f.sourceRoot, "work"));
    const alias = join(f.root, "source-alias"); symlinkSync(f.sourceRoot, alias, "junction");
    let calls = 0;
    const operations = { environment: () => ({}), spawn: () => { calls++; throw new Error("must not execute"); } };
    for (const workRoot of ["relative", f.sourceRoot, join(f.sourceRoot, "work"), f.root, alias]) {
      const reader = createCoreAgentPolicyReader({ workRoot, operations });
      expect((await reader.load({ sourceRoot: f.sourceRoot, basis, binding })).status).toBe("invalid");
    }
    expect((await createCoreAgentPolicyReader({ workRoot: f.workRoot, operations }).load({ sourceRoot: alias, basis, binding })).status).toBe("invalid");
    expect(calls).toBe(0);
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

test("raw child tier results cannot lose invalid shape through JSON serialization", async () => {
  const f = fixture();
  try {
    const reader = createCoreAgentPolicyReader({ workRoot: f.workRoot, binary: process.execPath });
    for (const expression of ['Promise.resolve({ model: "hidden" })', 'new Map([["model", "hidden"]])', '{ model: null, unsupported: undefined }', '{ model: Infinity }', 'Object.defineProperty({ model: "original" }, "toJSON", { value: () => ({ model: "rewritten" }) })']) {
      writeFileSync(join(f.sourceRoot, modulePath), original.replace("return TIER_PROJECTIONS[capTier(t, cap)][harness];", `return ${expression};`));
      const result = await reader.load({ sourceRoot: f.sourceRoot, basis, binding });
      expect(result.status).toBe("invalid");
      if (result.status === "invalid") expect(result.findings[0]?.detail).toContain("before serialization");
    }
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

test("child serialization transports the checked descriptor snapshot without source property reads", async () => {
  const f = fixture();
  try {
    writeFileSync(join(f.sourceRoot, modulePath), original.replace("return TIER_PROJECTIONS[capTier(t, cap)][harness];", 'return new Proxy({ model: "checked-model" }, { get: () => Infinity });'));
    const result = await createCoreAgentPolicyReader({ workRoot: f.workRoot, binary: process.execPath }).load({ sourceRoot: f.sourceRoot, basis, binding });
    if (result.status !== "ok") throw new Error(JSON.stringify(result.findings));
    for (const tier of tiers) expect(result.value.models.tiers[tier]).toEqual({ model: "checked-model", effort: null });
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});
