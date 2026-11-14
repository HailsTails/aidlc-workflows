import { kiroCliAgentRenderer } from "./agent-renderer.ts";
import { prepareKiroAgentBatch, expandKiroAgentAllows } from "./tool-allows.ts";
import type { CopyChannelAllows } from "../../../projection/application/ports/copy-channel.ts";
import type { HostIdentity } from "../../../kernel/host.ts";
import type { FileContent } from "../../../kernel/file-content.ts";
import { accepted, refused, type Result } from "../../../kernel/result.ts";
import { projectPath, type ProjectPath } from "../../../kernel/values.ts";
import type { DistributionChannel } from "../../../projection/domain/projected-file.ts";
import type { Harness, Rendering } from "../../../projection/application/ports/harness.ts";
import type { HostAgentRenderer } from "../../../projection/application/ports/agents.ts";
import type { AuthoredHostFile } from "../../../projection/domain/host-surface.ts";
import type { ProjectionRefusal } from "../../../projection/domain/projection.ts";
import type { Agent } from "../../../workflow-definition/domain/agent.ts";
import { prepareKiroAgentDocument, type KiroModelDecision } from "./prepared-agent-document.ts";

export type KiroJsonModelDecision = (request: {
  readonly agent: Agent;
  readonly file: AuthoredHostFile;
}) => Result<KiroModelDecision, ProjectionRefusal>;

export type KiroJsonAgentProfile = {
  readonly channel: DistributionChannel;
  readonly namespace: string | null | undefined;
  readonly host: HostIdentity;
  readonly files: readonly AuthoredHostFile[];
  readonly modelDecision: KiroJsonModelDecision;
  readonly allows: CopyChannelAllows;
  readonly hookCommandSuffix: string | undefined;
  readonly formatDocuments: ReadonlySet<string>;
};

const renderFailed = (name: string, reason: string): ProjectionRefusal => ({
  kind: "render-failed", concept: "agent", name, reason,
});

export const placeKiroAgentDocument = (file: AuthoredHostFile, request: {
  readonly content: FileContent;
  readonly allows: CopyChannelAllows;
  readonly channel: DistributionChannel;
  readonly directory: ProjectPath;
  readonly namespace: string | null | undefined;
}): Rendering => {
  const expanded = expandKiroAgentAllows({ file: { ...file, content: request.content }, allows: request.allows,
    channel: request.channel, directory: request.directory, namespace: request.namespace });
  if (!expanded.ok) return expanded;
  const path = projectPath(`.kiro/${file.source}`);
  return path.ok ? accepted([{
    path: path.value,
    content: expanded.value.file.content,
    mode: "regular",
    origin: { kind: "harness-authored", source: file.source },
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
    return prepared.ok ? placeKiroAgentDocument(file, { content: prepared.value, allows: profile.allows,
      channel: profile.channel, directory: profile.host.directory, namespace: profile.namespace })
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
}): HostAgentRenderer => (inputs) => {
  const prepared = prepareKiroAgentBatch(inputs);
  if (!prepared.ok) return { renderAgent: () => prepared, renderConductorAgent: () => prepared };
  const files = prepared.value;
  return {
    renderAgent: kiroJsonAgentRenderer({ ...profile, files, allows: inputs.allows,
      channel: inputs.channel, namespace: inputs.tokens.TRUSTED_NAMESPACE, hookCommandSuffix: KIRO_HOOK_COMMAND_SUFFIX,
      modelDecision: ({ agent, file }) => {
        if (agent.model.kind !== "tier") return refused({ kind: "host-source-unreadable",
          host: profile.host, source: file.source, reason: "the accepted core Method supplies no model tier" });
        const model = inputs.models({ host: profile.host, agent: agent.slug, model: agent.model });
        return model.ok ? accepted({ kind: "project", model: model.value }) : model;
      },
    }),
    renderConductorAgent: ({ knowledge }) => {
      const file = files.find((candidate) => candidate.source === "agents/aidlc.json");
      if (!file) return refused(renderFailed("aidlc", "Missing captured Kiro conductor JSON: agents/aidlc.json."));
      const content = prepareKiroAgentDocument({ host: profile.host, source: file.source,
        content: file.content, model: { kind: "preserve" },
        knowledge: { documents: knowledge, formatDocuments: profile.formatDocuments },
        hookCommandSuffix: KIRO_HOOK_COMMAND_SUFFIX });
      return content.ok ? placeKiroAgentDocument(file, { content: content.value, allows: inputs.allows,
        channel: inputs.channel, directory: profile.host.directory, namespace: inputs.tokens.TRUSTED_NAMESPACE }) : content;
    },
  };
};

export const kiroAgents: HostAgentRenderer = (inputs) => {
  const json = createKiroJsonAgentRenderer({ host: inputs.host, formatDocuments: inputs.formatDocuments })(inputs);
  const markdown = kiroCliAgentRenderer(({ agent, removeKeys }) => inputs.documents({
    agent, text: "authored-file", knowledge: "absorbed", reading: "in-parts",
    frontmatter: { model: "projected", effortKey: "effort", modelQuoting: "plain",
      insertBeforeKeys: [], removeKeys, afterProjectionLines: [] },
  }));
  return {
    renderConductorAgent: json.renderConductorAgent,
    renderAgent: (request) => {
      const native = json.renderAgent(request);
      if (!native.ok) return native;
      const document = markdown(request);
      return document.ok ? accepted([...native.value, ...document.value]) : document;
    },
  };
};