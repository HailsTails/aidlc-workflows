import { createProjectionSet, type ProjectionSetServices } from "../src/application/projection-set.ts";
import { projectAgentDefinition } from "./agent-projection.ts";
import { projectAgentFromCompiledStages } from "./compiled-agent-projection.ts";
import { projectAuthoredSkill } from "./skill-projection.ts";
import { projectGeneratedRunners } from "./generated-runners.ts";
import { renderScopeDefinition } from "../src/domain/scope-definition.ts";
import { renderStageDefinition } from "../src/domain/stage-definition.ts";

export const createProjectionSetServices = (): ProjectionSetServices => ({ stage: renderStageDefinition, scope: renderScopeDefinition, agent: projectAgentDefinition, compiledAgent: projectAgentFromCompiledStages, skill: projectAuthoredSkill, runners: projectGeneratedRunners });
export const projectProjectionSet = createProjectionSet({ services: createProjectionSetServices() }).project;
