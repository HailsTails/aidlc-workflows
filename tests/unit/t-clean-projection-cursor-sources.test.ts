// covers: file:scripts/cursor-settings.ts, file:scripts/projection/src/adapters/source-harness-settings.ts, file:scripts/projection/src/adapters/onboarding-source.ts
import { expect, test } from "bun:test";
import { selectHarnessDocumentProducts } from "../../scripts/projection/examples/harness-document-products.ts";
import {
  prepareOnboardingProducts,
  createOnboardingProductServices,
} from "../../scripts/projection/examples/onboarding-products.ts";
import { copyFileSync, mkdirSync, mkdtempSync, appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { createSourceHarnessSettingsPreparer } from "../../scripts/projection/src/adapters/source-harness-settings.ts";
import { createSourceRuntimeModulePreparer } from "../../scripts/projection/src/adapters/source-runtime-modules.ts";
import { createOnboardingPreparer, onboardingSourcePaths } from "../../scripts/projection/src/adapters/onboarding-source.ts";
import { createHarnessDocumentSourceReader } from "../../scripts/projection/src/adapters/harness-document-sources.ts";
import { createHarnessDocumentPreparer } from "../../scripts/projection/src/adapters/harness-document-preparation.ts";
import { prepareCursorCopyAllowList, prepareCursorNativeAllowList } from "../../scripts/cursor-settings.ts";
import { copyChannelDispatcherCommands, copyChannelToolScripts } from "../../core/tools/aidlc.ts";
import { cursorTrustedShell, trustedCommand } from "../../core/tools/aidlc-command.ts";
const sourceRoot = resolve(import.meta.dir, "../..");
const basis = { source: { kind: "core", id: "framework" }, pin: "a".repeat(40) } as const;
const binding = { harness: "cursor", directory: ".cursor" } as const;
const files = ["aidlc.ts", ...copyChannelToolScripts()].map((name) => `.cursor/tools/${name}`);
const authority = {
  dispatcherCommands: copyChannelDispatcherCommands,
  toolScripts: copyChannelToolScripts,
  trustedShell: cursorTrustedShell,
};
test("Cursor permission preparation keeps exact source authority and authored non-Bun entries", () => {
  const allow = ["Shell(bun:.cursor/tools/aidlc.ts engine *)", "Shell(bun:.cursor/tools/aidlc-*)"];
  expect(prepareCursorCopyAllowList({ allow, authority })).toMatchObject({ kind: "prepared" });
  const copy = prepareCursorCopyAllowList({ allow, authority });
  const native = prepareCursorNativeAllowList({ allow, authority });
  if (copy.kind !== "prepared" || native.kind !== "prepared") throw new Error("preparation refused");
  expect(copy.allow).toHaveLength(100);
  expect(native.allow).toHaveLength(42);
  expect(prepareCursorCopyAllowList({ allow: [], authority }).kind).toBe("refused");
  expect(prepareCursorNativeAllowList({ allow: ["Read(*)", ...allow], authority })).toMatchObject({
    kind: "prepared",
    allow: [
      "Read(*)",
      cursorTrustedShell(),
      ...copyChannelDispatcherCommands().map((command) => `Shell(aidlc:${command})`),
    ],
  });
});
test.each([
  "bun .cursor/tools/aidlc.ts",
  "aidlc",
])("Cursor authored preparation retains settings, split onboarding and documents: %s", async (invocation) => {
  const root = mkdtempSync(join(tmpdir(), "cursor-source-"));
  const context = { ...binding, invocation, rulesSubdir: "rules" as const, optionLetters: "A-E" as const };
  const request = { sourceRoot, root, basis, binding, invocation, mode: 0o644, files };
  const settings = await createSourceHarnessSettingsPreparer({ binary: process.execPath }).prepare(request);
  expect(settings.status, JSON.stringify(settings.status === "invalid" ? settings.findings : [])).toBe("ok");
  if (settings.status !== "ok") return;
  const hooks = JSON.parse(
    new TextDecoder().decode(settings.value.files.find((file) => file.path.endsWith("hooks.json"))!.bytes),
  );
  const cli = JSON.parse(
    new TextDecoder().decode(settings.value.files.find((file) => file.path.endsWith("cli.json"))!.bytes),
  );
  expect(Object.keys(hooks.hooks)).toHaveLength(8);
  expect(Object.values(hooks.hooks).flat()).toHaveLength(9);
  expect(cli.permissions.allow).toHaveLength(invocation === "aidlc" ? 42 : 100);
  if (invocation === "aidlc")
    expect(hooks.hooks.sessionStart[0].command).toBe(trustedCommand("adapter cursor session-start"));
  const onboarding = await createOnboardingPreparer({ binary: process.execPath }).prepare({
    sourceRoot,
    workRoot: root,
    basis,
    context,
  });
  expect(onboarding.status, JSON.stringify(onboarding.status === "invalid" ? onboarding.findings : [])).toBe("ok");
  if (onboarding.status === "ok")
    expect(onboarding.value.documents.map((document) => document.destination)).toEqual([
      "AGENTS.md",
      ".cursor/rules/aidlc-onboarding.mdc",
    ]);
  const sources = await createHarnessDocumentSourceReader().load({ sourceRoot, basis, binding });
  expect(sources.status, JSON.stringify(sources.status === "invalid" ? sources.findings : [])).toBe("ok");
  if (sources.status !== "ok") return;
  const documents = await createHarnessDocumentPreparer().prepare({
    sourceRoot,
    basis,
    context,
    sources: sources.value,
  });
  expect(documents.status, JSON.stringify(documents.status === "invalid" ? documents.findings : [])).toBe("ok");
  if (documents.status === "ok") {
    expect(selectHarnessDocumentProducts({ sources: documents.value, basis, context }).status).toBe("ok");
    const first = documents.value.documents[0]!;
    for (const changed of [
      { ...first, destination: ".cursor/rules/safe-but-unowned.mdc" },
      { ...first, authored: { ...first.authored, origin: { ...first.authored.origin, path: "harness/cursor/safe-but-unowned.md" } } },
    ]) {
      expect(selectHarnessDocumentProducts({ sources: { ...documents.value, documents: [changed, ...documents.value.documents.slice(1)] }, basis, context }).status).toBe("invalid");
    }

    expect(documents.value.documents).toHaveLength(11);
    const rule = documents.value.documents.find((document) => document.authored.role === "method-import")!;
    expect(rule.text).toContain(
      invocation === "aidlc" ? "run `aidlc doctor`," : "run `bun .cursor/tools/aidlc.ts doctor` (after installing Bun",
    );
    expect(rule.authored.text).toContain("after installing Bun");
  }
  const onboardingProducts = await prepareOnboardingProducts({
    sourceRoot,
    workRoot: root,
    basis,
    context,
    services: {
      ...createOnboardingProductServices(),
      preparation: createOnboardingPreparer({ binary: process.execPath }),
    },
  });
  expect(
    onboardingProducts.status,
    JSON.stringify(onboardingProducts.status === "invalid" ? onboardingProducts.findings : []),
  ).toBe("ok");
  const runtime = await createSourceRuntimeModulePreparer({ binary: process.execPath }).prepare(request);
  expect(runtime.status, JSON.stringify(runtime.status === "invalid" ? runtime.findings : [])).toBe("ok");
  if (runtime.status === "ok")
    expect(runtime.value.files.some((file) => file.path === ".cursor/hooks/aidlc-cursor-adapter.ts")).toBe(true);
}, 30000);

test("Cursor permission authority changes flow through without widening fixed grants", () => {
  const allow = ["Shell(bun:.cursor/tools/aidlc-*)"];
  const changed = {
    dispatcherCommands: () => ["status --json"],
    toolScripts: () => ["aidlc-example.ts"],
    trustedShell: () => "Shell(aidlc:__owned *)",
  };
  expect(prepareCursorCopyAllowList({ allow, authority: changed })).toEqual({
    kind: "prepared",
    allow: [
      "Shell(bun:.cursor/tools/aidlc.ts status --json)",
      "Shell(bun:.cursor/tools/aidlc-example.ts)",
      "Shell(bun:.cursor/tools/aidlc-example.ts *)",
    ],
  });
  expect(prepareCursorNativeAllowList({ allow, authority: changed })).toEqual({
    kind: "prepared",
    allow: ["Shell(aidlc:__owned *)", "Shell(aidlc:status --json)"],
  });
});

test.each(["cursor", "codex"] as const)("%s onboarding keeps its own authored cross-reference policy", async (harness) => {
  const root = mkdtempSync(join(tmpdir(), "onboarding-reference-"));
  const fixture = join(root, "source");
  const workRoot = join(root, "work");
  mkdirSync(workRoot);
  const context = harness === "cursor"
    ? { harness, directory: ".cursor" as const, rulesSubdir: "rules" as const, invocation: "bun .cursor/tools/aidlc.ts" }
    : { harness, directory: ".codex" as const, rulesSubdir: "aidlc-rules" as const, invocation: "bun .codex/tools/aidlc.ts" };
  for (const path of onboardingSourcePaths({ invocation: context.invocation, harness })) {
    const destination = join(fixture, path);
    mkdirSync(dirname(destination), { recursive: true });
    copyFileSync(join(sourceRoot, path), destination);
  }
  if (harness === "codex") {
    // This fixture exercises onboarding, not Codex's unrelated full-tree emitter.
    const manifest = join(fixture, "harness/codex/manifest.ts");
    writeFileSync(manifest, readFileSync(manifest, "utf8").replace('import emit from "./emit.ts";', "const emit = null;"));
  }
  appendFileSync(join(fixture, "core/templates/onboarding-harness.md"), "\nAuthored cross-reference: .codex/skills/cross-reference/SKILL.md\n");
  const prepared = await createOnboardingPreparer({ binary: process.execPath }).prepare({ sourceRoot: fixture, workRoot, basis, context });
  expect(prepared.status, JSON.stringify(prepared.status === "invalid" ? prepared.findings : [])).toBe("ok");
  if (prepared.status !== "ok") return;
  const native = prepared.value.documents[1]!;
  const expected = harness === "cursor" ? ".codex/skills/cross-reference/SKILL.md" : ".agents/skills/cross-reference/SKILL.md";
  expect(native.text).toContain(expected);
  expect(native.authored.text).toContain(expected);
  expect(native.text).not.toContain(harness === "cursor" ? ".agents/skills/cross-reference/SKILL.md" : ".codex/skills/cross-reference/SKILL.md");
});
