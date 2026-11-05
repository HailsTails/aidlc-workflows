import type { AgentPreparationInput } from "../domain/agent-preparation.ts";
import type { AgentNativeEmitter } from "../domain/agent-native.ts";
import type { SourceOrigin } from "../domain/source-origin.ts";
import type { SkillContext } from "../domain/skill-definition.ts";
import type { RunnerCompiler, RunnerRequest, GeneratedRunnerContext, GeneratedRunnerProjection } from "../domain/generated-runner.ts";
import type { NativeResource } from "../domain/native-rendering.ts";
import type { CompiledAgentStageCatalogue } from "../domain/compiled-agent-stages.ts";

export type AgentDefinitionProjection = AgentPreparationInput & { readonly emitter?: AgentNativeEmitter };
export type AuthoredSkillProjection = { readonly text: string; readonly origin: SourceOrigin; readonly context: SkillContext };
export type GeneratedRunnerProjectionRequest = { readonly compiler: RunnerCompiler; readonly requests: readonly RunnerRequest[]; readonly context: GeneratedRunnerContext };
export type GeneratedRunnerSet = { readonly runners: readonly GeneratedRunnerProjection[]; readonly resources: readonly NativeResource[] };
export type CompiledAgentProjectionRequest = Omit<AgentDefinitionProjection, "stages"> & { readonly catalogue: CompiledAgentStageCatalogue };
