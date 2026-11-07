import type { HarnessBinding } from "../domain/harness-binding.ts";
import type { HarnessDocumentPlacement } from "../domain/harness-document.ts";

export type QualifiedHarnessProfile = Extract<HarnessBinding, { readonly harness: "claude" | "codex" }> & {
  readonly exactNativeReads: boolean;
  readonly modelInvocation: "native-default" | "disabled";
  readonly runtimeMappings: readonly { readonly src: string; readonly dst: string }[];
  readonly settingsOnboardingPath: string | null;
  readonly skillRoot: string;
  readonly entryDocuments: readonly HarnessDocumentPlacement[];
  readonly entryMapping: "manifest" | "orchestrator";
  readonly referenceTemplate: string;
  readonly referenceDestination: string;
  readonly rootMappings: readonly { readonly src: string; readonly dst: string }[];
  readonly projectedRootPaths: readonly string[];
  readonly descriptionPaths: readonly string[];
};
const profiles: readonly QualifiedHarnessProfile[] = [
  {
    harness: "claude", directory: ".claude", exactNativeReads: true, modelInvocation: "native-default", skillRoot: ".claude/skills", runtimeMappings: [], settingsOnboardingPath: null, entryMapping: "manifest",
    entryDocuments: [
      { role: "main-skill", source: "skills/aidlc/SKILL.md", destination: ".claude/skills/aidlc/SKILL.md" },
      { role: "composer", source: "skills/aidlc/composer.md", destination: ".claude/skills/aidlc/composer.md" },
      { role: "question-rendering", source: "skills/aidlc/question-rendering.md", destination: ".claude/skills/aidlc/question-rendering.md" },
      { role: "method-import", source: "rules-aidlc.md", destination: ".claude/rules/aidlc.md" },
    ],
    referenceTemplate: "skills/aidlc/tables.md", referenceDestination: ".claude/skills/aidlc/tables.md",
    rootMappings: [{ src: ".mcp.json", dst: ".mcp.json" }, { src: "dot-gitignore", dst: ".gitignore" }], projectedRootPaths: [],
    descriptionPaths: [".gitignore", ".mcp.json", ".claude/tools/data/root-blocks/gitignore", ".claude/tools/data/root-blocks/.mcp.json", ".claude/tools/data/aidlc-projection.json", ".claude/tools/data/aidlc-stamp.json"],
  },
  {
    harness: "codex", directory: ".codex", exactNativeReads: false, modelInvocation: "disabled", skillRoot: ".agents/skills", runtimeMappings: [{ src: "hooks/aidlc-codex-adapter.ts", dst: "hooks/aidlc-codex-adapter.ts" }], settingsOnboardingPath: ".codex/onboarding.md", entryMapping: "orchestrator",
    entryDocuments: [
      { role: "main-skill", source: "skills/aidlc/SKILL.md", destination: ".agents/skills/aidlc/SKILL.md" },
      { role: "composer", source: "skills/aidlc/composer.md", destination: ".agents/skills/aidlc/composer.md" },
      { role: "question-rendering", source: "skills/aidlc/question-rendering.md", destination: ".agents/skills/aidlc/question-rendering.md" },
    ],
    referenceTemplate: "skills/aidlc/tables.md", referenceDestination: ".agents/skills/aidlc/tables.md",
    rootMappings: [{ src: "dot-gitignore", dst: ".gitignore" }], projectedRootPaths: ["AGENTS.md"],
    descriptionPaths: [".gitignore", ".codex/tools/data/root-blocks/gitignore", ".codex/tools/data/root-blocks/agents", ".codex/tools/data/aidlc-projection.json", ".codex/tools/data/aidlc-stamp.json"],
  },
];
// Admission is explicit; an unqualified host never inherits another host's policy.
export const qualifiedHarnessProfile = (binding: HarnessBinding): QualifiedHarnessProfile | null => profiles.find(profile => profile.harness === binding.harness && profile.directory === binding.directory) ?? null;
export const qualifiedDeliveryContext = (context: HarnessBinding & { readonly invocation: string }): boolean => qualifiedHarnessProfile(context) !== null && ["aidlc", `bun ${context.directory}/tools/aidlc.ts`].includes(context.invocation);

export const qualifiedHarnessByName = ({ name, harnessDir }: { readonly name: string; readonly harnessDir: string }): QualifiedHarnessProfile | null => profiles.find(profile => profile.harness === name && profile.directory === harnessDir) ?? null;
