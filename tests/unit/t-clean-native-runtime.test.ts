import { expect, test } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { prepareClaudeNativeRuntimeText, prepareNativeOnboardingText } from "../../scripts/native-runtime-text.ts";
import { createSourceRuntimeContextReader, createSourceRuntimeContextOperations } from "../../scripts/projection/src/adapters/source-runtime-context.ts";
import { createSourceRuntimeModulePreparer } from "../../scripts/projection/src/adapters/source-runtime-modules.ts";
import { createSourceHarnessSettingsPreparer } from "../../scripts/projection/src/adapters/source-harness-settings.ts";
import { createOnboardingPreparer } from "../../scripts/projection/src/adapters/onboarding-source.ts";

const sourceRoot = join(import.meta.dir, "../..");
const basis = { source: { kind: "core", id: "framework" }, pin: "a".repeat(40) } as const;
const binding = { harness: "claude", directory: ".claude" } as const;

test("native hooks and escaped JSON dispatchers retain command boundaries", () => {
  expect(prepareClaudeNativeRuntimeText(JSON.stringify({ command: 'bun "$CLAUDE_PROJECT_DIR/.claude/tools/aidlc.ts" engine statusline' }))).toBe(JSON.stringify({ command: "aidlc engine statusline" }));
  expect(prepareClaudeNativeRuntimeText('bun ".claude/hooks/aidlc-statusline.ts"')).toBe("aidlc engine statusline");
  expect(prepareClaudeNativeRuntimeText('bun .claude/hooks/aidlc-session-start.ts')).toBe("aidlc engine hook session-start");
  expect(prepareClaudeNativeRuntimeText('bun .claude/tools/aidlc-state.ts')).toBe("aidlc engine state");
});
test("native onboarding describes the installed runtime and bounded permissions", () => {
  const text = prepareNativeOnboardingText("- **bun**: old\n- **Hook permissions**: old\n- **Permissions**: old", true);
  expect(text).toContain("self-contained `aidlc` binary");
  expect(text).toContain("everything else prompts");
  expect(text).not.toContain("**bun**");
});
test("actual native context, modules, settings and onboarding share explicit delivery", async () => {
  const root = mkdtempSync(join(tmpdir(), "native-runtime-"));
  try {
    const request = { sourceRoot, root, basis, binding, mode: 0o644, invocation: "aidlc" };
    const context = await createSourceRuntimeContextReader({ mode: 0o644, binary: process.execPath, delivery: "native" }).load({ location: { sourceRoot, root, basis }, binding });
    if (context.status !== "ok") throw new Error(JSON.stringify(context.findings));
    expect(context.value.context.invocation).toBe("aidlc");
    expect(new TextDecoder().decode(context.value.files[0]?.bytes)).not.toContain("bun ");
    const modules = await createSourceRuntimeModulePreparer({ binary: process.execPath }).prepare(request);
    if (modules.status !== "ok") throw new Error(JSON.stringify(modules.findings));
    const settings = await createSourceHarnessSettingsPreparer({ binary: process.execPath }).prepare({ ...request, files: modules.value.files.map(file => file.path) });
    if (settings.status !== "ok") throw new Error(JSON.stringify(settings.findings));
    const value = JSON.parse(new TextDecoder().decode(settings.value.files[0]?.bytes));
    expect(value.permissions.allow).toHaveLength(45);
    expect(value.permissions.allow).not.toContain("Bash");
    expect(value.permissions.allow).not.toContain("Bash(aidlc *)");
    expect(JSON.stringify(value.hooks)).not.toContain("bun ");
    const hooks = Object.values(value.hooks).flatMap((groups: unknown) => (groups as Array<{ hooks: Array<{ command: string }> }>).flatMap(group => group.hooks));
    expect(hooks).toHaveLength(17);
    expect(hooks.every(hook => hook.command.startsWith("aidlc engine "))).toBe(true);
    const onboarding = await createOnboardingPreparer({ binary: process.execPath }).prepare({ sourceRoot, workRoot: root, basis, context: { ...binding, invocation: "aidlc", rulesSubdir: "rules" } });
    if (onboarding.status !== "ok") throw new Error(JSON.stringify(onboarding.findings));
    expect(onboarding.value.documents[0]?.text).toContain("self-contained `aidlc` binary");
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 30000);

test("context transport binds explicit delivery and refuses incomplete native witnesses", async () => {
  const calls: string[] = [];
  const operations = createSourceRuntimeContextOperations();
  const controlled = { ...operations, spawn: (request: Parameters<typeof operations.spawn>[0]) => {
    const input = JSON.parse(request.input);
    calls.push(input.delivery);
    return { exitCode: 0, error: null, stderr: "", stdout: JSON.stringify({ status: "ok", descriptor: { schemaVersion: 1, distribution: "claude", name: "claude", harnessDir: ".claude", rulesSubdir: "rules" }, invocation: "aidlc", inputs: input.paths.slice(0, 4).map((path: string) => ({ path, sha256: "a".repeat(64) })) }) };
  } };
  for (const delivery of ["native", "copy", "native"] as const) {
    const result = await createSourceRuntimeContextReader({ mode: 0o644, delivery, operations: controlled }).load({ location: { sourceRoot, root: tmpdir(), basis }, binding });
    expect(result.status).toBe("invalid");
  }
  expect(calls).toEqual(["native", "copy", "native"]);
});

for (const declaration of ["copyOnly", "nativeRootIntegrations", "nativeReplacements", "changing-source"]) {
  test(`native context refuses ${declaration} before issuing a runtime artifact`, async () => {
    const fixture = mkdtempSync(join(tmpdir(), "native-context-refusal-"));
    const sourceRoot = join(fixture, "source"), root = join(fixture, "work");
    mkdirSync(root);
    const authored = { name: "claude", harnessDir: ".claude", rootIntegrations: [], harnessFiles: declaration === "copyOnly" ? [{ copyOnly: true }] : [], ...(declaration === "nativeRootIntegrations" ? { nativeRootIntegrations: [] } : {}), ...(declaration === "nativeReplacements" ? { nativeReplacements: [] } : {}) };
    const manifest = join(sourceRoot, "harness/claude/manifest.ts");
    const files: Record<string, string> = {
      "harness/claude/manifest.ts": `export default ${JSON.stringify(authored)};`,
      "harness/claude/onboarding.fills.ts": "export {};",
      "scripts/harness-runtime-data.ts": `${declaration === "changing-source" ? `import { appendFileSync } from "node:fs"; appendFileSync(${JSON.stringify(manifest)}, "\\n// changed during preparation");` : ""} export const projectHarnessRuntimeData = () => ({ schemaVersion: 1, distribution: "claude", name: "claude", harnessDir: ".claude", rulesSubdir: "rules" });`,
      "core/tools/aidlc-runtime-paths.ts": 'export const aidlcInvocation = () => "bun .claude/tools/aidlc.ts";',
      "scripts/native-runtime-text.ts": "export const prepareNativeRuntimeText = text => text;",
      "scripts/native-command-context.ts": "export {};",
      "scripts/native-command-text.ts": "export {};",
      "core/tools/aidlc-command.ts": "export {};",
      "core/tools/aidlc-routes.ts": "export {};",
      "scripts/projection/src/adapters/qualified-delivery-policy.ts": readFileSync(join(import.meta.dir, "../../scripts/projection/src/adapters/qualified-delivery-policy.ts"), "utf8"),
    };
    try {
      for (const [path, text] of Object.entries(files)) { const file = join(sourceRoot, path); mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, text); }
      const result = await createSourceRuntimeContextReader({ mode: 0o644, binary: process.execPath, delivery: "native" }).load({ location: { sourceRoot, root, basis }, binding });
      expect(result.status).toBe("invalid");
      if (result.status === "invalid") expect(result.findings[0]?.detail).toContain(declaration === "changing-source" ? "changed during preparation" : "does not admit");
    } finally { rmSync(fixture, { recursive: true, force: true }); }
  });
}
