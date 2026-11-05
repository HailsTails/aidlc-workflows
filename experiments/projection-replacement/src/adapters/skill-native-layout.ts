import type { Harness } from "../domain/harness-binding.ts";
import type { SkillDiscovery } from "../domain/skill-definition.ts";

export const nativeSkillDiscovery: Readonly<Record<Harness, SkillDiscovery>> = {
  claude: { kind: "native-directory", root: ".claude/skills" },
  cursor: { kind: "native-directory", root: ".cursor/skills" },
  codex: { kind: "native-directory", root: ".agents/skills" },
  copilot: { kind: "native-directory", root: ".github/skills" },
  opencode: { kind: "configured-directory", root: ".aidlc/skills", config: "opencode.json" },
  kiro: { kind: "native-directory", root: ".kiro/skills" },
  "kiro-ide": { kind: "native-directory", root: ".kiro/skills" },
};
export const codexInvocationGuard = "policy:\n  allow_implicit_invocation: false\n";
