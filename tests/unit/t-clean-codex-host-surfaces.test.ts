// covers: file:harness/codex/settings.ts, file:scripts/native-runtime-text.ts
import { expect, mock, test } from "bun:test";
import { parse } from "smol-toml";
import { emitConfigToml, emitHooksJson, emitTrustSeed, emitDefaultRules } from "../../harness/codex/settings.ts";
import { codexHookTrustHash, TRUSTED_ROUTE_NAMESPACE } from "../../core/tools/aidlc-command.ts";
import { prepareClaudeNativeRuntimeText, prepareNativeRuntimeText } from "../../scripts/native-runtime-text.ts";
import { createSourceHarnessSettingsPreparer } from "../../scripts/projection/src/adapters/source-harness-settings.ts";

test.each(["aidlc", "bun .codex/tools/aidlc.ts"])("Codex trust hashes match every final command: %s", invoke => {
  const hooks = JSON.parse(emitHooksJson(value => value.replace("{{INVOKE}}", invoke), "codex", TRUSTED_ROUTE_NAMESPACE)).hooks;
  const state = (parse(emitTrustSeed(".codex", "codex", invoke, TRUSTED_ROUTE_NAMESPACE)) as { hooks: { state: Record<string, { trusted_hash: string }> } }).hooks.state;
  let count = 0;
  for (const [event, groups] of Object.entries(hooks)) {
    const snake = event.replace(/[A-Z]/g, (letter, index) => (index ? "_" : "") + letter.toLowerCase());
    for (const [index, group] of (groups as Array<{ matcher?: string; hooks: Array<{ command: string; timeout: number }> }>).entries()) {
      const hook = group.hooks[0]!;
      expect(state[`<PROJECT_DIR>/.codex/hooks.json:${snake}:${index}:0`]!.trusted_hash).toBe(codexHookTrustHash(snake, hook.command, hook.timeout, group.matcher));
      expect(hook.command.startsWith(invoke + " ")).toBe(true);
      count++;
    }
  }
  expect(count).toBe(11);
  expect(Object.keys(state)).toHaveLength(11);
});

test("Codex config embeds the exact prepared onboarding", () => {
  const onboarding = "# Onboarding\n\nUse .agents/skills/aidlc/.\n";
  expect(parse(emitConfigToml(onboarding)).developer_instructions).toBe(onboarding);
  expect(() => emitConfigToml("''' delimiter")).toThrow();
});

test("Codex native policy does not apply Claude statusline substitutions", () => {
  const source = "bun .claude/hooks/aidlc-statusline.ts and bun .codex/tools/aidlc.ts status";
  expect(prepareNativeRuntimeText(source, ".codex")).toBe("bun .claude/hooks/aidlc-statusline.ts and aidlc engine status");
  expect(prepareNativeRuntimeText(source, ".claude")).toBe(prepareClaudeNativeRuntimeText(source));
  expect(() => prepareNativeRuntimeText(source, ".unknown")).toThrow();
  expect(prepareNativeRuntimeText("bun .codex/hooks/aidlc-codex-adapter.ts session-start", ".codex")).toBe("aidlc engine adapter codex session-start");
});

test("Codex permission rules distinguish binary and copy capabilities", () => {
  expect(emitDefaultRules(".codex", "aidlc", TRUSTED_ROUTE_NAMESPACE)).toContain('pattern = ["aidlc", "engine"]');
  expect(emitDefaultRules(".codex", "bun .codex/tools/aidlc.ts", TRUSTED_ROUTE_NAMESPACE)).toContain('pattern = ["bun", ".codex/tools/aidlc.ts", "engine"]');
});

test("Codex settings refuse missing shared onboarding before spawning", async () => {
  const spawn = mock(() => { throw new Error("unexpected spawn"); });
  const result = await createSourceHarnessSettingsPreparer({ operations: { spawn, environment: () => ({}), paths: () => ({ sourceRoot: "/source", root: "/work" }) } }).prepare({ sourceRoot: "/source", root: "/work", basis: { source: { kind: "core", id: "framework" }, pin: "a".repeat(40) }, binding: { harness: "codex", directory: ".codex" }, invocation: "aidlc", mode: 420, files: [".codex/tools/aidlc.ts"] });
  expect(result.status).toBe("invalid");
  expect(spawn).not.toHaveBeenCalled();
});

import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createSourceRuntimeModulePreparer } from "../../scripts/projection/src/adapters/source-runtime-modules.ts";

test("a source hook-target change updates both wiring and canonical trust", async () => {
  const root = mkdtempSync(join(tmpdir(), "codex-settings-source-"));
  try {
    const owner = resolve(import.meta.dir, "../../harness/codex/settings.ts");
    const source = readFileSync(owner, "utf8").replaceAll('from "../../core/tools/', `from "${pathToFileURL(resolve(import.meta.dir, "../../core/tools")).href}/`).replace('from "smol-toml"', `from "${pathToFileURL(Bun.resolveSync("smol-toml", import.meta.dir)).href}"`);
    const changed = source.replace('target: "session-start"', 'target: "changed-session-start"');
    expect(changed).not.toBe(source);
    const file = join(root, "settings.ts");
    writeFileSync(file, changed);
    const settings = await import(pathToFileURL(file).href);
    const hooks = JSON.parse(settings.emitHooksJson((value: string) => value.replace("{{INVOKE}}", "aidlc"), "codex", TRUSTED_ROUTE_NAMESPACE)).hooks;
    const hook = hooks.SessionStart[0].hooks[0];
    const trust = parse(settings.emitTrustSeed(".codex", "codex", "aidlc", TRUSTED_ROUTE_NAMESPACE)) as { hooks: { state: Record<string, { trusted_hash: string }> } };
    expect(hook.command).toBe("aidlc engine adapter codex changed-session-start");
    expect(trust.hooks.state["<PROJECT_DIR>/.codex/hooks.json:session_start:0:0"]!.trusted_hash).toBe(codexHookTrustHash("session_start", hook.command, hook.timeout));
    expect(settings.emitTrustSeed(".codex", "codex", "aidlc", TRUSTED_ROUTE_NAMESPACE)).not.toBe(emitTrustSeed(".codex", "codex", "aidlc", TRUSTED_ROUTE_NAMESPACE));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Codex runtime adapter witness is mandatory and its source hash is retained", async () => {
  const paths = ["scripts/runtime-source-selection.ts", "scripts/projection/src/adapters/qualified-delivery-policy.ts", "scripts/projection-text.ts", "scripts/version-module.ts", "core/tools/aidlc-command.ts", "core/tools/aidlc-version.ts", "core/tools/aidlc-channel.ts", "scripts/native-runtime-text.ts", "scripts/native-command-context.ts", "scripts/native-command-text.ts", "core/tools/aidlc-routes.ts", "harness/codex/manifest.ts", "harness/codex/hooks/aidlc-codex-adapter.ts"];
  const request = { sourceRoot: "/source", root: "/work", basis: { source: { kind: "core", id: "framework" }, pin: "a".repeat(40) }, binding: { harness: "codex", directory: ".codex" }, invocation: "aidlc", mode: 420 } as const;
  const prepare = (adapterHash: string | null) => createSourceRuntimeModulePreparer({ operations: { environment: () => ({}), paths: () => ({ sourceRoot: "/source", root: "/work" }), spawn: () => ({ exitCode: 0, stderr: "", error: null, stdout: JSON.stringify({ status: "ok", modules: ["hooks/aidlc-codex-adapter.ts"], files: [{ file: "hooks/aidlc-codex-adapter.ts", content: "prepared adapter" }], inputs: paths.filter(path => adapterHash !== null || !path.endsWith("aidlc-codex-adapter.ts")).map(path => ({ path, sha256: path.endsWith("aidlc-codex-adapter.ts") ? adapterHash : "b".repeat(64) })) }) }) } }).prepare(request);
  expect((await prepare(null)).status).toBe("invalid");
  for (const hash of ["c".repeat(64), "d".repeat(64)]) {
    const result = await prepare(hash);
    expect(result.status).toBe("ok");
    if (result.status === "ok") expect(result.value.preparation.inputs.find(input => input.path.endsWith("aidlc-codex-adapter.ts"))!.sha256).toBe(hash);
  }
});
