// Explicit copy profiles reach the retained producers without ambient configuration.
import { expect, test } from "bun:test";
import { ZodError } from "zod";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { AIDLC_VERSION } from "../../core/tools/aidlc-version.ts";
import { nextPatchVersion } from "../../core/tools/aidlc-channel.ts";
import { projectTier } from "../../core/tools/aidlc-tiers.ts";
import { projectClaudeCopy } from "../../scripts/project-claude.ts";
import { usesCleanClaudeCopy } from "../../scripts/projection-process.ts";
import { createCoreAgentPolicyReader, type CoreAgentPolicySourceOperations } from "../../scripts/projection/src/adapters/core-agent-policy.ts";
import { createSourceRuntimeModuleOperations, createSourceRuntimeModulePreparer } from "../../scripts/projection/src/adapters/source-runtime-modules.ts";
import { createSourceDescriptionOperations, createSourceDescriptionPreparer } from "../../scripts/projection/src/adapters/source-distribution-description.ts";
import type { NativeCompilerSpawnInput } from "../../scripts/projection/src/adapters/native-compiler-process.ts";
import type { Tier } from "../../scripts/projection/src/domain/model.ts";

const basis = { source: { kind: "core", id: "framework" }, pin: "a".repeat(40) } as const;
const binding = { harness: "claude", directory: ".claude" } as const;
const tiers = ["judgment", "balanced", "templated"] as const;
const caps = [null, ...tiers] as const;
const sourceRoot = join(import.meta.dir, "../..");
const preview = `${nextPatchVersion(AIDLC_VERSION)}-preview.20261107.1`;

for (const buildVersion of [AIDLC_VERSION, preview]) {
  test.each([...caps])(`Claude Bun copy selects the retained producer at ${buildVersion} with cap %j`, environmentCap => {
    expect(usesCleanClaudeCopy({ name: "claude", harnessDir: ".claude", invoke: "bun .claude/tools/aidlc.ts", ...{ buildVersion, environmentCap } })).toBe(true);
  });
}
test.each(["codex", "cursor", "kiro", "kiro-ide", "opencode", "copilot"])("%s remains outside the Claude profile", name => {
  expect(usesCleanClaudeCopy({ name, harnessDir: ".claude", invoke: "bun .claude/tools/aidlc.ts" })).toBe(false);
});

function policySource(memoryCap: Tier | null | string): CoreAgentPolicySourceOperations {
  return {
    read: async ({ path }) => ({ status: "ok", value: new TextEncoder().encode(path) }),
    project: async ({ environmentCap, harness }) => ({ status: "ok", value: { memoryCap, tiers: Object.fromEntries(tiers.map(tier => [tier, projectTier(tier, harness as "claude", (environmentCap ?? memoryCap) as Tier | null)])) } }),
    digest: ({ bytes }) => createHash("sha256").update(bytes).digest("hex"),
  };
}
for (const memoryCap of caps) {
  test.each([...caps])(`explicit environment cap %j resolves against source memory ${memoryCap}`, async environmentCap => {
    const reader = createCoreAgentPolicyReader({ source: policySource(memoryCap) });
    const result = await reader.load({ sourceRoot, basis, binding, environmentCap });
    if (result.status === "invalid") throw new Error(JSON.stringify(result.findings));
    const expected = environmentCap ?? memoryCap;
    expect(result.value.tierCap).toBe(expected ?? "judgment");
    for (const tier of tiers) expect(result.value.models.tiers[tier]).toEqual({ model: projectTier(tier, "claude", expected).model ?? null, effort: projectTier(tier, "claude", expected).effort ?? null });
    expect(result.value.models.explicit).toBe("preserve");
    expect(result.value.inputs).toHaveLength(4);
  });
}
test("one policy reader can alternate capped, uncapped and omitted requests", async () => {
  const reader = createCoreAgentPolicyReader({ source: policySource("balanced") });
  const request = { sourceRoot, basis, binding };
  const first = await reader.load(request);
  const capped = await reader.load({ ...request, environmentCap: "templated" });
  const lifted = await reader.load({ ...request, environmentCap: "judgment" });
  expect(capped.status === "ok" && capped.value.tierCap).toBe("templated");
  expect(lifted.status === "ok" && lifted.value.tierCap).toBe("judgment");
  expect(await reader.load({ ...request, environmentCap: null })).toEqual(first);
  expect(await reader.load(request)).toEqual(first);
});
test("an environment override does not hide malformed source memory", async () => {
  const reader = createCoreAgentPolicyReader({ source: policySource("invalid") });
  const result = await reader.load({ sourceRoot, basis, binding, environmentCap: "judgment" });
  expect(result.status).toBe("invalid");
});
test("an invalid explicit cap is refused before source loading", async () => {
  let reads = 0;
  const source = policySource(null);
  const reader = createCoreAgentPolicyReader({ source: { ...source, read: async request => { reads++; return source.read(request); } } });
  const result = await reader.load({ sourceRoot, basis, binding, environmentCap: "invalid" as Tier });
  expect(result.status).toBe("invalid");
  expect(reads).toBe(0);
});

test("both source preparers serialize their configured version without ambient build settings", async () => {
  const calls: NativeCompilerSpawnInput[] = [];
  const spawn = (input: NativeCompilerSpawnInput) => { calls.push(input); return { exitCode: 0, stdout: JSON.stringify({ status: "unavailable", detail: "transport inspected" }), stderr: "", error: null }; };
  const environment = () => ({ ...process.env, AIDLC_BUILD_VERSION: "ambient-invalid", AIDLC_TIER_CAP: "ambient-invalid" });
  const request = { sourceRoot, root: join(tmpdir(), "profile-transport"), basis, binding, invocation: "bun .claude/tools/aidlc.ts", mode: 0o644 };
  for (const buildVersion of [preview, AIDLC_VERSION, undefined, preview]) {
    await createSourceRuntimeModulePreparer({ ...(buildVersion === undefined ? {} : { buildVersion }), operations: { ...createSourceRuntimeModuleOperations(), spawn, environment } }).prepare(request);
    await createSourceDescriptionPreparer({ ...(buildVersion === undefined ? {} : { buildVersion }), operations: { ...createSourceDescriptionOperations(), spawn, environment } }).prepare({ ...request, files: [], directories: [] });
  }
  expect(calls).toHaveLength(8);
  for (const [index, call] of calls.entries()) {
    expect(JSON.parse(call.input).buildVersion).toBe([preview, AIDLC_VERSION, undefined, preview][Math.floor(index / 2)]);
    expect(call.env.AIDLC_BUILD_VERSION).toBeUndefined();
    expect(call.env.AIDLC_TIER_CAP).toBeUndefined();
  }
});

test("actual runtime preparation stamps repeated explicit profiles and ignores ambient versions", async () => {
  const root = mkdtempSync(join(tmpdir(), "projection-profile-modules-"));
  try {
    const operations = createSourceRuntimeModuleOperations();
    const isolated = { ...operations, environment: () => ({ ...operations.environment(), AIDLC_BUILD_VERSION: "ambient-invalid", AIDLC_TIER_CAP: "ambient-invalid" }) };
    const request = { sourceRoot, root, basis, binding, invocation: "bun .claude/tools/aidlc.ts", mode: 0o644 };
    for (const buildVersion of [preview, AIDLC_VERSION, undefined, preview]) {
      const prepared = await createSourceRuntimeModulePreparer({ binary: process.execPath, ...(buildVersion === undefined ? {} : { buildVersion }), operations: isolated }).prepare(request);
      if (prepared.status === "invalid") throw new Error(JSON.stringify(prepared.findings));
      const version = prepared.value.files.find(file => file.path === ".claude/tools/aidlc-version.ts");
      expect(version).toBeDefined();
      expect(new TextDecoder().decode(version?.bytes)).toContain(`export const AIDLC_VERSION = "${buildVersion ?? AIDLC_VERSION}";`);
      expect(prepared.value.preparation.inputs.some(input => input.path === "core/tools/aidlc-channel.ts")).toBe(true);
    }
    const refused = await createSourceRuntimeModulePreparer({ binary: process.execPath, buildVersion: "bad-version", operations: isolated }).prepare(request);
    expect(refused.status).toBe("invalid");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}, 30000);

for (const change of [{ buildVersion: undefined }, { buildVersion: null }, { buildVersion: 3 }, { buildVersion: "" }, { environmentCap: undefined }, { environmentCap: "invalid" }]) {
  test(`the copy boundary refuses malformed profile JSON ${JSON.stringify(change)}`, async () => {
    await expect(projectClaudeCopy({ sourceRoot: "unused-source", outRoot: "unused-output", buildVersion: AIDLC_VERSION, environmentCap: null, ...change } as never)).rejects.toBeInstanceOf(ZodError);
  });
}
