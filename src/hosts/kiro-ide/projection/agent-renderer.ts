import { kiroIdeShellPermissionLines, kiroIdeConductorPermissionSource } from "./native-permissions.ts";
import type { DistributionChannel } from "../../../projection/domain/projected-file.ts";
import type { FileContent } from "../../../kernel/file-content.ts";
import type { AgentDocumentRequest, HostAgentRenderer } from "../../../projection/application/ports/agents.ts";
import type { Harness, Rendering } from "../../../projection/application/ports/harness.ts";
import { projectPath } from "../../../kernel/values.ts";
import { accepted, refused, type Result } from "../../../kernel/result.ts";
import { inlineAgentSet } from "../../../workflow-definition/domain/method-participation.ts";
import type { CopyChannelAllows } from "../../../projection/application/ports/copy-channel.ts";
import type { ProjectionRefusal } from "../../../projection/domain/projection.ts";
import { kiroIdeDelegateShellPolicy, type DelegateShellPolicy } from "./delegate-shell-deny.ts";

export type KiroIdePersonaProfile = {
  readonly modelSurface: (request: { readonly agent: AgentDocumentRequest["agent"]; readonly removeKeys: readonly string[] }) =>
    Result<string, ProjectionRefusal>;
  readonly promptLines: (agent: AgentDocumentRequest["agent"]) => readonly string[];
  readonly inlineReading: (agent: AgentDocumentRequest["agent"]) => "reads-inline" | "dispatched-only";
};

export type KiroIdePersonaRendering = (profile: KiroIdePersonaProfile) => Harness["renderAgent"];

const composerProposalPath = "aidlc/spaces/*/intents/.aidlc-engine/composer-proposal.json";
const spacePaths = ["aidlc/spaces/**", ".aidlc/worktrees/*/aidlc/spaces/**"];
const quoted = (paths: readonly string[]) => paths.map((path) => `        - "${path}"`);
const contentText = (content: FileContent): string => content.kind === "text" ? content.text
  : new TextDecoder("utf-8", { ignoreBOM: true }).decode(content.bytes);
const conductorContent = (content: FileContent, channel: DistributionChannel): FileContent =>
  channel === "copy" ? content : { kind: "text", text: contentText(content) };

export const kiroIdePermissionLines = ({ policy, channel }: {
  readonly policy: DelegateShellPolicy;
  readonly channel: DistributionChannel;
}) => (agent: string): string[] => {
  const writePaths = agent === "aidlc-composer-agent" ? [composerProposalPath] : spacePaths;
  const shell = kiroIdeShellPermissionLines({ policy, channel });
  return [
    `tools: ["read", "write", "shell"]`,
    "includeMcpJson: true",
    "permissions:",
    "  rules:",
    ...shell.allow,
    ...shell.ask,
    ...policy.shellDeny(agent),
    "    - capability: fs_read",
    "      effect: allow",
    "      match:",
    `        - "**"`,
    "    - capability: filesystem",
    "      effect: allow",
    "      match:",
    ...quoted(writePaths),
    "    - capability: fs_write",
    "      effect: deny",
    "      match:",
    `        - ".kiro/**"`,
    `        - "aidlc/.aidlc-sessions/**"`,
    `        - "aidlc/spaces/*/intents/*/.aidlc-engine/gate-words/**"`,
  ];
};

export const expandKiroIdeConductorAllows = (request: {
  readonly content: string;
  readonly invoke: string;
  readonly allows: CopyChannelAllows;
}): Result<string, ProjectionRefusal> => {
  const engine = `        - "${request.invoke} engine *"\n`;
  if (request.content.split(engine).length !== 2) return refused({
    kind: "render-failed", concept: "agent", name: "agents/aidlc-aidlc.md",
    reason: `agents/aidlc-aidlc.md must allow ${request.invoke} engine * exactly once`,
  });
  const exact = request.allows.dispatcherCommands.map((command) => `        - "${request.invoke} ${command}"\n`);
  return accepted(request.content.replace(engine, `${engine}${exact.join("")}`));
};

export const createKiroIdeAgents = ({ personas }: { readonly personas: KiroIdePersonaRendering }): HostAgentRenderer => (inputs) => {
  const inlineAgents = inlineAgentSet(inputs.method);
  return {
    renderAgent: personas({
      modelSurface: ({ agent, removeKeys }) => inputs.documents({
        agent, text: "authored-file", knowledge: "absorbed", reading: "in-parts",
        frontmatter: { model: "projected", effortKey: "effort", modelQuoting: "plain",
          insertBeforeKeys: [], removeKeys, afterProjectionLines: [] },
      }),
      promptLines: (agent) => {
        return kiroIdePermissionLines({ policy: kiroIdeDelegateShellPolicy({
          facts: inputs.delegateShellFacts, directory: inputs.host.directory,
        }), channel: inputs.channel })(agent.slug);
      },
      inlineReading: (agent) => inlineAgents.has(agent.slug) ? "reads-inline" : "dispatched-only",
    }),
    renderConductorAgent: (): Rendering => {
      const file = inputs.files.find((candidate) => candidate.source === "agents/aidlc-aidlc.md");
      if (!file) return refused({ kind: "render-failed", concept: "agent", name: "agents/aidlc-aidlc.md",
        reason: "The authored Kiro IDE conductor was not captured." });
      const content = contentText(file.content);
      const expanded = expandKiroIdeConductorAllows({ content, invoke: "{{INVOKE}}", allows: inputs.allows });
      if (!expanded.ok) return expanded;
      const text = kiroIdeConductorPermissionSource({ source: expanded.value, channel: inputs.channel,
        policy: kiroIdeDelegateShellPolicy({ facts: inputs.delegateShellFacts, directory: inputs.host.directory }),
        dispatcherCommands: inputs.allows.dispatcherCommands });
      const prepared = inputs.prepare({ ...file, content: { kind: "text", text } });
      if (!prepared.ok) return prepared;
      const projectedContent = conductorContent(prepared.value.content, inputs.channel);
      const path = projectPath(".kiro/agents/aidlc-aidlc.md");
      return path.ok ? accepted([{ path: path.value, content: projectedContent,
        mode: "regular", origin: { kind: "harness-authored", source: file.source } }])
        : refused({ kind: "render-failed", concept: "agent", name: file.source,
          reason: "The Kiro IDE conductor destination must be project-relative." });
    },
  };
};
