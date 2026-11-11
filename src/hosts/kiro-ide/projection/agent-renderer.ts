import type { AgentDocumentRequest, HostAgentRenderer } from "../../../projection/application/ports/agents.ts";
import type { Harness, Rendering } from "../../../projection/application/ports/harness.ts";
import { projectPath } from "../../../kernel/values.ts";
import { accepted, refused, type Result } from "../../../kernel/result.ts";
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

export const kiroIdePermissionLines = (policy: DelegateShellPolicy) => (agent: string): string[] => {
  const writePaths = agent === "aidlc-composer-agent" ? [composerProposalPath] : spacePaths;
  return [
    `tools: ["read", "write", "shell"]`,
    "includeMcpJson: true",
    "permissions:",
    "  rules:",
    "    - capability: shell",
    "      effect: allow",
    "      match:",
    `        - "bun .kiro/tools/aidlc-*"`,
    `        - "bun .kiro/tools/aidlc.ts engine *"`,
    `        - "bun --version"`,
    "    - capability: shell",
    "      effect: ask",
    "      match:",
    `        - "bun .kiro/tools/aidlc.ts engine config set *"`,
    `        - "bun .kiro/tools/aidlc.ts engine adapter *"`,
    ...quoted(policy.riskyForms.map((form) => `bun .kiro/tools/aidlc*${form}*`)),
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

export const createKiroIdeAgents = ({ personas }: { readonly personas: KiroIdePersonaRendering }): HostAgentRenderer => (inputs) => ({
  renderAgent: personas({
    modelSurface: ({ agent, removeKeys }) => inputs.documents({
      agent, text: "authored-file", knowledge: "absorbed", reading: "in-parts",
      frontmatter: { model: "projected", effortKey: "effort", modelQuoting: "plain",
        insertBeforeKeys: [], removeKeys, afterProjectionLines: [] },
    }),
    promptLines: (agent) => kiroIdePermissionLines(kiroIdeDelegateShellPolicy({
      facts: inputs.delegateShellFacts, directory: inputs.host.directory,
    }))(agent.slug),
    inlineReading: (agent) => inputs.inlineAgents.has(agent.slug) ? "reads-inline" : "dispatched-only",
  }),
  renderConductorAgent: (): Rendering => {
    const file = inputs.files.find((candidate) => candidate.source === "agents/aidlc-aidlc.md");
    if (!file) return refused({ kind: "render-failed", concept: "agent", name: "agents/aidlc-aidlc.md",
      reason: "The authored Kiro IDE conductor was not captured." });
    const content = file.content.kind === "text" ? file.content.text
      : new TextDecoder("utf-8", { ignoreBOM: true }).decode(file.content.bytes);
    const expanded = expandKiroIdeConductorAllows({ content, invoke: "{{INVOKE}}", allows: inputs.allows });
    if (!expanded.ok) return expanded;
    const prepared = inputs.prepare({ ...file, content: { kind: "text", text: expanded.value } });
    if (!prepared.ok) return prepared;
    const path = projectPath(".kiro/agents/aidlc-aidlc.md");
    return path.ok ? accepted([{ path: path.value, content: prepared.value.content,
      mode: "regular", availability: "always", origin: { kind: "harness-authored", source: file.source } }])
      : refused({ kind: "render-failed", concept: "agent", name: file.source,
        reason: "The Kiro IDE conductor destination must be project-relative." });
  },
});
