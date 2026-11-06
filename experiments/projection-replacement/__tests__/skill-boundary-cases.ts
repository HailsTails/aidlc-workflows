import { expect } from "bun:test";
import { skillSourceCases } from "./skill-source-cases.ts";

const canonical = skillSourceCases.find((entry) => entry.baseline === "fork" && entry.context.harness === "claude" && entry.origin.path === "core/skills/aidlc-session-cost/SKILL.md") ?? expect.unreachable("missing real skill boundary input");
export const indentedSkillCase = { ...canonical, text: canonical.text.replace(/^---\n[\s\S]*?\n---\n/, (matched) => `---\n${matched.slice(4, -5).split("\n").map((line) => ` ${line}`).join("\n")}\n---\n`) };
export const duplicateSkillCase = { ...canonical, text: canonical.text.replace("user-invocable: true", "user-invocable: true\nuser-invocable: false") };
