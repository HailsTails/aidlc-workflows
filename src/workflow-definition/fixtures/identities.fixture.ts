import { accept } from "../../kernel/fixtures/accept.ts";
import {
  agentSlug,
  artifactName,
  scopeName,
  sensorId,
  stageSlug,
  type AgentSlug,
  type ArtifactName,
  type ScopeName,
  type SensorId,
  type StageSlug,
} from "../domain/identities.ts";

export const stage = (raw: string): StageSlug => accept(stageSlug(raw));

export const scope = (raw: string): ScopeName => accept(scopeName(raw));

export const agent = (raw: string): AgentSlug => accept(agentSlug(raw));

export const artifact = (raw: string): ArtifactName => accept(artifactName(raw));

export const sensor = (raw: string): SensorId => accept(sensorId(raw));

export const scopes = (...raws: readonly string[]): readonly ScopeName[] => raws.map(scope);
