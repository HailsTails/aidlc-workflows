// covers: file:harness/kiro-ide/settings.ts, file:scripts/projection/src/adapters/source-kas-preparation.ts, file:scripts/projection/src/adapters/kas-source-contract.ts, file:scripts/projection/src/adapters/qualified-kas-policy.ts
import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { admitKasSourcePreparation, readSourceKasPreparation } from "../../scripts/projection/src/adapters/source-kas-preparation.ts";
import { observeKasInputs } from "../../scripts/projection/src/adapters/kas-source-contract.ts";
import { qualifiedHarnessByName } from "../../scripts/projection/src/adapters/qualified-harness-profile.ts";
import { isKasDenyBlock } from "../../scripts/projection/src/adapters/qualified-kas-policy.ts";
import { qualifyDeliveryDeclaration } from "../../scripts/projection/src/adapters/qualified-delivery-policy.ts";
import { prepareNativeNamespaceSource, nativeCommandTextProblems } from "../../scripts/native-command-text.ts";
import { createNativeCommandContext } from "../../scripts/native-command-context.ts";
import manifest from "../../harness/kiro-ide/manifest.ts";
const sourceRoot = resolve(import.meta.dir, "../..");
const workspace = () => mkdtempSync(join(tmpdir(), "kas-policy-test-"));
const profile = qualifiedHarnessByName({ name: "kiro-ide", harnessDir: ".kiro" })!;

test("V3 keeps host, layout and tier identities separate and native declarations exactly covered", () => {
  expect(profile.harness).toBe("kiro-ide"); expect(profile.tierFlavor).toBe("kiro");
  expect(profile.agentPolicyNames).toHaveLength(14); expect(profile.settingsMappings).toHaveLength(8);
  expect(() => qualifyDeliveryDeclaration(manifest, profile)).not.toThrow();
  expect(isKasDenyBlock(manifest.nativeReplacements![0]!.to)).toBe(true);
  expect(isKasDenyBlock(manifest.nativeReplacements![0]!.to.replace("effect: deny", "effect: allow"))).toBe(false);
  expect(isKasDenyBlock("description: arbitrary prose")).toBe(false);
  for (const nativeReplacements of [[], [...manifest.nativeReplacements!, manifest.nativeReplacements![0]!], [{ from: "absent", to: "other" }]]) expect(() => qualifyDeliveryDeclaration({ ...manifest, nativeReplacements }, profile)).toThrow();
  expect(() => qualifyDeliveryDeclaration({ ...manifest, frontmatterAdditions: manifest.frontmatterAdditions!.slice(1) }, profile)).toThrow();
});

test.each(["bun .kiro/tools/aidlc.ts", "aidlc"])("V3 source preparation keeps strict leaf policy, native spans and exact witnesses: %s", invocation => {
  const root = workspace();
  try {
    const result = readSourceKasPreparation({ sourceRoot, workRoot: root, invocation, binary: process.execPath });
    expect(result.status, JSON.stringify(result)).toBe("ok"); if (result.status !== "ok") return;
    const value = result.value;
    expect(value.agents).toHaveLength(14); expect(value.settings).toHaveLength(9);
    expect(value.inputs).toEqual([...observeKasInputs(sourceRoot)]);
    for (const path of ["package.json", "bun.lock", "harness/kiro-ide/delegate-shell-deny.ts", "core/hooks/aidlc-state-transition-guard.ts", "core/tools/aidlc.ts", "core/tools/aidlc-includes.ts", "core/memory/phases/construction.md"]) expect(value.inputs.some(input => input.path === path)).toBe(true);
    expect(value.settings.filter(file => /^.kiro\/hooks\/.*json$/.test(file.path))).toHaveLength(5);
    const hooks = value.settings.filter(file => /^.kiro\/hooks\/.*json$/.test(file.path)).map(file => file.text).join("\n");
    expect(hooks.includes(invocation === "aidlc" ? "aidlc engine adapter kiro-ide" : "bun .kiro/tools/aidlc.ts engine adapter kiro-ide")).toBe(true);
    const steering = value.settings.find(file => file.path === ".kiro/steering/aidlc-active-memory.md")!.text;
    expect(steering).toContain("The text of each file below");
    expect(value.settings.find(file => file.path.endsWith("agents/aidlc-aidlc.md"))!.text).toContain("invoke_sub_agent");
    expect(admitKasSourcePreparation(value, value.inputs, invocation).status).toBe("ok");
    for (const inputs of [value.inputs.slice(1), [...value.inputs, value.inputs[0]!], [{ ...value.inputs[0]!, sha256: "a".repeat(64) }, ...value.inputs.slice(1)], [{ ...value.inputs[0]!, path: "../escape.ts" }, ...value.inputs.slice(1)]]) expect(admitKasSourcePreparation({ ...value, inputs }, value.inputs, invocation).status).toBe("invalid");
    for (const namespaceLiteral of ["unrelated persona prose", invocation === "aidlc" ? null : "permissions:"]) expect(admitKasSourcePreparation({ ...value, agents: [{ ...value.agents[0]!, namespaceLiteral }, ...value.agents.slice(1)] }, value.inputs, invocation).status).toBe("invalid");
    const settings = value.settings.map(file => file.path.endsWith("plugin-agent.md") ? { ...file, text: file.text.replace('tools: ["read", "write", "shell"]', 'tools: ["read", "write", "shell", "invoke_sub_agent"]') } : file);
    expect(admitKasSourcePreparation({ ...value, settings }, value.inputs, invocation).status).toBe("invalid");
    expect(admitKasSourcePreparation({ ...value, agents: [{ ...value.agents[0]!, lines: [...value.agents[0]!.lines, "unsupported: true"] }, ...value.agents.slice(1)] }, value.inputs, invocation).status).toBe("invalid");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("explicit KAS working roots refuse relative and source-overlapping roots", () => {
  for (const workRoot of ["relative", sourceRoot, join(sourceRoot,"child")]) expect(readSourceKasPreparation({ sourceRoot, workRoot, invocation: "aidlc", binary: process.execPath }).status).toBe("invalid");
});

test("static dependency inventory witnesses a new relative module and refuses external source imports", () => {
  const root = workspace();
  try {
    for (const path of ["harness/kiro-ide/agents", "harness/kiro-ide/hooks", "harness/kiro-ide/settings", "harness/kiro-ide/steering", "core/memory"]) mkdirSync(join(root,path),{recursive:true});
    for (const path of ["package.json", "bun.lock"]) writeFileSync(join(root,path), "{}");
    const helper = join(root,"harness/kiro-ide/settings.ts");
    writeFileSync(helper, 'import "./extra.ts";'); writeFileSync(join(root,"harness/kiro-ide/extra.ts"), "export const authority = 1;");
    expect(observeKasInputs(root).some(input => input.path.endsWith("extra.ts"))).toBe(true);
    const before = observeKasInputs(root); writeFileSync(join(root,"harness/kiro-ide/extra.ts"), "export const authority = 2;"); expect(observeKasInputs(root)).not.toEqual(before);
    for (const path of ["H:/unwitnessed.ts", "file:///unwitnessed.ts", "unqualified-package", "../missing.ts"]) { writeFileSync(helper, `import "${path}";`); expect(() => observeKasInputs(root)).toThrow(); }
  } finally { rmSync(root, {recursive:true,force:true}); }
});

test("native namespace literals never bypass whole-text token or Bun validation", () => {
  const literal = '- "aidlc engine unresolvable *"';
  const source = `${literal}\nbun .kiro/tools/aidlc.ts engine next\n{{INVOKE}}`;
  const namespaceSource = prepareNativeNamespaceSource(source,[literal])!;
  expect(namespaceSource).not.toContain("unresolvable");
  const problems = nativeCommandTextProblems({ source, namespaceSource, context: createNativeCommandContext({ harnessDir: ".kiro" }), subject: "test.md" });
  expect(problems.some(problem => problem.includes("unexpanded"))).toBe(true); expect(problems.some(problem => problem.includes("bun invocation"))).toBe(true);
  expect(prepareNativeNamespaceSource(source,["absent"])).toBeNull(); expect(prepareNativeNamespaceSource(source,[literal,literal])).toBeNull(); expect(prepareNativeNamespaceSource(source+literal,[literal])).toBeNull();
});
