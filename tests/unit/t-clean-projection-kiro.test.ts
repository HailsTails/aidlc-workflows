// covers: file:harness/kiro/settings.ts, file:scripts/projection/src/adapters/source-kiro-preparation.ts, file:scripts/projection/src/adapters/core-kiro-agents.ts, file:scripts/projection/src/adapters/kiro-agent.ts
import { expect, test } from "bun:test";
import { readFileSync, mkdtempSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { readSourceKiroPreparation, admitKiroSourcePreparation } from "../../scripts/projection/src/adapters/source-kiro-preparation.ts";
import { parseKiroAgentProfile, prepareKiroAgentProfile } from "../../scripts/projection/src/adapters/kiro-agent.ts";
import { qualifiedHarnessByName } from "../../scripts/projection/src/adapters/qualified-harness-profile.ts";
import { usesRetainedProjection } from "../../scripts/projection-process.ts";
import { createSourceHarnessSettingsPreparer } from "../../scripts/projection/src/adapters/source-harness-settings.ts";
import { createOnboardingPreparer } from "../../scripts/projection/src/adapters/onboarding-source.ts";
import { copyChannelToolScripts } from "../../core/tools/aidlc.ts";
const sourceRoot = resolve(import.meta.dir, "../..");
const origin = { source: { kind: "core", id: "framework" }, pin: "a".repeat(40), path: "harness/kiro/agents/aidlc-developer-agent.json" } as const;
const binding = { harness: "kiro", directory: ".kiro" } as const;
const basis = { source: origin.source, pin: origin.pin };
const authored = () => JSON.parse(readFileSync(join(sourceRoot, origin.path), "utf8"));

test("the agent-v1 producer is explicitly qualified without admitting the shared-directory V3 host", () => {
  expect(usesRetainedProjection({ name: "kiro", harnessDir: ".kiro" })).toBe(true);
  expect(usesRetainedProjection({ name: "kiro-ide", harnessDir: ".kiro" })).toBe(false);
  expect(usesRetainedProjection({ name: "kiro", harnessDir: ".other" })).toBe(false);
  const profile = qualifiedHarnessByName({ name: "kiro", harnessDir: ".kiro" })!;
  expect(profile.agentMappings).toHaveLength(14);
  expect(profile.settingsMappings).toHaveLength(5);
  expect(profile.agentKnowledgeRead).toBe("kiro-chunks");
  expect(profile.rootMappings).toEqual([{ src: "dot-gitignore", dst: ".gitignore" }]);
});

test.each(["tools", "allowedTools"])("leaf admission rejects delegation selectors in %s", (field) => {
  for (const selector of ["subagent", "@builtin/subagent", "@builtin", "invoke_sub_agent", "*"]) {
    const value = authored(); value[field].push(selector);
    expect(parseKiroAgentProfile({ text: JSON.stringify(value), origin }).status).toBe("invalid");
  }
});

test("leaf admission preserves the separate conductor contract and rejects unsupported execution fields", () => {
  expect(parseKiroAgentProfile({ text: readFileSync(join(sourceRoot, "harness/kiro/agents/aidlc.json"), "utf8"), origin }).status).toBe("invalid");
  for (const extra of [{ model: "other" }, { effort: "max" }, { unknown: true }]) expect(parseKiroAgentProfile({ text: JSON.stringify({ ...authored(), ...extra }), origin }).status).toBe("invalid");
  const value = authored(); value.toolsSettings.execute_bash.allowedCommands = [".*"];
  const profile = parseKiroAgentProfile({ text: JSON.stringify(value), origin });
  expect(profile.status).toBe("ok");
  if (profile.status === "ok") expect(prepareKiroAgentProfile({ profile: profile.value, shellCommands: ["aidlc engine .*"], sharedResources: [], invocation: "aidlc", hookSuffix: "; exit $LASTEXITCODE" }).status).toBe("invalid");
});

test.each(["bun .kiro/tools/aidlc.ts", "aidlc"])("source preparation owns Kiro JSON, settings, hooks, MCP and witnesses: %s", async (invocation) => {
  const prepared = readSourceKiroPreparation({ sourceRoot, workRoot: mkdtempSync(join(tmpdir(), "kiro-policy-test-")), invocation, binary: process.execPath });
  expect(prepared.status, JSON.stringify(prepared)).toBe("ok");
  if (prepared.status !== "ok") return;
  expect(prepared.value.agents).toHaveLength(14);
  expect(prepared.value.shellCommands).toHaveLength(invocation === "aidlc" ? 42 : 71);
  expect(prepared.value.inputs.some(input => input.path === "harness/kiro/settings.ts")).toBe(true);
  for (const path of ["core/tools/aidlc.ts", "core/tools/aidlc-tiers.ts", "core/tools/aidlc-model-policy.ts", "core/tools/aidlc-inline-context.ts", origin.path]) expect(prepared.value.inputs.some(input => input.path === path)).toBe(true);
  const conductor = JSON.parse(prepared.value.settings.find(file => file.path.endsWith("/agents/aidlc.json"))!.text);
  const hooks = Object.values(conductor.hooks).flat() as { command: string }[];
  expect(hooks).toHaveLength(15);
  expect(hooks.every(hook => hook.command.endsWith("; exit $LASTEXITCODE"))).toBe(true);
  expect(conductor.includeMcpJson).toBe(true);
  expect(conductor.toolsSettings.subagent.trustedAgents).toHaveLength(14);
  const mcp = JSON.parse(prepared.value.settings.find(file => file.path.endsWith("/settings/mcp.json"))!.text);
  expect(Object.values(mcp.mcpServers)).toHaveLength(5);
  expect(Object.values(mcp.mcpServers).every((server: unknown) => (server as { disabled: boolean }).disabled)).toBe(true);
  const root = mkdtempSync(join(tmpdir(), "kiro-settings-"));
  const settings = await createSourceHarnessSettingsPreparer({ binary: process.execPath }).prepare({ sourceRoot, root, basis, binding, invocation, files: ["aidlc.ts", ...copyChannelToolScripts()].map(script => `.kiro/tools/${script}`), mode: 0o644 });
  expect(settings.status).toBe("ok");
  const onboarding = await createOnboardingPreparer({ binary: process.execPath }).prepare({ sourceRoot, workRoot: root, basis, context: { ...binding, invocation, rulesSubdir: "steering", optionLetters: "A-E" } });
  expect(onboarding.status).toBe("ok");
  if (onboarding.status === "ok") expect(onboarding.value.documents.map(document => document.destination)).toEqual(["AGENTS.md", ".kiro/steering/aidlc-onboarding.md"]);
});

test("settings refuse a missing tool authority and a working root inside source", async () => {
  const prepare = createSourceHarnessSettingsPreparer({ binary: process.execPath });
  const request = { sourceRoot, root: mkdtempSync(join(tmpdir(), "kiro-refusal-")), basis, binding, invocation: "aidlc", files: [".kiro/tools/aidlc.ts"], mode: 0o644 };
  expect((await prepare.prepare(request)).status).toBe("invalid");
  expect((await prepare.prepare({ ...request, root: sourceRoot })).status).toBe("invalid");
});

test("helper evidence refuses missing, unrelated, unsafe, duplicated and stale source witnesses", () => {
  const prepared = readSourceKiroPreparation({ sourceRoot, workRoot: mkdtempSync(join(tmpdir(), "kiro-evidence-")), invocation: "aidlc", binary: process.execPath });
  expect(prepared.status).toBe("ok");
  if (prepared.status !== "ok") return;
  const input = prepared.value;
  expect(admitKiroSourcePreparation(input, input.inputs).status).toBe("ok");
  for (const path of [origin.path, "core/tools/aidlc-tiers.ts", "harness/kiro/settings.ts", input.inputs.find(input => input.path.startsWith("core/knowledge/aidlc-shared/"))!.path]) expect(admitKiroSourcePreparation({ ...input, inputs: input.inputs.filter(input => input.path !== path) }, input.inputs).status).toBe("invalid");
  for (const path of ["unrelated.md", "../escape.md", input.inputs[1]!.path]) expect(admitKiroSourcePreparation({ ...input, inputs: [{ ...input.inputs[0], path }, ...input.inputs.slice(1)] }, input.inputs).status).toBe("invalid");
  expect(admitKiroSourcePreparation({ ...input, inputs: [{ ...input.inputs[0], sha256: "b".repeat(64) }, ...input.inputs.slice(1)] }, input.inputs).status).toBe("invalid");
});

test("the explicit isolated workspace does not depend on TEMP or TMP environment variables", () => {
  const inherited = Object.fromEntries(Object.entries(process.env).filter(([key]) => !["TEMP", "TMP", "TMPDIR"].includes(key.toUpperCase())));
  expect(readSourceKiroPreparation({ sourceRoot, workRoot: mkdtempSync(join(tmpdir(), "kiro-no-temp-")), invocation: "aidlc", inherited, binary: process.execPath }).status).toBe("ok");
});
