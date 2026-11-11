import type { SourcePath } from "../../../kernel/values.ts";
import type { AuthoredPlacement } from "../../domain/host-surface.ts";
import type { OnboardingFills } from "../../domain/neutral-surface.ts";
import type { HostTokenChoices } from "../../domain/template-token.ts";
import type { HostAgentRenderer } from "./agents.ts";
import type { CommandPlacement } from "./commands.ts";
import type { HostDocumentRenderer } from "./documents.ts";
import type { HostDataRenderer } from "./host-surface.ts";
import type { HostSettingsRenderer } from "./settings.ts";
import type { HostSkillRenderer } from "./skills.ts";

export type ConceptMembers<Render> = {
  readonly inputs: readonly SourcePath[];
  readonly render: Render;
};

export type HostProjectionParts = {
  readonly tokens: HostTokenChoices;
  readonly renderData: HostDataRenderer;
  readonly placements: readonly AuthoredPlacement[];
  readonly agents: ConceptMembers<HostAgentRenderer>;
  readonly commands: CommandPlacement;
  readonly skills: ConceptMembers<HostSkillRenderer>;
  readonly settings: ConceptMembers<HostSettingsRenderer>;
  readonly documents: ConceptMembers<HostDocumentRenderer>;
  readonly fills: OnboardingFills;
  readonly bindingHeading: string;
};
