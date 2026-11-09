import type { HostIdentity } from "../../../kernel/host.ts";
import type { FileContent } from "../../../kernel/file-content.ts";
import { accepted, refused, type Result } from "../../../kernel/result.ts";
import { projectPath } from "../../../kernel/values.ts";
import type { Harness, Rendering } from "../../../projection/application/ports.ts";
import type { AuthoredHostFile } from "../../../projection/domain/host-surface.ts";
import type { ProjectionRefusal } from "../../../projection/domain/projection.ts";
import type { Agent } from "../../../workflow-definition/domain/agent.ts";
import { prepareKiroAgentDocument, type KiroModelDecision } from "./prepared-agent-document.ts";

export type KiroJsonModelDecision = (request: {
  readonly agent: Agent;
  readonly file: AuthoredHostFile;
}) => Result<KiroModelDecision, ProjectionRefusal>;

export type KiroJsonAgentProfile = {
  readonly host: HostIdentity;
  readonly files: readonly AuthoredHostFile[];
  readonly modelDecision: KiroJsonModelDecision;
  readonly hookCommandSuffix: string | undefined;
  readonly formatDocuments: ReadonlySet<string>;
};

const renderFailed = (name: string, reason: string): ProjectionRefusal => ({
  kind: "render-failed", concept: "agent", name, reason,
});

const placed = (file: AuthoredHostFile, content: FileContent): Rendering => {
  const path = projectPath(`.kiro/${file.source}`);
  return path.ok ? accepted([{
    path: path.value,
    content,
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
    const modeled = profile.modelDecision({ agent, file });
    if (!modeled.ok) return modeled;
    const prepared = prepareKiroAgentDocument({
      host: profile.host, source: file.source, content: file.content, model: modeled.value,
      knowledge: { documents: knowledge, formatDocuments: profile.formatDocuments },
      hookCommandSuffix: profile.hookCommandSuffix,
    });
    return prepared.ok ? placed(file, prepared.value)
      : refused(renderFailed(agent.slug, prepared.refusal.reason));
  };
