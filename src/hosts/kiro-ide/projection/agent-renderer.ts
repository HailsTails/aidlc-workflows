import type { HostAgentRenderer } from "../../../projection/application/ports/agents.ts";
import type { Rendering } from "../../../projection/application/ports/harness.ts";
import { projectPath } from "../../../kernel/values.ts";
import { accepted, refused, type Result } from "../../../kernel/result.ts";
import type { CopyChannelAllows } from "../../../projection/application/ports/copy-channel.ts";
import type { ProjectionRefusal } from "../../../projection/domain/projection.ts";
import type { DelegateShellPolicy } from "../../../projection/application/ports/delegate-shell.ts";

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

export const kiroIdeAgents: HostAgentRenderer = (inputs) => ({
  renderAgent: () => accepted([]),
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
