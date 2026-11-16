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

export const COPILOT_SKILL_INPUTS = [
  "skills/aidlc/SKILL.md", "skills/aidlc/question-rendering.md",
  "skills/aidlc/composer.md", "skills/aidlc/tables.md",
] as const;

const proseTokens: readonly TemplateToken[] = [
  "HARNESS_DIR", "INVOKE", "TOOL_PREFIX", "TRUSTED_NAMESPACE", "OPTION_LETTERS",
];
const decode = (content: FileContent): string => content.kind === "text" ? content.text
  : new TextDecoder("utf-8", { ignoreBOM: true }).decode(content.bytes);

const renderDocument = (request: SkillRenderingInputs, source: string): Rendering => {
  const file = request.files.find((candidate) => candidate.source === source);
  if (!file) return refused({ kind: "render-failed", concept: "orchestrator-skill",
    name: source, reason: "The authored orchestrator document was not captured." });
  const destination = `.github/${source}`;
  const path = projectPath(destination);
  if (!path.ok) return refused({ kind: "render-failed", concept: "orchestrator-skill",
    name: source, reason: "The orchestrator destination must be project-relative." });
  const content = bindTemplateTokens({ text: decode(file.content), tokens: request.tokens, selected: proseTokens });
  const refreshed = source === "skills/aidlc/tables.md"
    ? refreshSkillRegions({ text: content, render: request.tables }) : accepted(content);
  if (!refreshed.ok) return refused({ kind: "render-failed", concept: "orchestrator-skill",
    name: source, reason: refreshed.refusal });
  const finished = source === "skills/aidlc/SKILL.md"
    ? finishEarlierReleaseSkill({ text: refreshed.value, skillRel: destination, harnessDir: ".aidlc" })
    : refreshed.value;
  return accepted([{ path: path.value, mode: "regular",
    content: { kind: "bytes", bytes: new TextEncoder().encode(finished) },
    origin: { kind: "harness-authored", source: file.source } }]);
};

export const createCopilotSkillRenderer: HostSkillRenderer = (request) => ({
  renderOrchestratorSkill: (): Rendering => {
    const readings = COPILOT_SKILL_INPUTS.map((source) => renderDocument(request, source));
    const failed = readings.find((reading) => !reading.ok);
    return failed && !failed.ok ? failed
      : accepted(readings.flatMap((reading) => reading.ok ? reading.value : []));
  },
  renderSessionSkill: ({ skill }): Rendering => {
    const files = skill.files.map((file): Rendering => {
      const prefix = `skills/${skill.name}/`;
      if (!file.source.startsWith(prefix)) return refused({ kind: "render-failed",
        concept: "session-skill", name: skill.name, reason: "The source is outside its session skill." });
      const path = projectPath(`.github/${file.source}`);
      const content = bindTemplateTokens({ text: decode(file.content), tokens: request.tokens, selected: proseTokens });
      return path.ok ? accepted([{ path: path.value, mode: "regular",
        content: { kind: "bytes", bytes: new TextEncoder().encode(content) },
        origin: { kind: "neutral", source: file.source } }])
        : refused({ kind: "render-failed", concept: "session-skill", name: skill.name,
          reason: "The session skill destination must be project-relative." });
    });
    const failed = files.find((file) => !file.ok);
    return failed && !failed.ok ? failed
      : accepted(files.flatMap((file) => file.ok ? file.value : []));
  },
});
