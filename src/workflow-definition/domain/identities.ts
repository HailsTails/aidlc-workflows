import type { Brand } from "../../kernel/brand.ts";
import { accepted, refused, type Result } from "../../kernel/result.ts";

export type StageSlug = Brand<string, "StageSlug">;

export type ScopeName = Brand<string, "ScopeName">;

export type AgentSlug = Brand<string, "AgentSlug">;

export type ArtifactName = Brand<string, "ArtifactName">;

export type SensorId = Brand<string, "SensorId">;

export type PluginId = Brand<string, "PluginId">;

export type Owner =
  | { readonly kind: "core" }
  | { readonly kind: "plugin"; readonly plugin: PluginId };

export type IdentityRefusal = {
  readonly kind: "invalid-identity";
  readonly identity: "stage" | "scope" | "agent" | "artifact" | "sensor" | "plugin";
  readonly raw: string;
};

const KEBAB = /^[a-z][a-z0-9-]*$/;
const SCOPE = /^[A-Za-z0-9][A-Za-z0-9._+@-]*$/;
const CORE_NAMESPACE = "aidlc-";

const identity =
  <Identity extends string>(kind: IdentityRefusal["identity"], pattern: RegExp) =>
  (raw: string): Result<Identity, IdentityRefusal> =>
    pattern.test(raw)
      ? accepted(raw as Identity)
      : refused({ kind: "invalid-identity", identity: kind, raw });

export const stageSlug = identity<StageSlug>("stage", KEBAB);

export const scopeName = identity<ScopeName>("scope", SCOPE);

export const agentSlug = identity<AgentSlug>("agent", KEBAB);

export const artifactName = identity<ArtifactName>("artifact", KEBAB);

export const sensorId = identity<SensorId>("sensor", KEBAB);

export const pluginId = (raw: string): Result<PluginId, IdentityRefusal> =>
  KEBAB.test(raw) && !raw.startsWith(CORE_NAMESPACE)
    ? accepted(raw as PluginId)
    : refused({ kind: "invalid-identity", identity: "plugin", raw });
