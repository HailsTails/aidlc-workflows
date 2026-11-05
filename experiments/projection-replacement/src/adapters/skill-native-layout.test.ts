import { expect, test } from "bun:test";
import { nativeSkillDiscovery, codexInvocationGuard } from "./skill-native-layout.ts";
test("discovery facts distinguish native roots from configurable OpenCode discovery", () => {
  expect(nativeSkillDiscovery.opencode).toEqual({ kind: "configured-directory", root: ".aidlc/skills", config: "opencode.json" });
  expect(nativeSkillDiscovery.codex).toEqual({ kind: "native-directory", root: ".agents/skills" });
  expect(codexInvocationGuard).toBe("policy:\n  allow_implicit_invocation: false\n");
});
