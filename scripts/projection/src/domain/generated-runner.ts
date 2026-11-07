import type { HarnessBinding } from "./harness-binding.ts";
import type { SourceOrigin, SourceBasis, SourceContentDigest } from "./source-origin.ts";
import type { Outcome, DocumentSource } from "./model.ts";
import type { SkillNativeEmission } from "./skill-definition.ts";

export type RunnerRequest =
  | { readonly kind: "stage"; readonly slug: string }
  | { readonly kind: "scope"; readonly scope: string }
  | { readonly kind: "init" }
  | { readonly kind: "compose" };
export type GeneratedRunner = {
  readonly compiler: SourceOrigin;
  readonly owner: DocumentSource;
  readonly binding: HarnessBinding;
  readonly request: RunnerRequest;
  readonly name: string;
  readonly description: string;
  readonly markdown: string;
  readonly frontmatterInvocation: "disabled" | "enabled" | "unspecified";
};
export type RunnerCompiler = { readonly compile: (input: { readonly requests: readonly RunnerRequest[] }) => Outcome<readonly GeneratedRunner[]> };
export type RunnerInputDigest = SourceContentDigest;
export type RunnerInputSnapshot = { readonly basis: SourceBasis; readonly binding: HarnessBinding; readonly files: readonly { readonly path: string; readonly bytes: Uint8Array }[]; readonly directories: readonly { readonly path: string }[] };
export type RunnerDirectoryInput = { readonly path: string; readonly status: "present" | "absent" };
export type RunnerRequirementScope = "native-stage-and-scope-runners" | "native-generated-runners";
export type DiscoveredRunners = { readonly scope: RunnerRequirementScope; readonly binding: HarnessBinding; readonly compiler: SourceOrigin; readonly skillRoot: string; readonly runners: readonly GeneratedRunner[]; readonly inputs: readonly RunnerInputDigest[]; readonly directoryInputs: readonly RunnerDirectoryInput[] };
export type RunnerDiscovery = { readonly discover: () => Outcome<DiscoveredRunners> };
export type GeneratedRunnerContext = HarnessBinding & { readonly modelInvocation: "native-default" | "disabled" };
export type GeneratedRunnerProjection = SkillNativeEmission & { readonly compiler: SourceOrigin; readonly owner: DocumentSource; readonly request: RunnerRequest; readonly harness: HarnessBinding["harness"] };
export const runnerRequestKey = ({ request }: { readonly request: RunnerRequest }): string => {
  if (request.kind === "stage") return `stage:${request.slug}`;
  if (request.kind === "scope") return `scope:${request.scope}`;
  return request.kind;
};
