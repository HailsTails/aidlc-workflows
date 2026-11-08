import { accepted, refused, type Result } from "../../../kernel/result.ts";
import { projectPath } from "../../../kernel/values.ts";
import type { Harness, Rendering } from "../../../projection/application/ports.ts";
import type { AuthoredHostFile } from "../../../projection/domain/host-surface.ts";
import type { ProjectionRefusal } from "../../../projection/domain/projection.ts";
import type { Agent } from "../../../workflow-definition/domain/agent.ts";
import { withSharedKnowledge } from "./shared-knowledge.ts";

export type KiroJsonModelSurface = (request: {
  readonly agent: Agent;
  readonly file: AuthoredHostFile;
}) => Result<string, ProjectionRefusal>;

export type KiroJsonAgentProfile = {
  readonly files: readonly AuthoredHostFile[];
  readonly modelSurface: KiroJsonModelSurface;
  readonly formatDocuments: ReadonlySet<string>;
};

const renderFailed = (name: string, reason: string): ProjectionRefusal => ({
  kind: "render-failed", concept: "agent", name, reason,
});

const placed = (file: AuthoredHostFile, text: string): Rendering => {
  const path = projectPath(`.kiro/${file.source}`);
  return path.ok ? accepted([{
    path: path.value,
    content: { kind: "text", text },
    mode: "regular",
    origin: { kind: "harness-authored", source: file.source },
    availability: "always",
  }]) : refused(renderFailed(file.source, "Kiro agent JSON needs a project-relative path."));
};

export const kiroJsonAgentRenderer = (profile: KiroJsonAgentProfile): Harness["renderAgent"] =>
  ({ agent, knowledge }) => {
    const file = profile.files.find((candidate) => candidate.source === `agents/${agent.slug}.json`);
    if (file === undefined) return refused(renderFailed(
      agent.slug, `Missing captured Kiro persona JSON: agents/${agent.slug}.json.`,
    ));
    const modeled = profile.modelSurface({ agent, file });
    if (!modeled.ok) return modeled;
    const expanded = withSharedKnowledge(modeled.value, {
      documents: knowledge, formatDocuments: profile.formatDocuments,
    });
    return expanded.ok ? placed(file, expanded.value) :
      refused(renderFailed(agent.slug, expanded.refusal));
  };
