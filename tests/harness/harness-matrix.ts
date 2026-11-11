import {
  DELEGATE_SHELL_FACTS,
} from "../../src/projection/fixtures/delegate-shell-facts.fixture.ts";
import { tokenBindingsFixture } from "../../src/projection/fixtures/token-bindings.fixture.ts";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { frontmatterBlock } from "../../core/tools/aidlc-lib.ts";
import {
  hostAgentMembers, HOST_BUILD_MEMBERS,
} from "../../src/cli/host-table.ts";
import type { OnboardingFills } from "../../src/projection/domain/neutral-surface.ts";
import { validateProjectionDescriptor, type ProjectionDescriptor, type ProjectionStamp }
  from "../../core/tools/aidlc-distribution.ts";
import type { PluginTargetTable } from "../../core/tools/aidlc-plugin-emit.ts";
import { distributionId, projectPath } from "../../src/kernel/values.ts";
import { accepted, refused } from "../../src/kernel/result.ts";

export type ShippedOnboarding = {
  dst: string;
  projectRoot?: true;
  harnessDst?: string;
  fills: OnboardingFills;
};

export type ShippedManifest = {
  name: string;
  harnessDir: string;
  rootIntegrations: ProjectionDescriptor["rootIntegrations"];
  orchestratorSkillPath: string;
  onboarding: ShippedOnboarding;
};

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const HARNESS_ROOT = join(REPO_ROOT, "harness");

type ReviewerScopeRegistration =
  | "claude-settings"
  | "codex-hooks"
  | "copilot-hooks"
  | "cursor-hooks"
  | "kiro-agent-json"
  | "opencode-plugin"
  | "unsupported";

type HarnessCapabilities = {
  harnessDir: string;
  onboarding: {
    dist: string;
    harnessDist: string;
  } & ({ mode: "manifest" | "emit"; fills: string } | { mode: "projection" });
  rootFiles: readonly string[];
  skillsRoot: string;
  plugin: {
    kind: "store" | "kiro" | "kiro-ide" | "cursor";
    manifestDir: string;
    marketplaceDir: string;
    wiringFile: string | null;
  };
  memoryInclude:
    | "claude-import"
    | "codex-engine"
    | "copilot-agents-md"
    | "cursor-rule"
    | "kiro-resources"
    | "kiro-steering"
    | "opencode-instructions";
  kiroAgentJson: boolean;
  ideAgentTools: boolean;
  reviewerScopeRegistration: ReviewerScopeRegistration;
};

// These are test capabilities, not packager instructions. Keeping every field
// explicit makes harness-specific test selection reviewable and prevents a new
// manifest from inheriting an accidental default.
const HARNESS_CAPABILITIES = {
  claude: {
    harnessDir: ".claude",
    onboarding: {
      mode: "projection",
      dist: ".claude/CLAUDE.md",
      harnessDist: ".claude/CLAUDE.md",
    },
    rootFiles: [".gitignore", ".mcp.json"],
    skillsRoot: ".claude/skills",
    plugin: {
      kind: "store",
      manifestDir: ".claude-plugin",
      marketplaceDir: ".claude-plugin",
      wiringFile: "hooks/hooks.json",
    },
    memoryInclude: "claude-import",
    kiroAgentJson: false,
    ideAgentTools: false,
    reviewerScopeRegistration: "claude-settings",
  },
  codex: {
    harnessDir: ".codex",
    onboarding: {
      mode: "projection",
      dist: "AGENTS.md",
      harnessDist: ".codex/onboarding.md",
    },
    rootFiles: [".gitignore", "AGENTS.md"],
    skillsRoot: ".agents/skills",
    plugin: {
      kind: "store",
      manifestDir: ".codex-plugin",
      marketplaceDir: ".agents/plugins",
      wiringFile: "hooks/hooks.json",
    },
    memoryInclude: "codex-engine",
    kiroAgentJson: false,
    ideAgentTools: false,
    reviewerScopeRegistration: "codex-hooks",
  },
  copilot: {
    harnessDir: ".aidlc",
    onboarding: {
      mode: "projection",
      dist: "AGENTS.md",
      harnessDist: "AGENTS.md",
    },
    rootFiles: [".gitignore", ".vscode/settings.json", "AGENTS.md"],
    skillsRoot: ".github/skills",
    plugin: {
      kind: "store",
      manifestDir: ".plugin",
      marketplaceDir: ".plugin",
      wiringFile: "hooks/hooks.json",
    },
    memoryInclude: "copilot-agents-md",
    kiroAgentJson: false,
    ideAgentTools: false,
    reviewerScopeRegistration: "copilot-hooks",
  },
  cursor: {
    harnessDir: ".cursor",
    onboarding: {
      mode: "projection",
      dist: "AGENTS.md",
      harnessDist: ".cursor/rules/aidlc-onboarding.mdc",
    },
    rootFiles: [".gitignore", "AGENTS.md", "install.ts"],
    skillsRoot: ".cursor/skills",
    plugin: {
      kind: "cursor",
      manifestDir: ".cursor-plugin",
      marketplaceDir: ".cursor-plugin",
      wiringFile: "hooks/hooks.json",
    },
    memoryInclude: "cursor-rule",
    kiroAgentJson: false,
    ideAgentTools: false,
    reviewerScopeRegistration: "cursor-hooks",
  },
  "kiro-ide": {
    harnessDir: ".kiro",
    onboarding: {
      mode: "projection",
      dist: "AGENTS.md",
      harnessDist: ".kiro/steering/aidlc-onboarding.md",
    },
    rootFiles: [".gitignore", "AGENTS.md"],
    skillsRoot: ".kiro/skills",
    plugin: {
      kind: "kiro-ide",
      manifestDir: ".kiro-plugin",
      marketplaceDir: ".kiro-plugin",
      wiringFile: ".kiro/hooks/aidlc-test-pro-compose.json",
    },
    memoryInclude: "kiro-steering",
    kiroAgentJson: false,
    ideAgentTools: true,
    reviewerScopeRegistration: "unsupported",
  },
  kiro: {
    harnessDir: ".kiro",
    onboarding: {
      mode: "projection",
      dist: "AGENTS.md",
      harnessDist: ".kiro/steering/aidlc-onboarding.md",
    },
    rootFiles: [".gitignore", "AGENTS.md"],
    skillsRoot: ".kiro/skills",
    plugin: {
      kind: "kiro",
      manifestDir: ".kiro-plugin",
      marketplaceDir: ".kiro-plugin",
      wiringFile: null,
    },
    memoryInclude: "kiro-resources",
    kiroAgentJson: true,
    ideAgentTools: true,
    reviewerScopeRegistration: "kiro-agent-json",
  },
  opencode: {
    harnessDir: ".aidlc",
    onboarding: {
      mode: "projection",
      dist: "AGENTS.md",
      harnessDist: ".aidlc/onboarding.md",
    },
    rootFiles: [".gitignore", "AGENTS.md", "opencode.json"],
    skillsRoot: ".aidlc/skills",
    plugin: {
      kind: "store",
      manifestDir: ".opencode-plugin",
      marketplaceDir: ".opencode-plugin",
      wiringFile: "hooks/hooks.json",
    },
    memoryInclude: "opencode-instructions",
    kiroAgentJson: false,
    ideAgentTools: false,
    reviewerScopeRegistration: "opencode-plugin",
  },
} as const satisfies Record<string, HarnessCapabilities>;

export type ShippedHarnessName = keyof typeof HARNESS_CAPABILITIES;

export type ShippedHarness = {
  name: ShippedHarnessName;
  manifest: ShippedManifest;
  capabilities: HarnessCapabilities;
  authoredRoot: string;
  distRoot: string;
  engineRoot: string;
  skillsRoot: string;
  fills: OnboardingFills;
  onboardingDist: string;
  harnessOnboardingDist: string;
};

function discoverManifestNames(): string[] {
  return HOST_BUILD_MEMBERS
    .map((member) => member.host.distribution).sort();
}

function fail(name: string, message: string): never {
  throw new Error(`harness matrix [${name}]: ${message}`);
}

export function agentFrontmatterGrantsIdeTools(file: string, lines: readonly string[]): boolean {
  return /^agents\/[^/]+\.md$/.test(file)
    && lines.some((line) => line.split(":", 1)[0]?.trim() === "tools");
}

export function manifestGrantsIdeAgentTools(
  manifest: { frontmatterAdditions?: ReadonlyArray<{ file: string; lines: readonly string[] }> },
): boolean {
  return manifest.frontmatterAdditions?.some(({ file, lines }) =>
    agentFrontmatterGrantsIdeTools(file, lines)) ?? false;
}

function validateEmittedAgentTools(name: ShippedHarnessName,
  manifest: Pick<ShippedManifest, "harnessDir">,
  capabilities: HarnessCapabilities): void {
  const directory = join(REPO_ROOT, "dist", name, manifest.harnessDir, "agents");
  const files = existsSync(directory)
    ? readdirSync(directory).filter((file) => file.endsWith(".md")) : [];
  if (capabilities.ideAgentTools && files.length === 0) {
    fail(name, "tools-capable emitted agent documents are missing");
  }
  for (const file of files) {
    const header = frontmatterBlock(readFileSync(join(directory, file), "utf8")) ?? "";
    const grantsTools = agentFrontmatterGrantsIdeTools(`agents/${file}`, header.split(/\r?\n/));
    if (grantsTools !== capabilities.ideAgentTools) {
      fail(name, `ideAgentTools does not agree with emitted agent ${file}`);
    }
  }
}

function producesConductorAgent(name: ShippedHarnessName,
  manifest: Pick<ShippedManifest, "harnessDir">): boolean {
  const distribution = distributionId(name);
  const directory = projectPath(manifest.harnessDir);
  if (!distribution.ok || !directory.ok) fail(name, "agent producer needs a valid host identity");
  const host = { distribution: distribution.value, directory: directory.value };
  const member = hostAgentMembers(host);
  if (!member.ok) fail(name, `agent producer was refused: ${JSON.stringify(member.refusal)}`);
  if (member.value === null) return false;
  const conductor = member.value.inputs.find((source) => source === "agents/aidlc.json");
  if (conductor === undefined) return false;
  const authored = join(HARNESS_ROOT, name, conductor);
  if (!existsSync(authored)) fail(name, "agent producer's captured conductor source is missing");
  const rendered = member.value.render({ host, channel: "copy",
    delegateShellFacts: DELEGATE_SHELL_FACTS,
    tokens: tokenBindingsFixture({ harnessDir: manifest.harnessDir }),
    persona: () => accepted(""), documents: () => accepted(""), tomlModels: () => accepted(""),
    inlineAgents: new Set(),
    files: [{ source: conductor,
      content: { kind: "text", text: readFileSync(authored, "utf8") } }],
    prepare: accepted, formatDocuments: new Set(),
    allows: { dispatcherCommands: [], toolScripts: [] },
    models: () => refused({ kind: "render-failed", concept: "agent", name: "aidlc",
      reason: "The conductor must preserve its model without persona model policy." }),
  }).renderConductorAgent({ knowledge: [] });
  if (!rendered.ok) {
    fail(name, `conductor producer was refused: ${JSON.stringify(rendered.refusal)}`);
  }
  return rendered.value.some((file) => file.path === `${manifest.harnessDir}/agents/aidlc.json`);
}

function fullHostDescriptor(name: ShippedHarnessName, directory: string): ProjectionDescriptor {
  const engine = join(REPO_ROOT, "dist", name, directory);
  const descriptorPath = join(engine, "tools/data/aidlc-projection.json");
  const stampPath = join(engine, "tools/data/aidlc-stamp.json");
  const descriptor = JSON.parse(readFileSync(descriptorPath, "utf8")) as ProjectionDescriptor;
  const stamp = JSON.parse(readFileSync(stampPath, "utf8")) as ProjectionStamp;
  validateProjectionDescriptor(join(REPO_ROOT, "dist", name), stamp, descriptor);
  return descriptor;
}

function validateFullHostAgentsAndPlugin(name: ShippedHarnessName,
  capabilities: HarnessCapabilities): void {
  const identity = { harnessDir: capabilities.harnessDir };
  if (producesConductorAgent(name, identity) !== capabilities.kiroAgentJson) {
    fail(name, "kiroAgentJson does not agree with the registered conductor producer");
  }
  validateEmittedAgentTools(name, identity, capabilities);
  const targetPath = join(REPO_ROOT, "dist", name, capabilities.harnessDir,
    "tools/data/plugin-targets.json");
  const targets = JSON.parse(readFileSync(targetPath, "utf8")) as PluginTargetTable;
  const plugin = targets[name];
  if (!plugin || plugin.kind !== capabilities.plugin.kind
    || plugin.manifestDir !== capabilities.plugin.manifestDir
    || plugin.marketplaceDir !== capabilities.plugin.marketplaceDir) {
    fail(name, "full-host plugin metadata disagrees");
  }
}

function nativeOnboardingPath(capabilities: HarnessCapabilities): string | undefined {
  const { harnessDist } = capabilities.onboarding;
  return harnessDist.startsWith(`${capabilities.harnessDir}/`) ? harnessDist : undefined;
}

function validateFullHostLayout({ name, descriptor, capabilities }: {
  name: ShippedHarnessName; descriptor: ProjectionDescriptor; capabilities: HarnessCapabilities;
}): void {
  if (descriptor.distribution !== name || descriptor.harnessDir !== capabilities.harnessDir) {
    fail(name, "full-host identity does not agree with the generated descriptor");
  }
  if (descriptor.onboarding !== nativeOnboardingPath(capabilities)) {
    fail(name, "full-host onboarding does not agree with the generated descriptor");
  }
  const roots = descriptor.rootIntegrations.map((root) => root.path).sort();
  if (roots.join("\n") !== [...capabilities.rootFiles].sort().join("\n")) {
    fail(name, "full-host root files do not agree with the generated descriptor");
  }
}

function insideDirectory(directory: string, path: string): string | null {
  return path.startsWith(`${directory}/`) ? path.slice(directory.length + 1) : null;
}

export function onboardingSpec({ directory, onboarding, fills }: {
  directory: string; onboarding: { dist: string; harnessDist: string }; fills: OnboardingFills;
}): ShippedOnboarding {
  const neutral = insideDirectory(directory, onboarding.dist);
  const native = onboarding.harnessDist === onboarding.dist
    ? null : insideDirectory(directory, onboarding.harnessDist);
  return { dst: neutral ?? onboarding.dist, ...(neutral === null ? { projectRoot: true } : {}),
    ...(native === null ? {} : { harnessDst: native }), fills };
}

export function onboardingFillsSource(name: ShippedHarnessName): string {
  return `src/hosts/${name}/onboarding-fills.ts`;
}

export function fullHostView(name: ShippedHarnessName, capabilities: HarnessCapabilities): {
  manifest: ShippedManifest; fills: OnboardingFills;
} | null {
  const member = HOST_BUILD_MEMBERS.find((candidate) =>
    candidate.host.distribution === name);
  if (!member) return null;
  if (capabilities.onboarding.mode !== "projection") {
    fail(name, "full-host onboarding needs projection metadata");
  }
  const descriptor = fullHostDescriptor(name, member.host.directory);
  validateFullHostLayout({ name, descriptor, capabilities });
  const includes = new Set(member.placements.map((placement) => placement.destination));
  const importsMemory = includes.has(`${member.host.directory}/rules/aidlc.md`);
  if ((capabilities.memoryInclude === "claude-import") !== importsMemory) {
    fail(name, "memoryInclude does not agree with the registered include surfaces");
  }
  validateFullHostAgentsAndPlugin(name, capabilities);
  return { fills: member.fills, manifest: { name, harnessDir: descriptor.harnessDir,
    rootIntegrations: descriptor.rootIntegrations,
    orchestratorSkillPath: `${capabilities.skillsRoot}/aidlc/SKILL.md`,
    onboarding: onboardingSpec({ directory: descriptor.harnessDir,
      onboarding: capabilities.onboarding, fills: member.fills }),
  } };
}

const discoveredNames = discoverManifestNames();
const metadataNames = Object.keys(HARNESS_CAPABILITIES).sort();
if (discoveredNames.join("\n") !== metadataNames.join("\n")) {
  throw new Error(
    "harness matrix metadata must exactly cover discovered manifests\n" +
      `discovered: ${discoveredNames.join(", ")}\n` +
      `metadata: ${metadataNames.join(", ")}\n` +
      "fix: add a HARNESS_CAPABILITIES entry for the new harness in " +
      "tests/harness/harness-matrix.ts (validateManifest cross-checks it " +
      "against the manifest, so every field must reflect the real distribution)",
  );
}

export const HARNESS_MATRIX: readonly ShippedHarness[] = discoveredNames.map((rawName) => {
  const name = rawName as ShippedHarnessName;
  const authoredRoot = join(HARNESS_ROOT, name);
  const capabilities: HarnessCapabilities = HARNESS_CAPABILITIES[name];
  const view = fullHostView(name, capabilities);
  if (!view) fail(name, "the declared complete host is not registered");
  const { manifest, fills } = view;

  const distRoot = join(REPO_ROOT, "dist", name);
  const engineRoot = join(distRoot, manifest.harnessDir);
  const onboardingDist = join(distRoot, capabilities.onboarding.dist);
  const harnessOnboardingDist = join(distRoot, capabilities.onboarding.harnessDist);
  const skillsRoot = join(distRoot, capabilities.skillsRoot);
  for (const [label, path] of [
    ["dist root", distRoot],
    ["engine root", engineRoot],
    ["onboarding dist", onboardingDist],
    ["harness onboarding dist", harnessOnboardingDist],
    ["skills root", skillsRoot],
  ]) {
    if (!existsSync(path)) fail(name, `${label} is missing: ${path}`);
  }

  return {
    name,
    manifest,
    capabilities,
    authoredRoot,
    distRoot,
    engineRoot,
    skillsRoot,
    fills,
    onboardingDist,
    harnessOnboardingDist,
  };
});

export function harnessByName(name: ShippedHarnessName): ShippedHarness {
  const harness = HARNESS_MATRIX.find((candidate) => candidate.name === name);
  if (!harness) fail(name, "not discovered");
  return harness;
}
