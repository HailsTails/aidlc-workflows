import manifest from "../../harness/copilot/manifest.ts";
import { qualifyDeliveryDeclaration } from "../../scripts/projection/src/adapters/qualified-delivery-policy.ts";
// covers: file:harness/copilot/settings.ts, file:scripts/projection/src/adapters/source-copilot-settings.ts, file:scripts/projection/src/adapters/copilot-agent.ts
import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, copyFileSync, symlinkSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { prepareCopilotHooks, prepareCopilotLauncher, copilotLegacyRootText } from "../../harness/copilot/settings.ts";
import { prepareNativeRuntimeText, prepareNativeOnboardingText } from "../../scripts/native-runtime-text.ts";
import { qualifiedHarnessProfile, qualifiedDeliveryContext } from "../../scripts/projection/src/adapters/qualified-harness-profile.ts";
import { observeCopilotSettingsInputs, verifyCopilotProductionInputs } from "../../scripts/projection/src/adapters/copilot-source-contract.ts";
import { admitCopilotSettings, prepareSourceCopilotSettings } from "../../scripts/projection/src/adapters/source-copilot-settings.ts";
import { createCopilotAgentEmitter } from "../../scripts/projection/src/adapters/copilot-agent.ts";
import { parseAgentSource } from "../../scripts/projection/src/adapters/agent-source.ts";
const sourceRoot = join(import.meta.dir, "../..");
const binding = { harness: "copilot", directory: ".aidlc" } as const;
const basis = { source: { kind: "core", id: "framework" }, pin: "a".repeat(40) } as const;
const events = ["SessionStart", "UserPromptSubmit", "PreToolUse", "PostToolUse", "PreCompact", "SubagentStart", "SubagentStop", "Stop"];

test("Copilot keeps host identity, external discovery and combined root ownership distinct", () => {
  const profile = qualifiedHarnessProfile(binding)!;
  expect(profile.skillRoot).toBe(".github/skills");
  expect(profile.onboardingDestinations).toEqual(["AGENTS.md"]);
  expect(profile.projectedRootPaths).toEqual(["AGENTS.md"]);
  expect(profile.rootMappings).toContainEqual({ src: "dot-vscode-settings.json", dst: ".vscode/settings.json" });
  expect(profile.modelInvocation).toBe("native-default");
  for (const invocation of ["aidlc", "bun .aidlc/tools/aidlc.ts"]) expect(qualifiedDeliveryContext({ ...binding, invocation })).toBe(true);
  expect(qualifiedHarnessProfile({ harness: "opencode", directory: ".aidlc" })).toBeNull();
});

for (const invocation of ["aidlc", "bun .aidlc/tools/aidlc.ts"] as const) test(`Copilot hook and launcher products preserve ${invocation}`, () => {
  const value = JSON.parse(prepareCopilotHooks(invocation));
  expect(value.version).toBe(1); expect(Object.keys(value.hooks)).toEqual(events);
  for (const event of events) {
    expect(value.hooks[event]).toHaveLength(1);
    const hook = value.hooks[event][0];
    expect(Object.keys(hook)).toEqual(["type", "bash", "powershell", "timeoutSec"]);
    expect(hook.bash).toBe(hook.powershell);
    expect(hook.timeoutSec).toBe(["PostToolUse", "Stop"].includes(event) ? 3600 : 1800);
    expect(hook.bash.startsWith(invocation === "aidlc" ? "aidlc engine adapter copilot " : "bun .aidlc/hooks/aidlc-copilot-adapter.ts ")).toBe(true);
  }
  expect(prepareCopilotLauncher(invocation)).toBe(`#!/bin/sh\nexport AIDLC_ENGINE_LAUNCHER="$0"\nexec ${invocation} engine "$@"\n`);
});

test("native adapter identity is not inferred from the shared .aidlc directory", () => {
  expect(prepareNativeRuntimeText("bun .aidlc/hooks/aidlc-copilot-adapter.ts session-start", ".aidlc", "copilot")).toBe("aidlc engine adapter copilot session-start");
  expect(() => prepareNativeRuntimeText("content", ".aidlc", "opencode")).toThrow();
});

test("Copilot native discovery keeps authored body and ordered tool policy apart from compiled engine knowledge", () => {
  const input = { origin: { ...basis, path: "core/agents/aidlc-review-agent.md" }, binding, name: "aidlc-review-agent", description: "Review", frontmatter: "name: aidlc-review-agent\ndisallowedTools: Task\ntier: judgment\nmaxTurns: 17", body: "Compiled review knowledge", authoredBody: "Authored persona", preflight: "Read first", nativeModel: { model: null, effort: null }, policy: { tools: { kind: "inherit" }, turnLimit: 17, ambientInstructions: "inherit" } } as const;
  const result = createCopilotAgentEmitter().emit(input);
  expect(result.status).toBe("ok"); if (result.status !== "ok") return;
  const discovery = result.value.find(file => file.path.startsWith(".github/"))!.body;
  const engine = result.value.find(file => file.path.startsWith(".aidlc/"))!.body;
  expect(discovery).toContain('tools: ["read", "edit", "search", "execute", "web", "todo"]\nmaxTurns: 17');
  expect(discovery).toContain("Authored persona"); expect(discovery).not.toContain("Compiled review knowledge"); expect(discovery).not.toContain("disallowedTools:");
  expect(engine).toContain("disallowedTools: Task"); expect(engine).toContain("Compiled review knowledge");
  expect(createCopilotAgentEmitter().emit({ ...input, nativeModel: { model: "unsupported", effort: null } }).status).toBe("invalid");
});

test("retained source admission deliberately refuses absent or unrepresentable leaf denial", () => {
  const path = "core/agents/aidlc-developer-agent.md", text = readFileSync(join(sourceRoot, path), "utf8");
  expect(parseAgentSource({ text, origin: { ...basis, path } }).status).toBe("ok");
  for (const changed of [text.replace("disallowedTools: Task\n", ""), text.replace("disallowedTools: Task", "disallowedTools: Task, WebSearch")]) expect(parseAgentSource({ text: changed, origin: { ...basis, path } }).status).toBe("invalid");
});

test("historical root signature is prepared independently from final native onboarding", () => {
  const text = copilotLegacyRootText(readFileSync(join(sourceRoot, "core/templates/onboarding.md"), "utf8"), readFileSync(join(sourceRoot, "core/templates/onboarding-harness.md"), "utf8"));
  expect(text).toContain("**bun**:"); expect(text).toContain(".github/skills/"); expect(text).not.toContain(".aidlc/skills/");
  expect(prepareNativeOnboardingText(text, true)).not.toBe(text);
  const paths = observeCopilotSettingsInputs(sourceRoot).map(input => input.path);
  for (const path of ["harness/copilot/settings.ts", "harness/copilot/manifest.ts", "harness/copilot/onboarding.fills.ts", "core/tools/aidlc-launcher-voucher.ts", "core/tools/aidlc-runtime-budget.ts", "core/templates/onboarding.md", "core/templates/onboarding-harness.md"]) expect(paths).toContain(path);
});

test("source evidence must match exact independently observed paths and hashes", () => {
  const expected = [{ path: "harness/copilot/settings.ts", sha256: "a".repeat(64) }];
  const valid = { text: "{}", launcher: "launcher", inputs: expected };
  expect(admitCopilotSettings(valid, expected, 0o644).status).toBe("ok");
  for (const inputs of [[], [...expected, ...expected], [{ path: "../escape", sha256: "a".repeat(64) }], [{ ...expected[0]!, sha256: "b".repeat(64) }], [...expected, { path: "other", sha256: "b".repeat(64) }]]) expect(admitCopilotSettings({ ...valid, inputs }, expected, 0o644).status).toBe("invalid");
});

function fixture() {
  const outer = mkdtempSync(join(tmpdir(), "copilot-source-policy-")), source = join(outer, "source"), root = join(outer, "work");
  mkdirSync(source); mkdirSync(root);
  for (const input of observeCopilotSettingsInputs(sourceRoot)) { const file = join(source, input.path); mkdirSync(dirname(file), { recursive: true }); copyFileSync(join(sourceRoot, input.path), file); }
  return { outer, source, root, request: { sourceRoot: source, root, basis, binding, mode: 0o644, invocation: "aidlc", files: [".aidlc/hooks/aidlc-copilot-adapter.ts"] } };
}

test("actual fresh Copilot source process is A/B/A at the same root with matching witnesses", () => {
  const f = fixture();
  try {
    const file = join(f.source, "harness/copilot/settings.ts"), original = readFileSync(file, "utf8"), modified = original.replace('["SessionStart", "session-start", 1]', '["SessionStart", "session-start", 2]');
    expect(modified).not.toBe(original);
    for (const source of [original, modified, original]) {
      writeFileSync(file, source);
      const prepared = prepareSourceCopilotSettings(f.request, process.execPath);
      if (prepared.status !== "ok") throw new Error(JSON.stringify(prepared.findings));
      expect(JSON.parse(new TextDecoder().decode(prepared.value.files[0]!.bytes)).hooks.SessionStart[0].timeoutSec).toBe(source === modified ? 3600 : 1800);
      expect(prepared.value.preparation.inputs).toEqual(observeCopilotSettingsInputs(f.source)); expect(readdirSync(f.root)).toEqual([]);
    }
  } finally { rmSync(f.outer, { recursive: true, force: true }); }
}, 30000);

test("raw non-text settings and changes made inside preparation refuse", () => {
  const f = fixture();
  try {
    const file = join(f.source, "harness/copilot/settings.ts"), original = readFileSync(file, "utf8");
    for (const value of ['Promise.resolve("{}")', '({ toJSON: () => "{}" })', 'new Map()']) {
      const returned = original.split("\n").find(line => line.startsWith("  return ") && line.includes("JSON.stringify"))!;
      writeFileSync(file, original.replace(returned, `  return ${value};`));
      expect(readFileSync(file, "utf8")).not.toBe(original);
      expect(prepareSourceCopilotSettings(f.request, process.execPath).status).toBe("invalid");
    }
    writeFileSync(file, 'import { appendFileSync } from "node:fs";\n' + original + '\nappendFileSync(import.meta.filename, "\\n");\n');
    const changed = prepareSourceCopilotSettings(f.request, process.execPath);
    expect(changed.status).toBe("invalid"); expect(readdirSync(f.root)).toEqual([]);
  } finally { rmSync(f.outer, { recursive: true, force: true }); }
}, 30000);

test("Copilot refuses relative, overlapping, reparse and external dependency inputs", () => {
  const f = fixture();
  try {
    for (const root of ["relative", f.source, f.outer]) expect(prepareSourceCopilotSettings({ ...f.request, root }, process.execPath).status).toBe("invalid");
    const alias = join(f.outer, "alias"); symlinkSync(f.source, alias, "junction");
    expect(prepareSourceCopilotSettings({ ...f.request, sourceRoot: alias }, process.execPath).status).toBe("invalid");
    const file = join(f.source, "harness/copilot/settings.ts"), original = readFileSync(file, "utf8");
    writeFileSync(file, 'import "unwitnessed-package";\n'+original);
    expect(prepareSourceCopilotSettings(f.request, process.execPath).status).toBe("invalid");
  } finally { rmSync(f.outer, { recursive: true, force: true }); }
});

test("qualified Copilot roots cannot silently become shared or replace user editor settings", () => {
  const profile = qualifiedHarnessProfile(binding)!;
  expect(() => qualifyDeliveryDeclaration(manifest, profile)).not.toThrow();
  for (const [path, changes] of [["AGENTS.md", { shared: "identical" }], [".vscode/settings.json", { policy: "whole-file" }], [".vscode/settings.json", { optional: undefined }]] as const) {
    const candidate = { ...manifest, rootIntegrations: manifest.rootIntegrations!.map(root => root.path === path ? { ...root, ...changes } : root) };
    expect(() => qualifyDeliveryDeclaration(candidate, profile)).toThrow("Copilot requires");
  }
});

test("complete artifact witness closure refuses omission, additions, duplicates and stale hashes", () => {
  const expected = [{ path: "core/source.ts", sha256: "a".repeat(64) }];
  expect(() => verifyCopilotProductionInputs(expected, expected)).not.toThrow();
  for (const actual of [[], [...expected, ...expected], [...expected, { path: "unrelated", sha256: "a".repeat(64) }], [{ path: "core/source.ts", sha256: "b".repeat(64) }]]) expect(() => verifyCopilotProductionInputs(expected, actual)).toThrow();
});
