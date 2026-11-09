export const CONTEXTS = [
  "kernel",
  "workflow-definition",
  "projection",
  "packaging",
  "installation",
  "execution",
  "cli",
] as const;

export type ContextName = (typeof CONTEXTS)[number];

export type ContextRule = {
  readonly dependsOn: readonly ContextName[];
  readonly readsFileFormatsOf: readonly ContextName[];
  readonly composesRootsOf: readonly ContextName[];
  readonly instead: string;
};

export const CONTEXT_MAP: Readonly<Record<ContextName, ContextRule>> = {
  kernel: {
    dependsOn: [],
    readsFileFormatsOf: [],
    composesRootsOf: [],
    instead:
      "The kernel holds shared identity values and the one file-system implementer behind its " +
      "node-free port; move anything richer into its context.",
  },
  "workflow-definition": {
    dependsOn: ["kernel"],
    readsFileFormatsOf: [],
    composesRootsOf: [],
    instead:
      "Workflow Definition knows only authored method content; harness formats, project " +
      "files and runtime state belong downstream.",
  },
  projection: {
    dependsOn: ["kernel", "workflow-definition"],
    readsFileFormatsOf: [],
    composesRootsOf: [],
    instead:
      "Projection turns a Method into harness files; it never knows ownership, archives, " +
      "versions or project state.",
  },
  packaging: {
    dependsOn: ["kernel", "projection"],
    readsFileFormatsOf: [],
    composesRootsOf: [],
    instead:
      "Packaging takes a Projection value and never reaches stages or agents; take host " +
      "layout through the DistributionLayouts port.",
  },
  installation: {
    dependsOn: ["kernel", "packaging"],
    readsFileFormatsOf: ["packaging"],
    composesRootsOf: [],
    instead:
      "Installation reconciles a Payload into a project; everything it knows about a host " +
      "arrives in the Payload's descriptor or through a port method such as HostShell.",
  },
  execution: {
    dependsOn: ["kernel", "workflow-definition"],
    readsFileFormatsOf: [],
    composesRootsOf: [],
    instead:
      "Execution runs a Method; it never knows harness paths, projection or install. Take " +
      "host wording through the HostConversation port.",
  },
  cli: {
    dependsOn: [
      "kernel",
      "workflow-definition",
      "projection",
      "packaging",
      "installation",
      "execution",
    ],
    readsFileFormatsOf: [],
    composesRootsOf: [
      "workflow-definition",
      "projection",
      "packaging",
      "installation",
      "execution",
    ],
    instead: "The CLI routes and decodes only; put the decision in the context it belongs to.",
  },
};

export const MONOLITH_FILES = [
  "core/tools/aidlc-lib.ts",
  "core/tools/aidlc-orchestrate.ts",
  "core/tools/aidlc-init.ts",
] as const;

export const HARNESS_ADAPTER_FILES = [
  "harness/**",
  "src/hosts/**",
] as const;

export const HOST_BUNDLE_ROOT = "src/hosts" as const;

export type LegacyBridge = {
  readonly module: string;
  readonly readBy: string;
  readonly retiresWhen: string;
};

const SHIPPED_OWNER_MOVES =
  "Phase 2: its owner moves into src and ships in the runtime bundle (R1).";

const shippedOwner = (name: string, readBy: string): LegacyBridge => ({
  module: `core/tools/${name}.ts`,
  readBy,
  retiresWhen: SHIPPED_OWNER_MOVES,
});

export const SHIPPED_TYPE_BRIDGES: readonly LegacyBridge[] = [
  shippedOwner("aidlc-lib", "src/projection/domain/host-surface.ts"),
  shippedOwner("aidlc-runtime-paths", "src/projection/domain/host-surface.ts"),
];

export const LEGACY_BRIDGES: readonly LegacyBridge[] = [
  {
    module: "core/tools/aidlc-markdown.ts",
    readBy: "src/workflow-definition/adapters/markdown-outliner.ts",
    retiresWhen: "Packaging's ToolBundler ships src; the interpreter then moves into src.",
  },
  {
    module: "core/tools/aidlc-model-policy.ts",
    readBy: "src/projection/adapters/legacy-agent-surfaces.ts",
    retiresWhen:
      "Phase 2 model-policy cutover: its owner moves into src and ships in the runtime bundle " +
      "(R1), deleting agentTiersFromAuthoredDirectory, the unreachable authored-agents walk " +
      "the phase 1 freeze keeps in shipped bytes.",
  },
  shippedOwner("aidlc-tiers", "src/projection/adapters/legacy-tiers.ts"),
  shippedOwner("aidlc-runner-gen", "src/cli/legacy-runner-child.ts"),
  shippedOwner("aidlc-utility", "src/projection/adapters/legacy-skill-tables.ts"),
  shippedOwner("aidlc-settings", "src/projection/adapters/legacy-settings-schema.ts"),
  shippedOwner("aidlc-command", "src/projection/adapters/legacy-trusted-commands.ts"),
  shippedOwner("aidlc-runtime-budget", "src/projection/adapters/legacy-runtime-budget.ts"),
  shippedOwner("aidlc-launcher-voucher", "src/projection/adapters/legacy-launcher.ts"),
  shippedOwner("aidlc-includes", "src/projection/adapters/legacy-includes.ts"),
  shippedOwner("aidlc-inline-context", "src/projection/adapters/legacy-format-docs.ts"),
  {
    module: "core/tools/aidlc-plugin-emit.ts",
    readBy: "src/projection/adapters/legacy-plugin-emit.ts",
    retiresWhen:
      "Phase 2 plugin-tools cutover: its owner moves into src and ships in the runtime bundle " +
      "(R1), deleting the pluginReviewerAgents stage-file regex fallback that the shipped " +
      "plugin build and plugin test still reach.",
  },
  shippedOwner("aidlc", "src/projection/adapters/legacy-dispatcher.ts"),
  shippedOwner("aidlc-distribution", "src/packaging/adapters/legacy-distribution.ts"),
  shippedOwner("aidlc-version", "src/packaging/adapters/legacy-version.ts"),
  shippedOwner("aidlc-channel", "src/packaging/adapters/legacy-channel.ts"),
  shippedOwner("aidlc-archive", "src/packaging/adapters/legacy-archive.ts"),
];

const tools = (...names: readonly string[]): readonly string[] =>
  names.map((name) => `core/tools/aidlc-${name}.ts`);

export type LegacyTerritory = Readonly<Record<Exclude<ContextName, "kernel">, readonly string[]>>;

export const LEGACY_TERRITORY: LegacyTerritory = {
  "workflow-definition": tools(
    "stage-schema",
    "rule-schema",
    "sensor-schema",
    "graph",
    "artifact-vocabulary",
    "plugin-rules",
    "plugin-produces-kinds",
    "plugin-validate",
  ),
  projection: [
    "scripts/package.ts",
    "scripts/manifest-types.ts",
    "scripts/onboarding.ts",
    "scripts/harness-bindings.ts",
    "scripts/package-sources.ts",
    ...tools("tiers", "runner-gen", "plugin-emit", "plugin-build"),
  ],
  packaging: [
    "scripts/package-release.ts",
    "scripts/build-binaries.ts",
    "scripts/verify-release.ts",
    "scripts/copy-era-files.ts",
    ...tools("channel", "version", "release"),
  ],
  installation: tools(
    "update",
    "lifecycle",
    "distribution",
    "transaction",
    "uninstall-plan",
    "install-paths",
    "runtime-paths",
    "gitignore",
    "settings",
    "windows-uninstall",
    "machine-config",
    "native-launcher",
    "executable-path",
  ),
  execution: tools(
    "state",
    "record-core",
    "audit",
    "review-brief",
    "review-manifest",
    "review-records",
    "construction-checkpoints",
    "guard-fences",
    "guard-operation",
    "guard-switch",
    "unit",
    "unit-dag",
    "unit-holders",
    "unit-landing",
    "unit-walk-view",
    "swarm",
    "swarm-checkpoints",
    "swarm-source",
    "directive",
    "questions",
    "question-store",
    "plan-approval-ask",
    "jump",
    "attest",
    "learnings",
    "stage-diary",
    "locks",
    "message-store",
    "reply-reader",
    "recorded-switches",
    "validity",
    "brought-files",
    "sensor",
    "sensor-record",
    "bolt",
  ),
  cli: [
    "core/tools/aidlc.ts",
    ...tools("utility", "command", "completions", "hook-front-gate", "hook-trace"),
    "core/hooks/**",
  ],
};
