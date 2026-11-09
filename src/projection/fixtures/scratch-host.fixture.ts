import { host } from "../../kernel/fixtures/values.fixture.ts";
import { accepted, refused } from "../../kernel/result.ts";
import { projectPath } from "../../kernel/values.ts";
import type {
  CommandPlacement,
  Harness,
  HostDocumentRenderer,
  HostSettingsRenderer,
  HostSkillRenderer,
  Rendering,
} from "../application/ports.ts";
import type { HostData } from "../domain/host-surface.ts";
import type { HostTokenBindings } from "../domain/template-token.ts";

export const SCRATCH_HOST = host({ name: "scratch", directory: ".scratch" });

export const SCRATCH_TOKENS: HostTokenBindings = {
  ["INVOKE"]: "bun .scratch/tools/aidlc.ts",
  ["SKILL_INVOKE"]: null,
  ["OPTION_LETTERS"]: "A-E",
  ["TRUSTED_NAMESPACE"]: "aidlc",
  ["TOOL_PREFIX"]: "bun .scratch/tools/",
};

export const SCRATCH_HOST_DATA: HostData = {
  productName: "Scratch",
  configNextStep: "open Scratch in this project and run /aidlc",
  rulesFolder: null,
};

const nothing = (): Rendering => accepted([]);

export const scratchAgentRenderer: Harness["renderAgent"] = ({ agent }) => {
  const destination = projectPath(`.scratch/agents/${agent.slug}.md`);
  return destination.ok
    ? accepted([{
      path: destination.value,
      content: { kind: "text", text: `${agent.slug}\n` },
      mode: "regular",
      origin: { kind: "method-source", path: agent.source },
      availability: "always",
    }])
    : refused({ kind: "render-failed", concept: "agent", name: agent.slug,
      reason: "The scratch agent destination must be a project-relative path." });
};

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
