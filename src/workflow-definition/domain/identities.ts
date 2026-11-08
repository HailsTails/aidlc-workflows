import { brand, type Brand } from "../../kernel/brand.ts";
import { accepted, refused, type Result } from "../../kernel/result.ts";

export type StageSlug = Brand<string, "StageSlug">;

export type ScopeName = Brand<string, "ScopeName">;

export type AgentSlug = Brand<string, "AgentSlug">;

export type ArtifactName = Brand<string, "ArtifactName">;

export type SensorId = Brand<string, "SensorId">;

export type PluginId = Brand<string, "PluginId">;

export type RuleId = Brand<string, "RuleId">;

export type HookName = Brand<string, "HookName">;

export type Owner =
  | { readonly kind: "core" }
  | { readonly kind: "plugin"; readonly plugin: PluginId }
  | { readonly kind: "project" };

export type DefinitionIdentity =
  | "stage"
  | "scope"
  | "agent"
  | "artifact"
  | "sensor"
  | "plugin"
  | "rule"
  | "hook";

export type IdentityRefusal = {
  readonly kind: "invalid-identity";
  readonly identity: DefinitionIdentity;
  readonly raw: string;
};

const KEBAB = /^[a-z][a-z0-9-]*$/;
const SCOPE = /^[A-Za-z0-9][A-Za-z0-9._+@-]*$/;
const RULE = /^[a-z][a-z0-9-]*(?:\/[a-z][a-z0-9-]*)*$/;
const CORE_NAMESPACE = "aidlc-";

const identity =
  <Identity extends Brand<string, string>>({
    identity,
    pattern,
  }: {
    readonly identity: IdentityRefusal["identity"];
    readonly pattern: RegExp;
  }) =>
  (raw: string): Result<Identity, IdentityRefusal> =>
    pattern.test(raw)
      ? accepted(brand<Identity>(raw))
      : refused({ kind: "invalid-identity", identity, raw });

export const stageSlug = identity<StageSlug>({ identity: "stage", pattern: KEBAB });

export const scopeName = identity<ScopeName>({ identity: "scope", pattern: SCOPE });

export const agentSlug = identity<AgentSlug>({ identity: "agent", pattern: KEBAB });

export const artifactName = identity<ArtifactName>({ identity: "artifact", pattern: KEBAB });

export const sensorId = identity<SensorId>({ identity: "sensor", pattern: KEBAB });

export const ruleId = identity<RuleId>({ identity: "rule", pattern: RULE });

export const hookName = identity<HookName>({ identity: "hook", pattern: KEBAB });

export const pluginId = (raw: string): Result<PluginId, IdentityRefusal> =>
  KEBAB.test(raw) && !raw.startsWith(CORE_NAMESPACE)
    ? accepted(brand<PluginId>(raw))
    : refused({ kind: "invalid-identity", identity: "plugin", raw });
