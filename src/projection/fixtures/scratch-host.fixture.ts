import { host } from "../../kernel/fixtures/values.fixture.ts";
import { accepted, refused } from "../../kernel/result.ts";
import { projectPath } from "../../kernel/values.ts";
import type { AgentRenderingInputs, HostAgentRenderer } from "../application/ports/agents.ts";
import type { CommandPlacement } from "../application/ports/commands.ts";
import type { HostDocumentRenderer } from "../application/ports/documents.ts";
import type { HostSettingsRenderer } from "../application/ports/settings.ts";
import type { HostSkillRenderer } from "../application/ports/skills.ts";
import type { Rendering } from "../application/ports/harness.ts";
import type { HostData } from "../domain/host-surface.ts";
import type { HostTokenChoices } from "../domain/template-token.ts";

export const SCRATCH_HOST = host({ name: "scratch", directory: ".scratch" });

export const SCRATCH_TOKENS: HostTokenChoices = {
  ["SKILL_INVOKE"]: null,
  ["OPTION_LETTERS"]: "A-E",
};

export const SCRATCH_HOST_DATA: HostData = {
  productName: "Scratch",
  configNextStep: "open Scratch in this project and run /aidlc",
  rulesFolder: null,
};

const nothing = (): Rendering => accepted([]);

export const SCRATCH_AGENT_INPUTS: AgentRenderingInputs = {
  host: SCRATCH_HOST,
  channel: "copy",
  files: [],
  prepare: accepted,
  models: () => accepted(undefined),
  formatDocuments: new Set(),
  allows: { dispatcherCommands: [], toolScripts: [] },
};

export const scratchAgentRenderer: HostAgentRenderer = ({ channel }) => ({
  renderAgent: ({ agent }) => {
    const destination = projectPath(`.scratch/agents/${agent.slug}.md`);
    return destination.ok
      ? accepted([{
        path: destination.value,
        content: { kind: "text", text: `${agent.slug} for the ${channel} channel\n` },
        mode: "regular",
        origin: { kind: "method-source", path: agent.source },
        availability: "always",
      }])
      : refused({ kind: "render-failed", concept: "agent", name: agent.slug,
        reason: "The scratch agent destination must be a project-relative path." });
  },
  renderConductorAgent: nothing,
});

export const scratchCommandPlacement: CommandPlacement = (file) =>
  projectPath(`.scratch/commands/${file.within}`);

export const scratchSkillRenderer: HostSkillRenderer = () => ({
  renderOrchestratorSkill: nothing,
  renderSessionSkill: nothing,
});

export const scratchSettingsRenderer: HostSettingsRenderer = () => ({
  renderSettings: nothing,
  renderHookRegistrations: nothing,
});

export const scratchDocumentRenderer: HostDocumentRenderer = () => ({
  renderOnboarding: nothing,
  placeNeutralDocument: nothing,
});
