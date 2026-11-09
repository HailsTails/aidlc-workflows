import { KIRO_PROMPT_LINES } from "../host-data.ts";
import { accepted, refused, type Result } from "../../../kernel/result.ts";
import { projectPath } from "../../../kernel/values.ts";
import type { Harness, Rendering } from "../../../projection/application/ports/harness.ts";
import type { ProjectedFile } from "../../../projection/domain/projected-file.ts";
import type { ProjectionRefusal } from "../../../projection/domain/projection.ts";
import type { Agent } from "../../../workflow-definition/domain/agent.ts";
import { withFrontmatterLines, type FrontmatterLinesRefusal } from "./frontmatter-lines.ts";

export type KiroModelSurface = (request: {
  readonly agent: Agent;
  readonly removeKeys: readonly string[];
}) => Result<string, ProjectionRefusal>;

export type InlineReading = "reads-inline" | "dispatched-only";

export type KiroAgentProfile = {
  readonly modelSurface: KiroModelSurface;
  readonly promptLines: (agent: Agent) => readonly string[];
  readonly inlineReading: (agent: Agent) => InlineReading;
};

const renderFailed = (agent: Agent, reason: string): ProjectionRefusal => ({
  kind: "render-failed",
  concept: "agent",
  name: agent.slug,
  reason,
});

const deniesOnlyTask = (agent: Agent): "task-only" | "other" =>
  agent.tools.disallowed.length === 1 && /^task$/i.test(agent.tools.disallowed[0]?.trim() ?? "")
    ? "task-only"
    : "other";

const linesReason = (refusal: FrontmatterLinesRefusal): string => {
  switch (refusal.kind) {
    case "no-frontmatter":
      return "The agent file has no frontmatter block for Kiro's prompt lines.";
    case "not-a-key":
      return `Kiro's prompt line "${refusal.line}" does not start with a YAML key.`;
    case "key-added-twice":
      return `Kiro's prompt lines declare "${refusal.key}:" more than once.`;
    case "key-already-present":
      return `The agent already declares "${refusal.key}:", which Kiro's prompt lines add.`;
  }
};

const fileAt = (
  agent: Agent,
  placing: { readonly path: string; readonly text: string },
): Result<ProjectedFile, ProjectionRefusal> => {
  const path = projectPath(placing.path);
  return path.ok
    ? accepted({
        path: path.value,
        content: { kind: "text", text: placing.text },
        mode: "regular",
        origin: { kind: "method-source", path: agent.source },
        availability: "always",
      })
    : refused(renderFailed(agent, `${placing.path} must be a project-relative path.`));
};

const carriesPermissions = (lines: readonly string[]): "permissions" | "prompt-only" =>
  lines.some((line) => line.split(":", 1)[0] === "permissions") ? "permissions" : "prompt-only";

const inlineCopy = (
  profile: KiroAgentProfile,
  persona: { readonly agent: Agent; readonly lines: readonly string[]; readonly text: string },
): readonly Result<ProjectedFile, ProjectionRefusal>[] =>
  carriesPermissions(persona.lines) === "permissions" &&
  profile.inlineReading(persona.agent) === "reads-inline"
    ? [
        fileAt(persona.agent, {
          path: `.kiro/aidlc-common/personas/${persona.agent.slug}.md`,
          text: persona.text,
        }),
      ]
    : [];

const appended = (rendering: Rendering, file: Result<ProjectedFile, ProjectionRefusal>): Rendering => {
  if (!rendering.ok) {
    return rendering;
  }
  return file.ok ? accepted([...rendering.value, file.value]) : file;
};

const collected = (files: readonly Result<ProjectedFile, ProjectionRefusal>[]): Rendering =>
  files.reduce<Rendering>(appended, accepted([]));

const prompted = (
  profile: KiroAgentProfile,
  surfaced: { readonly agent: Agent; readonly text: string },
): Rendering => {
  const { agent, text } = surfaced;
  const lines = profile.promptLines(agent);
  const withLines = withFrontmatterLines(text, lines);
  return withLines.ok
    ? collected([
        fileAt(agent, { path: `.kiro/agents/${agent.slug}.md`, text: withLines.value }),
        ...inlineCopy(profile, { agent, lines, text }),
      ])
    : refused(renderFailed(agent, linesReason(withLines.refusal)));
};

export const kiroAgentRenderer =
  (profile: KiroAgentProfile): Harness["renderAgent"] =>
  ({ agent }) => {
    if (deniesOnlyTask(agent) === "other") {
      return refused(
        renderFailed(agent, "Kiro needs the agent to deny exactly one tool, Task, and nothing else."),
      );
    }
    const surfaced = profile.modelSurface({ agent, removeKeys: ["disallowedTools"] });
    return surfaced.ok ? prompted(profile, { agent, text: surfaced.value }) : surfaced;
  };

export const kiroCliAgentRenderer = (modelSurface: KiroModelSurface): Harness["renderAgent"] =>
  kiroAgentRenderer({
    modelSurface,
    promptLines: () => KIRO_PROMPT_LINES,
    inlineReading: () => "dispatched-only",
  });
