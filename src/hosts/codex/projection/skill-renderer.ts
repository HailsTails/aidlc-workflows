import { bindTemplateTokens } from "../../../projection/domain/token-binding.ts";
import type { FileContent } from "../../../kernel/file-content.ts";
import { accepted, refused } from "../../../kernel/result.ts";
import { projectPath } from "../../../kernel/values.ts";
import type {
  HostSkillRenderer,
  SkillRenderingInputs,
} from "../../../projection/application/ports/skills.ts";
import type { Rendering } from "../../../projection/application/ports/harness.ts";
import type { TemplateToken } from "../../../projection/domain/template-token.ts";
import { refreshSkillRegions, finishEarlierReleaseSkill } from "../../../projection/domain/skill-regions.ts";

export const CODEX_SKILL_INPUTS = [
  "skills/aidlc/SKILL.md", "skills/aidlc/question-rendering.md",
  "skills/aidlc/composer.md", "skills/aidlc/tables.md",
] as const;

const proseTokens: readonly TemplateToken[] = [
  "HARNESS_DIR", "INVOKE", "TOOL_PREFIX", "TRUSTED_NAMESPACE", "OPTION_LETTERS",
];
const decode = (content: FileContent): string => content.kind === "text" ? content.text
  : new TextDecoder("utf-8", { ignoreBOM: true }).decode(content.bytes);
const codexInvocations = (text: string): string =>
  text.replace(/(^|[\s(`"])\/(aidlc(?:-[a-z][a-z0-9-]*)?)(?![a-z0-9-]*\.[a-z])/gm, "$1$$$2");

const renderDocument = (request: SkillRenderingInputs, source: string): Rendering => {
  const file = request.files.find((candidate) => candidate.source === source);
  if (!file) return refused({ kind: "render-failed", concept: "orchestrator-skill",
    name: source, reason: "The authored orchestrator document was not captured." });
  const destination = `.agents/${source}`;
  const path = projectPath(destination);
  if (!path.ok) return refused({ kind: "render-failed", concept: "orchestrator-skill",
    name: source, reason: "The orchestrator destination must be project-relative." });
  const content = bindTemplateTokens({ text: decode(file.content), tokens: request.tokens, selected: proseTokens });
  const refreshed = source === "skills/aidlc/tables.md"
    ? refreshSkillRegions({ text: content, render: request.tables }) : accepted(content);
  if (!refreshed.ok) return refused({ kind: "render-failed", concept: "orchestrator-skill",
    name: source, reason: refreshed.refusal });
  const finished = source === "skills/aidlc/SKILL.md"
    ? finishEarlierReleaseSkill({ text: refreshed.value, skillRel: destination, harnessDir: ".codex" })
    : refreshed.value;
  return accepted([{ path: path.value, mode: "regular", availability: "always",
    content: { kind: "bytes", bytes: new TextEncoder().encode(finished) },
    origin: { kind: "harness-authored", source: file.source } }]);
};

export const createCodexSkillRenderer: HostSkillRenderer = (request) => ({
  renderOrchestratorSkill: (): Rendering => {
    const readings = CODEX_SKILL_INPUTS.map((source) => renderDocument(request, source));
    const failed = readings.find((reading) => !reading.ok);
    return failed && !failed.ok ? failed
      : accepted(readings.flatMap((reading) => reading.ok ? reading.value : []));
  },
  renderSessionSkill: ({ skill }): Rendering => {
    const files = skill.files.map((file): Rendering => {
      const prefix = `skills/${skill.name}/`;
      if (!file.source.startsWith(prefix)) return refused({ kind: "render-failed",
        concept: "session-skill", name: skill.name, reason: "The source is outside its session skill." });
      if (file.source === `${prefix}agents/openai.yaml`) return accepted([]);
      const path = projectPath(`.agents/${file.source}`);
      const prose = bindTemplateTokens({ text: decode(file.content), tokens: request.tokens, selected: proseTokens })
        .replaceAll(".codex/rules/", ".codex/aidlc-rules/");
      const content = file.source.endsWith(".md") ? codexInvocations(prose) : prose;
      return path.ok ? accepted([{ path: path.value, mode: "regular", availability: "always",
        content: { kind: "bytes", bytes: new TextEncoder().encode(content) },
        origin: { kind: "neutral", source: file.source } }])
        : refused({ kind: "render-failed", concept: "session-skill", name: skill.name,
          reason: "The session skill destination must be project-relative." });
    });
    const failed = files.find((file) => !file.ok);
    if (failed && !failed.ok) return failed;
    const guardPath = projectPath(`.agents/skills/${skill.name}/agents/openai.yaml`);
    return guardPath.ok ? accepted([
      ...files.flatMap((file) => file.ok ? file.value : []),
      { path: guardPath.value, mode: "regular", availability: "always",
        content: { kind: "bytes", bytes: new TextEncoder().encode("policy:\n  allow_implicit_invocation: false\n") },
        origin: { kind: "rendered", concept: "session-skill", name: skill.name } },
    ]) : refused({ kind: "render-failed", concept: "session-skill", name: skill.name,
      reason: "The session skill destination must be project-relative." });
  },
});
