import { expect, test } from "bun:test";
import { parse } from "smol-toml";
import { emitConfigToml, emitDefaultRules, prepareCodexSettings, trustEntries } from "./settings.ts";
import pinned from "./fixtures/settings93a.json";

const native = { harnessDir: ".codex", harnessName: "codex", invoke: "aidlc", trustedNamespace: "engine" };

test.each(pinned.cases)("all four Codex artifacts retain the independently recorded bytes: $invoke", sample => {
  expect(prepareCodexSettings({ binding: { ...native, invoke: sample.invoke }, onboarding: sample.onboarding, toolScripts: pinned.toolScripts })).toEqual({ hooksJson: sample.hooksJson, configToml: sample.configToml, defaultRules: sample.defaultRules, trustSeed: sample.trustSeed });
});

test.each(pinned.paths)("default trust identity retains installer path semantics: $projectDir", sample => {
  expect(trustEntries({ projectDir: sample.projectDir, binding: native })).toBe(sample.trust);
});

test("explicit trust paths remain untouched", () => {
  expect(trustEntries({ projectDir: pinned.explicit.projectDir, hooksJsonPath: pinned.explicit.hooksJsonPath, binding: native })).toBe(pinned.explicit.trust);
});

test("onboarding preserves whitespace and rejects the literal delimiter", () => {
  expect(parse(emitConfigToml("# Onboarding\n\nUse .agents/skills/aidlc/.\n"))["developer_instructions"]).toBe("# Onboarding\n\nUse .agents/skills/aidlc/.\n");
  expect(() => emitConfigToml("''' delimiter")).toThrow("Codex onboarding contains the TOML multiline literal delimiter (''').");
});

test("native permission rules differ from copy dispatcher capabilities", () => {
  expect(emitDefaultRules({ binding: native, toolScripts: pinned.toolScripts })).toContain('pattern = ["aidlc", "engine"]');
  expect(emitDefaultRules({ binding: native, toolScripts: pinned.toolScripts })).not.toContain('pattern = ["bun"');
  expect(emitDefaultRules({ binding: { ...native, invoke: "bun .codex/tools/aidlc.ts" }, toolScripts: pinned.toolScripts })).toBe(pinned.cases[1]!.defaultRules);
});

test("trust refuses an absent route namespace", () => {
  expect(() => trustEntries({ projectDir: "/project", binding: { ...native, trustedNamespace: "" } })).toThrow("trusted route namespace is required");
});
