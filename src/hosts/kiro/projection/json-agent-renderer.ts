import type { HostIdentity } from "../../../kernel/host.ts";
import type { FileContent } from "../../../kernel/file-content.ts";
import { accepted, refused, type Result } from "../../../kernel/result.ts";
import { projectPath } from "../../../kernel/values.ts";
import type { Harness, Rendering, HostAgentRenderer } from "../../../projection/application/ports.ts";
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

export const placeKiroAgentDocument = (file: AuthoredHostFile, content: FileContent): Rendering => {
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
    return prepared.ok ? placeKiroAgentDocument(file, prepared.value)
      : refused(prepared.refusal);
  };

export const KIRO_HOOK_COMMAND_SUFFIX = "; exit $LASTEXITCODE";

export const KIRO_AGENT_JSON = [
  "agents/aidlc.json", "agents/aidlc-architect-agent.json", "agents/aidlc-developer-agent.json",
  "agents/aidlc-product-lead-agent.json", "agents/aidlc-architecture-reviewer-agent.json",
  "agents/aidlc-composer-agent.json", "agents/aidlc-product-agent.json", "agents/aidlc-design-agent.json",
  "agents/aidlc-delivery-agent.json", "agents/aidlc-aws-platform-agent.json",
  "agents/aidlc-compliance-agent.json", "agents/aidlc-devsecops-agent.json",
  "agents/aidlc-quality-agent.json", "agents/aidlc-pipeline-deploy-agent.json",
  "agents/aidlc-operations-agent.json",
] as const;

export const createKiroJsonAgentRenderer = (profile: {
  readonly host: HostIdentity;
  readonly formatDocuments: ReadonlySet<string>;
}): HostAgentRenderer => (inputs) => ({
  renderAgent: (request) => {
    const file = inputs.files.find((candidate) => candidate.source === `agents/${request.agent.slug}.json`);
    if (!file) return refused(renderFailed(request.agent.slug,
      `Missing captured Kiro persona JSON: agents/${request.agent.slug}.json.`));
    const prepared = inputs.prepare(file);
    if (!prepared.ok) return prepared;
    return kiroJsonAgentRenderer({ ...profile, files: [prepared.value], hookCommandSuffix: KIRO_HOOK_COMMAND_SUFFIX,
      modelDecision: ({ agent, file: captured }) => {
        if (agent.model.kind !== "tier") return refused({ kind: "host-source-unreadable",
          host: profile.host, source: captured.source, reason: "the accepted core Method supplies no model tier" });
        const model = inputs.models({ host: profile.host, agent: agent.slug, model: agent.model });
        return model.ok ? accepted({ kind: "project", model: model.value }) : model;
      },
    })(request);
  },
  renderConductorAgent: ({ knowledge }) => {
    const file = inputs.files.find((candidate) => candidate.source === "agents/aidlc.json");
    if (!file) return refused(renderFailed("aidlc", "Missing captured Kiro conductor JSON: agents/aidlc.json."));
    const captured = inputs.prepare(file);
    if (!captured.ok) return captured;
    const prepared = prepareKiroAgentDocument({ host: profile.host, source: captured.value.source,
      content: captured.value.content, model: { kind: "preserve" },
      knowledge: { documents: knowledge, formatDocuments: profile.formatDocuments },
      hookCommandSuffix: KIRO_HOOK_COMMAND_SUFFIX });
    return prepared.ok ? placeKiroAgentDocument(file, prepared.value) : prepared;
  },
});
export const kiroAgents: HostAgentRenderer = (inputs) => createKiroJsonAgentRenderer({
  host: inputs.host, formatDocuments: inputs.formatDocuments,
})(inputs);