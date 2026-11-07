import type { HarnessBinding } from "../domain/harness-binding.ts";
import type { HarnessDocumentPlacement } from "../domain/harness-document.ts";

export type QualifiedHarnessProfile = Extract<HarnessBinding, { readonly harness: "claude" | "codex" | "cursor" | "kiro" | "kiro-ide" | "copilot" | "opencode" }> & {
  readonly tierFlavor?: "kiro";
  readonly nativePolicy?: "kas-personas";
  readonly agentPolicyNames?: readonly string[];
  readonly pluginAgentFrontmatter?: readonly string[];
  readonly agentMappings?: readonly { readonly src: string; readonly dst: string }[];
  readonly agentKnowledgeRead?: "kiro-chunks";
  readonly copyOnlyRoots: readonly { readonly src: string; readonly dst: string; readonly policy: "whole-file" }[];
  readonly nativeTextSources: readonly string[];
  readonly nativeReplacementCount: number;
  readonly onboardingDestinations: readonly (string | undefined)[];
  readonly agentTurnLimit: "authored-metadata" | null;
  readonly agentMemoryReference: "aidlc/active-memory" | null;
  readonly exactNativeReads: boolean;
  readonly modelInvocation: "native-default" | "disabled";
  readonly runtimeMappings: readonly { readonly src: string; readonly dst: string }[];
  readonly settingsMappings: readonly { readonly src: string; readonly dst: string }[];
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
const kiroAgents = ["architect", "developer", "product-lead", "architecture-reviewer", "composer", "product", "design", "delivery", "aws-platform", "compliance", "devsecops", "quality", "pipeline-deploy", "operations"];
const profiles: readonly QualifiedHarnessProfile[] = [
  {
    harness: "opencode", directory: ".aidlc", onboardingDestinations: ["AGENTS.md", ".aidlc/onboarding.md"], agentTurnLimit: "authored-metadata", copyOnlyRoots: [], nativeTextSources: [], nativeReplacementCount: 0, agentMemoryReference: "aidlc/active-memory", exactNativeReads: false, modelInvocation: "native-default", skillRoot: ".aidlc/skills", runtimeMappings: [], settingsMappings: [], settingsOnboardingPath: null, entryMapping: "manifest",
    entryDocuments: [
      { role: "main-skill", source: "skills/aidlc/SKILL.md", destination: ".aidlc/skills/aidlc/SKILL.md" },
      { role: "composer", source: "skills/aidlc/composer.md", destination: ".aidlc/skills/aidlc/composer.md" },
      { role: "question-rendering", source: "skills/aidlc/question-rendering.md", destination: ".aidlc/skills/aidlc/question-rendering.md" },
    ],
    referenceTemplate: "skills/aidlc/tables.md", referenceDestination: ".aidlc/skills/aidlc/tables.md",
    rootMappings: [{ src: "dot-gitignore", dst: ".gitignore" }, { src: "opencode.json", dst: "opencode.json" }], projectedRootPaths: ["AGENTS.md", "opencode.json"],
    descriptionPaths: [".gitignore", ".aidlc/tools/data/root-blocks/gitignore", ".aidlc/tools/data/root-blocks/agents", ".aidlc/tools/data/root-blocks/opencode.json", ".aidlc/tools/data/aidlc-projection.json", ".aidlc/tools/data/aidlc-stamp.json"],
  },
  {
    harness: "claude", directory: ".claude", onboardingDestinations: [undefined], agentTurnLimit: null, copyOnlyRoots: [], nativeTextSources: [], nativeReplacementCount: 0, agentMemoryReference: null, exactNativeReads: true, modelInvocation: "native-default", skillRoot: ".claude/skills", runtimeMappings: [], settingsMappings: [], settingsOnboardingPath: null, entryMapping: "manifest",
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
    harness: "codex", directory: ".codex", onboardingDestinations: ["AGENTS.md", ".codex/onboarding.md"], agentTurnLimit: null, copyOnlyRoots: [], nativeTextSources: [], nativeReplacementCount: 0, agentMemoryReference: null, exactNativeReads: false, modelInvocation: "disabled", skillRoot: ".agents/skills", runtimeMappings: [{ src: "hooks/aidlc-codex-adapter.ts", dst: "hooks/aidlc-codex-adapter.ts" }], settingsMappings: [], settingsOnboardingPath: ".codex/onboarding.md", entryMapping: "orchestrator",
    entryDocuments: [
      { role: "main-skill", source: "skills/aidlc/SKILL.md", destination: ".agents/skills/aidlc/SKILL.md" },
      { role: "composer", source: "skills/aidlc/composer.md", destination: ".agents/skills/aidlc/composer.md" },
      { role: "question-rendering", source: "skills/aidlc/question-rendering.md", destination: ".agents/skills/aidlc/question-rendering.md" },
    ],
    referenceTemplate: "skills/aidlc/tables.md", referenceDestination: ".agents/skills/aidlc/tables.md",
    rootMappings: [{ src: "dot-gitignore", dst: ".gitignore" }], projectedRootPaths: ["AGENTS.md"],
    descriptionPaths: [".gitignore", ".codex/tools/data/root-blocks/gitignore", ".codex/tools/data/root-blocks/agents", ".codex/tools/data/aidlc-projection.json", ".codex/tools/data/aidlc-stamp.json"],
  },
  {
    harness: "cursor", directory: ".cursor", onboardingDestinations: ["AGENTS.md", ".cursor/rules/aidlc-onboarding.mdc"], agentTurnLimit: "authored-metadata", exactNativeReads: true, modelInvocation: "native-default", skillRoot: ".cursor/skills", runtimeMappings: [{ src: "hooks/aidlc-cursor-adapter.ts", dst: "hooks/aidlc-cursor-adapter.ts" }], settingsMappings: [{ src: "hooks.json", dst: "hooks.json" }, { src: "cli.json", dst: "cli.json" }], settingsOnboardingPath: null, entryMapping: "manifest",
    copyOnlyRoots: [{ src: "install.ts", dst: "install.ts", policy: "whole-file" }], nativeTextSources: ["rules-aidlc.mdc"], nativeReplacementCount: 1, agentMemoryReference: "aidlc/active-memory",
    entryDocuments: [
      { role: "main-skill", source: "skills/aidlc/SKILL.md", destination: ".cursor/skills/aidlc/SKILL.md" },
      { role: "composer", source: "skills/aidlc/composer.md", destination: ".cursor/skills/aidlc/composer.md" },
      { role: "question-rendering", source: "skills/aidlc/question-rendering.md", destination: ".cursor/skills/aidlc/question-rendering.md" },
      { role: "method-import", source: "rules-aidlc.mdc", destination: ".cursor/rules/aidlc.mdc" },
      { role: "shortcut-status", source: "skills/aidlc-status/SKILL.md", destination: ".cursor/skills/aidlc-status/SKILL.md" },
      { role: "shortcut-jump", source: "skills/aidlc-jump/SKILL.md", destination: ".cursor/skills/aidlc-jump/SKILL.md" },
      { role: "shortcut-scope", source: "skills/aidlc-scope/SKILL.md", destination: ".cursor/skills/aidlc-scope/SKILL.md" },
      { role: "phase-ideation-guidance", source: "rules-aidlc-phase-ideation.mdc", destination: ".cursor/rules/aidlc-phase-ideation.mdc" },
      { role: "phase-inception-guidance", source: "rules-aidlc-phase-inception.mdc", destination: ".cursor/rules/aidlc-phase-inception.mdc" },
      { role: "phase-construction-guidance", source: "rules-aidlc-phase-construction.mdc", destination: ".cursor/rules/aidlc-phase-construction.mdc" },
      { role: "phase-operation-guidance", source: "rules-aidlc-phase-operation.mdc", destination: ".cursor/rules/aidlc-phase-operation.mdc" },
    ],
    referenceTemplate: "skills/aidlc/tables.md", referenceDestination: ".cursor/skills/aidlc/tables.md",
    rootMappings: [{ src: "dot-gitignore", dst: ".gitignore" }], projectedRootPaths: ["AGENTS.md"],
    descriptionPaths: [".gitignore", ".cursor/tools/data/root-blocks/gitignore", ".cursor/tools/data/root-blocks/agents", ".cursor/tools/data/aidlc-projection.json", ".cursor/tools/data/aidlc-stamp.json"],
  },
  {
    harness: "kiro", directory: ".kiro", onboardingDestinations: ["AGENTS.md", ".kiro/steering/aidlc-onboarding.md"], agentTurnLimit: "authored-metadata", agentKnowledgeRead: "kiro-chunks", copyOnlyRoots: [], nativeTextSources: [], nativeReplacementCount: 0, agentMemoryReference: null, exactNativeReads: true, modelInvocation: "native-default", skillRoot: ".kiro/skills", runtimeMappings: [{ src: "hooks/aidlc-kiro-adapter.ts", dst: "hooks/aidlc-kiro-adapter.ts" }], settingsMappings: ["agents/aidlc.json", "hooks/aidlc-record-human-turn.kiro.hook", "hooks/aidlc-plan-approval-guard.kiro.hook", "settings/cli.json", "settings/mcp.json"].map(path => ({ src: path, dst: path })), settingsOnboardingPath: null, entryMapping: "manifest",
    pluginAgentFrontmatter: ['tools: ["read", "write", "shell"]', "includeMcpJson: true"],
    agentMappings: kiroAgents.map(role => ({ src: `agents/aidlc-${role}-agent.json`, dst: `agents/aidlc-${role}-agent.json` })),
    entryDocuments: [
      { role: "main-skill", source: "skills/aidlc/SKILL.md", destination: ".kiro/skills/aidlc/SKILL.md" },
      { role: "composer", source: "skills/aidlc/composer.md", destination: ".kiro/skills/aidlc/composer.md" },
      { role: "question-rendering", source: "skills/aidlc/question-rendering.md", destination: ".kiro/skills/aidlc/question-rendering.md" },
    ],
    referenceTemplate: "skills/aidlc/tables.md", referenceDestination: ".kiro/skills/aidlc/tables.md",
    rootMappings: [{ src: "dot-gitignore", dst: ".gitignore" }], projectedRootPaths: ["AGENTS.md"],
    descriptionPaths: [".gitignore", ".kiro/tools/data/root-blocks/gitignore", ".kiro/tools/data/root-blocks/agents", ".kiro/tools/data/aidlc-projection.json", ".kiro/tools/data/aidlc-stamp.json"],
  },
  {
    harness: "kiro-ide", tierFlavor: "kiro", nativePolicy: "kas-personas", agentPolicyNames: kiroAgents.map(role => `aidlc-${role}-agent`), directory: ".kiro", onboardingDestinations: ["AGENTS.md", ".kiro/steering/aidlc-onboarding.md"], agentTurnLimit: "authored-metadata", agentKnowledgeRead: "kiro-chunks", copyOnlyRoots: [], nativeTextSources: [], nativeReplacementCount: 0, agentMemoryReference: null, exactNativeReads: true, modelInvocation: "native-default", skillRoot: ".kiro/skills", runtimeMappings: ["hooks/aidlc-kiro-adapter.ts", "hooks/aidlc-kiro-tool-names.ts"].map(path => ({ src: path, dst: path })), settingsMappings: ["agents/aidlc-aidlc.md", "steering/aidlc-active-memory.md", "settings/cli.json", ...["record-human-turn", "guard-tool-call", "log-subagent", "session-start", "continue-workflow"].map(name => `hooks/aidlc-${name}.json`)].map(path => ({ src: path, dst: path })), settingsOnboardingPath: null, entryMapping: "manifest",
    entryDocuments: [
      { role: "main-skill", source: "skills/aidlc/SKILL.md", destination: ".kiro/skills/aidlc/SKILL.md" },
      { role: "composer", source: "skills/aidlc/composer.md", destination: ".kiro/skills/aidlc/composer.md" },
      { role: "question-rendering", source: "skills/aidlc/question-rendering.md", destination: ".kiro/skills/aidlc/question-rendering.md" },
    ],
    referenceTemplate: "skills/aidlc/tables.md", referenceDestination: ".kiro/skills/aidlc/tables.md",
    rootMappings: [{ src: "dot-gitignore", dst: ".gitignore" }], projectedRootPaths: ["AGENTS.md"],
    descriptionPaths: [".gitignore", ".kiro/tools/data/root-blocks/gitignore", ".kiro/tools/data/root-blocks/agents", ".kiro/tools/data/aidlc-projection.json", ".kiro/tools/data/aidlc-stamp.json"],
  },
  {
    harness: "copilot", directory: ".aidlc", onboardingDestinations: ["AGENTS.md"], agentTurnLimit: "authored-metadata", copyOnlyRoots: [], nativeTextSources: [], nativeReplacementCount: 0, agentMemoryReference: "aidlc/active-memory", exactNativeReads: true, modelInvocation: "native-default", skillRoot: ".github/skills", runtimeMappings: [{ src: "hooks/aidlc-copilot-adapter.ts", dst: "hooks/aidlc-copilot-adapter.ts" }], settingsMappings: [], settingsOnboardingPath: null, entryMapping: "orchestrator",
    entryDocuments: [
      { role: "main-skill", source: "skills/aidlc/SKILL.md", destination: ".github/skills/aidlc/SKILL.md" },
      { role: "composer", source: "skills/aidlc/composer.md", destination: ".github/skills/aidlc/composer.md" },
      { role: "question-rendering", source: "skills/aidlc/question-rendering.md", destination: ".github/skills/aidlc/question-rendering.md" },
    ],
    referenceTemplate: "skills/aidlc/tables.md", referenceDestination: ".github/skills/aidlc/tables.md",
    rootMappings: [{ src: "dot-gitignore", dst: ".gitignore" }, { src: "dot-vscode-settings.json", dst: ".vscode/settings.json" }], projectedRootPaths: ["AGENTS.md"],
    descriptionPaths: [".gitignore", ".vscode/settings.json", ".aidlc/tools/data/root-blocks/gitignore", ".aidlc/tools/data/root-blocks/agents", ".aidlc/tools/data/aidlc-projection.json", ".aidlc/tools/data/aidlc-stamp.json"],
  },
];
// Admission is explicit; an unqualified host never inherits another host's policy.
export const qualifiedHarnessProfile = (binding: HarnessBinding): QualifiedHarnessProfile | null => profiles.find(profile => profile.harness === binding.harness && profile.directory === binding.directory) ?? null;
export const qualifiedDeliveryContext = (context: HarnessBinding & { readonly invocation: string }): boolean => qualifiedHarnessProfile(context) !== null && ["aidlc", `bun ${context.directory}/tools/aidlc.ts`].includes(context.invocation);

export const qualifiedHarnessByName = ({ name, harnessDir }: { readonly name: string; readonly harnessDir: string }): QualifiedHarnessProfile | null => profiles.find(profile => profile.harness === name && profile.directory === harnessDir) ?? null;

export type ExecutableDelivery = "copy" | "native";
export const qualifiedRootMappings = (profile: QualifiedHarnessProfile, delivery: ExecutableDelivery): readonly { readonly src: string; readonly dst: string }[] => [...profile.rootMappings, ...(delivery === "copy" ? profile.copyOnlyRoots : [])];
export const qualifiedDescriptionPaths = (binding: HarnessBinding, invocation: string | undefined): readonly string[] => {
  const profile = qualifiedHarnessProfile(binding);
  return profile === null ? [] : [...profile.descriptionPaths, ...(invocation === "aidlc" ? [] : profile.copyOnlyRoots.map(mapping => mapping.dst))];
};
