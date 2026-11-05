import type { AuthoredSkill, SkillContext, SkillNativeEmission } from "../src/domain/skill-definition.ts";
import type { AuthoredMarkdown } from "../src/adapters/authored-markdown.ts";

export const skillOrigin = { source: { kind: "core", id: "framework" }, pin: "d062c81e", path: "core/skills/aidlc-session-cost/SKILL.md" } as const;
export const skillHeader = "name: aidlc-session-cost\ndescription: Report {{INVOKE}}\nargument-hint: \"\"\nuser-invocable: true\nclassification: read-only";
export const authoredSkill: AuthoredSkill = { origin: skillOrigin, name: "aidlc-session-cost", description: "Report {{INVOKE}}", argumentHint: "", userInvocation: "enabled", classification: "read-only", header: skillHeader, body: "\nRun /aidlc then read {{HARNESS_DIR}}/tools/aidlc.ts.\n" };
export const skillDecoded = { name: "aidlc-session-cost", description: "Report {{INVOKE}}", "argument-hint": "", "user-invocable": true, classification: "read-only" };
export const skillFrame: AuthoredMarkdown = { header: skillHeader, body: authoredSkill.body, decoded: skillDecoded };
export const skillSourceText = `---\n${skillHeader}\n---\n${authoredSkill.body}`;
export const skillContext: SkillContext = { harness: "claude", directory: ".claude", invocation: "bun .claude/tools/aidlc.ts", rulesSubdir: "rules", memoryRoot: "aidlc/spaces/default/memory", modelInvocation: "native-default" };
export const safeSkillPaths = { path: () => "safe" as const };
export const skillEmission: SkillNativeEmission = { entrypoint: ".claude/skills/aidlc-session-cost/SKILL.md", resources: [{ kind: "file", path: ".claude/skills/aidlc-session-cost/SKILL.md", body: "Native skill" }], discovery: { kind: "native-directory", root: ".claude/skills" }, modelInvocation: "native-default" };
export const skillEmitterCases: { readonly context: SkillContext; readonly root: string; readonly config: "opencode.json" | null }[] = [
  { context: skillContext, root: ".claude/skills", config: null },
  { context: { ...skillContext, harness: "cursor", directory: ".cursor" }, root: ".cursor/skills", config: null },
  { context: { ...skillContext, harness: "copilot", directory: ".aidlc" }, root: ".github/skills", config: null },
  { context: { ...skillContext, harness: "opencode", directory: ".aidlc" }, root: ".aidlc/skills", config: "opencode.json" },
  { context: { ...skillContext, harness: "kiro", directory: ".kiro" }, root: ".kiro/skills", config: null },
  { context: { ...skillContext, harness: "kiro-ide", directory: ".kiro" }, root: ".kiro/skills", config: null },
];
export const skillRootCases = skillEmitterCases.map((entry) => ({ ...entry, expected: { entrypoint: `${entry.root}/aidlc-session-cost/SKILL.md`, resources: [{ kind: "file" as const, path: `${entry.root}/aidlc-session-cost/SKILL.md`, body: "Native text /aidlc" }], discovery: entry.config === null ? { kind: "native-directory" as const, root: entry.root } : { kind: "configured-directory" as const, root: entry.root, config: entry.config }, modelInvocation: "native-default" as const } }));
export const codexSkillContext: SkillContext = { ...skillContext, harness: "codex", directory: ".codex", modelInvocation: "disabled" };
