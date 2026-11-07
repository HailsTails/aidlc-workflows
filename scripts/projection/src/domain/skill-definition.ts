import type { HarnessBinding, Harness } from "./harness-binding.ts";
import type { SourceOrigin } from "./source-origin.ts";
import type { NativeResource } from "./native-rendering.ts";
import type { Outcome } from "./model.ts";

export type AuthoredSkill = {
  readonly origin: SourceOrigin;
  readonly name: string;
  readonly description: string;
  readonly argumentHint: string | null;
  readonly userInvocation: "enabled" | "disabled" | "native-default";
  readonly classification: string | null;
  readonly header: string;
  readonly body: string;
};
export type SkillContext = HarnessBinding & {
  readonly invocation: string;
  readonly rulesSubdir: "rules" | "aidlc-rules" | "steering";
  readonly memoryRoot: "aidlc/active-memory" | "aidlc/spaces/default/memory";
  readonly modelInvocation: "native-default" | "disabled";
};
export type SkillDiscovery =
  | { readonly kind: "native-directory"; readonly root: string }
  | { readonly kind: "configured-directory"; readonly root: string; readonly config: "opencode.json" };
export type SkillNativeEmission = {
  readonly entrypoint: string;
  readonly resources: readonly NativeResource[];
  readonly discovery: SkillDiscovery;
  readonly modelInvocation: "native-default" | "disabled";
};
export type SkillEmissionInput = { readonly skill: AuthoredSkill; readonly context: SkillContext; readonly markdown: string };
export type SkillNativeEmitter = { readonly emit: (input: SkillEmissionInput) => Outcome<SkillNativeEmission> };
export type SkillProjection = SkillNativeEmission & { readonly origin: SourceOrigin; readonly dependencies?: readonly SourceOrigin[]; readonly harness: Harness; readonly userInvocation: AuthoredSkill["userInvocation"] };
