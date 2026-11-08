import { afterEach, expect, test } from "bun:test";
import { parse } from "smol-toml";
import { codexHookTrustHash } from "../../core/tools/aidlc-command.ts";
import { createSourceModuleFixtures } from "../../tests/harness/source-module-fixture.ts";
import { createSourceHarnessSettingsPreparer } from "../../scripts/projection/src/adapters/source-harness-settings.ts";
import type { HarnessSettingsRequest } from "../../scripts/projection/src/domain/harness-settings.ts";
import pinned from "./fixtures/settings93a.json";

const fixtures = createSourceModuleFixtures();
afterEach(fixtures.cleanup);

test("changing the authored target changes wiring and canonical trust together", async () => {
  const root = fixtures.create(["harness/codex", "core/tools"]);
  fixtures.change({ root, relative: "harness/codex/hook-plan.ts", before: 'target: "session-start"', after: 'target: "changed-session-start"' });
  const settings = await fixtures.load({ root, relative: "harness/codex/settings.ts" });
  const prepared = settings.prepareCodexSettings({ binding: { harnessDir: ".codex", harnessName: "codex", invoke: "aidlc", trustedNamespace: "engine" }, onboarding: pinned.cases[0]!.onboarding, toolScripts: pinned.toolScripts });
  const hooks = JSON.parse(prepared.hooksJson);
  expect(hooks.hooks.SessionStart[0].hooks[0]).toEqual({ type: "command", command: "aidlc engine adapter codex changed-session-start", timeout: 1800 });
  expect(parse(prepared.trustSeed)).toHaveProperty(['hooks', 'state', '<PROJECT_DIR>/.codex/hooks.json:session_start:0:0', 'trusted_hash'], codexHookTrustHash("session_start", "aidlc engine adapter codex changed-session-start", 1800));
  expect(prepared.trustSeed).not.toBe(pinned.cases[0]!.trustSeed);
  expect(prepared.configToml).toBe(pinned.cases[0]!.configToml);
  expect(prepared.defaultRules).toBe(pinned.cases[0]!.defaultRules);
});

const request: Omit<HarnessSettingsRequest, "sourceRoot" | "root"> = { basis: { source: { kind: "core", id: "framework" }, pin: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" }, binding: { harness: "codex", directory: ".codex" }, invocation: "aidlc", mode: 420, onboarding: pinned.cases[0]!.onboarding, files: pinned.preparedFiles };

test.each(pinned.cases)("selected source emits all four exact artifacts and witnesses each new dependency: $invoke", async sample => {
  const sourceRoot = fixtures.create(["harness/codex", "core/tools", "scripts"]);
  const root = fixtures.create([]);
  const prepared = await createSourceHarnessSettingsPreparer({ binary: process.execPath }).prepare({ ...request, sourceRoot, root, invocation: sample.invoke });
  expect(prepared).toMatchObject({ status: "ok", value: { files: [
    { path: ".codex/hooks.json", bytes: new TextEncoder().encode(sample.hooksJson), mode: 420 },
    { path: ".codex/config.toml", bytes: new TextEncoder().encode(sample.configToml), mode: 420 },
    { path: ".codex/rules/default.rules", bytes: new TextEncoder().encode(sample.defaultRules), mode: 420 },
    { path: ".codex/trust-seed.toml", bytes: new TextEncoder().encode(sample.trustSeed), mode: 420 },
  ] } });
  expect(prepared).toHaveProperty(["value", "preparation", "inputs", "length"], 11);
  expect(prepared).toHaveProperty(["value", "preparation", "inputs"], expect.arrayContaining([
    { path: "harness/codex/hook-plan.ts", sha256: new Bun.CryptoHasher("sha256").update(fixtures.read({ root: sourceRoot, relative: "harness/codex/hook-plan.ts" })).digest("hex") },
    { path: "harness/codex/trust-path.ts", sha256: new Bun.CryptoHasher("sha256").update(fixtures.read({ root: sourceRoot, relative: "harness/codex/trust-path.ts" })).digest("hex") },
  ]));
});

test.each(["harness/codex/hook-plan.ts", "harness/codex/trust-path.ts"])("selected-source freshness refuses a new dependency changed during evaluation: %s", async relative => {
  const sourceRoot = fixtures.create(["harness/codex", "core/tools", "scripts"]);
  const root = fixtures.create([]);
  const original = fixtures.read({ root: sourceRoot, relative });
  fixtures.write({ root: sourceRoot, relative, text: 'await Bun.write(import.meta.path, await Bun.file(import.meta.path).text() + "\\n// evaluation mutation");\n' + original });
  const prepared = await createSourceHarnessSettingsPreparer({ binary: process.execPath }).prepare({ ...request, sourceRoot, root });
  expect(prepared).toMatchObject({ status: "invalid", findings: [{ code: "capability-gap", detail: "harness settings source changed during preparation" }] });
});

test("selected source refuses an absent dispatcher capability", async () => {
  const sourceRoot = fixtures.create(["harness/codex", "core/tools", "scripts"]);
  const root = fixtures.create([]);
  const prepared = await createSourceHarnessSettingsPreparer({ binary: process.execPath }).prepare({ ...request, sourceRoot, root, files: [".codex/tools/aidlc.ts"] });
  expect(prepared).toMatchObject({ status: "invalid", findings: [{ code: "capability-gap", detail: "Codex settings require every declared preapproved tool" }] });
});
