import { methodSliceFixture } from "../../workflow-definition/fixtures/method.fixture.ts";
import { DELEGATE_SHELL_FACTS } from "./delegate-shell-facts.fixture.ts";
import { tokenBindingsFixture } from "./token-bindings.fixture.ts";
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
import type { ProjectionOrigin } from "../domain/projected-file.ts";
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
  delegateShellFacts: DELEGATE_SHELL_FACTS,
  tokens: tokenBindingsFixture({ harnessDir: ".scratch" }),
  persona: () => accepted(""),
  documents: () => accepted(""),
  tomlModels: () => accepted(""),
  inlineAgents: new Set(),
  modelCap: null,
  method: methodSliceFixture,
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
      }])
      : refused({ kind: "render-failed", concept: "agent", name: agent.slug,
        reason: "The scratch agent destination must be a project-relative path." });
  },
  renderConductorAgent: nothing,
});

export const scratchCommandPlacement: CommandPlacement = (file) =>
  projectPath(`.scratch/commands/${file.within}`);

type RenderedConceptName = Extract<ProjectionOrigin, { kind: "rendered" }>["concept"];

const scratchFile = (request: {
  readonly path: string; readonly concept: RenderedConceptName; readonly name: string;
}): Rendering => {
  const destination = projectPath(request.path);
  return destination.ok
    ? accepted([{ path: destination.value, content: { kind: "text", text: request.name },
      mode: "regular",
      origin: { kind: "rendered", concept: request.concept, name: request.name } }])
    : refused({ kind: "render-failed", concept: "host-data", name: request.name,
      reason: "The scratch destination must be a project-relative path." });
};

export const scratchSkillRenderer: HostSkillRenderer = () => ({
  renderOrchestratorSkill: () => scratchFile({
    path: ".scratch/skills/aidlc/SKILL.md", concept: "orchestrator-skill", name: "aidlc" }),
  renderSessionSkill: ({ skill }) => scratchFile({
    path: `.scratch/skills/${skill.name}/SKILL.md`, concept: "session-skill", name: skill.name }),
});

export const scratchSettingsRenderer: HostSettingsRenderer = () => ({
  renderSettings: () => scratchFile({
    path: ".scratch/settings.json", concept: "settings", name: "settings" }),
  renderHookRegistrations: () => scratchFile({
    path: ".scratch/hooks.json", concept: "hook-registration", name: "hooks" }),
});

export const scratchDocumentRenderer: HostDocumentRenderer = () => ({
  renderOnboarding: () => scratchFile({
    path: ".scratch/onboarding.md", concept: "onboarding", name: "onboarding" }),
  placeNeutralDocument: nothing,
});
