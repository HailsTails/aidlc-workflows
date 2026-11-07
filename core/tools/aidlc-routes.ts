import { UNIT_VERBS, type RouteNamespaceName } from "./aidlc-command.ts";

type Classification = "passthrough" | "translation" | "stub" | "routing-only" | "help";
type RouteKind =
  | "top-passthrough"
  | "top-prefix"
  | "top-stub"
  | "top-help"
  | "noun-passthrough"
  | "noun-map"
  | "custom"
  | "routing-only";

type HelpLine = {
  command: string;
  summary: string;
};

export type HelpSection = {
  label: string;
  forms: readonly string[];
};

type CustomRoute = "workspace" | "config" | "plugin" | "gen";
type RouteOnly = "hook" | "statusline" | "adapter" | "tool-passthrough";
type Visibility = "public" | "hidden" | "legacy";
export type RouteNamespace = RouteNamespaceName;
type ProjectRequirement = "none" | "optional" | "required";
export type PinPolicy = "active" | "inspect" | "pinned";
type NetworkPolicy = "forbidden" | "explicit-only" | "interactive-bounded" | "required";
export type MutationScope =
  | "none"
  | "project"
  | "machine"
  | "project-and-machine"
  | "user-home";

export type Route = {
  id: string;
  namespace: RouteNamespace;
  group: string;
  kind: RouteKind;
  classification: Classification;
  verbs: readonly string[];
  tool?: string;
  prefix?: readonly string[];
  targets?: Readonly<Record<string, string>>;
  custom?: CustomRoute;
  routeOnly?: RouteOnly;
  visibility: Visibility;
  projectRequirement: ProjectRequirement;
  pinPolicy: PinPolicy;
  networkPolicy: NetworkPolicy;
  mutationScope: MutationScope;
  outputModes: readonly ("human" | "quiet" | "json")[];
  human?: readonly HelpLine[];
  all?: readonly string[];
  helpSummary?: string;
  helpSections?: readonly HelpSection[];
  /** The tool answers `<verb> --help` with that verb's flags (#2449). */
  verbHelp?: true;
};


const PUBLIC_ENGINE = {
  namespace: "engine",
  visibility: "hidden",
  projectRequirement: "required",
  pinPolicy: "pinned",
  networkPolicy: "forbidden",
  mutationScope: "project",
  outputModes: ["human", "json"],
} as const;

const HIDDEN_ENGINE = {
  ...PUBLIC_ENGINE,
  visibility: "hidden",
} as const;


export const TOOLS = {
  attest: "aidlc-attest.ts",
  audit: "aidlc-audit.ts",
  bolt: "aidlc-bolt.ts",
  graph: "aidlc-graph.ts",
  doctor: "aidlc-doctor.ts",
  init: "aidlc-init.ts",
  jump: "aidlc-jump.ts",
  knowledge: "aidlc-knowledge.ts",
  testingPosture: "aidlc-testing-posture.ts",
  learnings: "aidlc-learnings.ts",
  log: "aidlc-log.ts",
  lifecycle: "aidlc-lifecycle.ts",
  machineConfig: "aidlc-machine-config.ts",
  completions: "aidlc-completions.ts",
  orchestrate: "aidlc-orchestrate.ts",
  plugin: "aidlc-plugin.ts",
  runnerGen: "aidlc-runner-gen.ts",
  runtime: "aidlc-runtime.ts",
  reviewBrief: "aidlc-review-brief.ts",
  sensor: "aidlc-sensor.ts",
  sensorClaimSources: "aidlc-sensor-claim-sources.ts",
  sensorLinter: "aidlc-sensor-linter.ts",
  sensorRequiredSections: "aidlc-sensor-required-sections.ts",
  sensorTraceability: "aidlc-sensor-traceability.ts",
  sensorTypeCheck: "aidlc-sensor-type-check.ts",
  sensorUpstreamCoverage: "aidlc-sensor-upstream-coverage.ts",
  state: "aidlc-state.ts",
  swarm: "aidlc-swarm.ts",
  unit: "aidlc-unit.ts",
  utility: "aidlc-utility.ts",
  validate: "aidlc-validate.ts",
  worktree: "aidlc-worktree.ts",
  workspaceSync: "aidlc-workspace-sync.ts",
} as const;

const SENSOR_WORKERS = [
  ["claim-sources", TOOLS.sensorClaimSources],
  ["linter", TOOLS.sensorLinter],
  ["required-sections", TOOLS.sensorRequiredSections],
  ["traceability", TOOLS.sensorTraceability],
  ["type-check", TOOLS.sensorTypeCheck],
  ["upstream-coverage", TOOLS.sensorUpstreamCoverage],
] as const;


// ROUTES_TABLE_START
export const ROUTES: readonly Route[] = [
  {
    id: "top-orchestrate",
    group: "top",
    kind: "top-passthrough",
    classification: "passthrough",
    verbs: ["next", "continue", "report", "park", "team-board"],
    tool: TOOLS.orchestrate,
    ...PUBLIC_ENGINE,
    namespace: "public",
    human: [
      { command: "next [args]", summary: "run the next orchestrator action" },
      { command: "report [args]", summary: "render the orchestrator report" },
      { command: "park [args]", summary: "park the current workflow" },
    ],
    all: [
      "next [args]",
      "continue <token>",
      "report [args]",
      "park [args]",
      "team-board [--snapshot] [--space <name>] [--intent <name>]",
    ],
  },
  {
    id: "unit",
    group: "unit",
    kind: "noun-passthrough",
    classification: "passthrough",
    verbs: [...UNIT_VERBS.keys()],
    tool: TOOLS.unit,
    ...PUBLIC_ENGINE,
    namespace: "public",
    mutationScope: "project",
    all: [
      "unit adopt <unit>",
      "unit claim <unit>",
      "unit gate <unit> --decision <approve|reject> (--user-input <text> | --request-file <file>)",
      "unit land <unit> [--step git|state|audit|all] [--target <branch>] [--accept-released-attempt --user-input <text>]",
      "unit merge-status <unit>",
      "unit participate",
      "unit pin <unit>",
      "unit publish <unit> [--commit]",
      "unit release <unit>",
      "unit share",
      "unit status",
    ],
  },
  {
    id: "top-compose",
    group: "top",
    kind: "top-prefix",
    classification: "translation",
    verbs: ["compose"],
    tool: TOOLS.orchestrate,
    prefix: ["next", "compose"],
    ...PUBLIC_ENGINE,
    namespace: "public",
    human: [{ command: "compose [args]", summary: "start composition through orchestrate next compose" }],
    all: ["compose [args]"],
  },
  {
    id: "top-status",
    group: "top",
    kind: "top-passthrough",
    classification: "passthrough",
    verbs: ["status"],
    tool: TOOLS.utility,
    ...PUBLIC_ENGINE,
    namespace: "engine",
    mutationScope: "none",
    human: [
      { command: "status [args]", summary: "show the current AIDLC status" },
    ],
    all: ["status [args]"],
  },
  {
    id: "top-recompose",
    group: "top",
    kind: "top-passthrough",
    classification: "passthrough",
    verbs: ["recompose"],
    tool: TOOLS.utility,
    ...PUBLIC_ENGINE,
    namespace: "engine",
    human: [
      { command: "recompose [args]", summary: "rerun composition through the utility handler" },
    ],
    all: ["recompose [args]"],
  },
  {
    id: "top-now",
    group: "top",
    kind: "top-passthrough",
    classification: "passthrough",
    verbs: ["now"],
    tool: TOOLS.utility,
    ...PUBLIC_ENGINE,
    namespace: "engine",
    mutationScope: "none",
    human: [{ command: "now", summary: "print the current UTC time for a document" }],
    all: ["now"],
  },
  {
    // The installed orchestrator skill, whole. A host command template prints
    // it into itself where the host cuts the skill tool's output (opencode).
    id: "top-skill-text",
    group: "top",
    kind: "top-passthrough",
    classification: "passthrough",
    verbs: ["skill-text"],
    tool: TOOLS.utility,
    ...HIDDEN_ENGINE,
    namespace: "engine",
    mutationScope: "none",
    all: ["skill-text [--harness-dir <dir>]"],
  },
  {
    id: "top-doctor",
    namespace: "public",
    group: "top",
    kind: "top-passthrough",
    classification: "passthrough",
    verbs: ["doctor"],
    tool: TOOLS.doctor,
    visibility: "public",
    projectRequirement: "optional",
    pinPolicy: "active",
    networkPolicy: "interactive-bounded",
    mutationScope: "project-and-machine",
    outputModes: ["human", "quiet", "json"],
    human: [
      { command: "doctor [--check-updates]", summary: "run environment diagnostics" },
    ],
    all: [
      "doctor [--verbose] [--json] [--quiet] [--check-updates] [--release-base-url <url>] [--ca-bundle <path>] [--offline] [--export] [--output <dir>]",
    ],
  },
  {
    id: "top-version",
    namespace: "public",
    group: "top",
    kind: "top-passthrough",
    classification: "passthrough",
    verbs: ["version"],
    tool: TOOLS.utility,
    visibility: "public",
    projectRequirement: "optional",
    pinPolicy: "active",
    networkPolicy: "forbidden",
    mutationScope: "none",
    outputModes: ["human", "json"],
    human: [{ command: "version [--json]", summary: "print the installed AIDLC version" }],
    all: ["version [--json]"],
  },
  {
    id: "top-help",
    namespace: "public",
    group: "top",
    kind: "top-help",
    classification: "help",
    verbs: ["help"],
    visibility: "public",
    projectRequirement: "none",
    pinPolicy: "active",
    networkPolicy: "forbidden",
    mutationScope: "none",
    outputModes: ["human"],
    all: ["help [--all]"],
  },
  {
    id: "top-config",
    namespace: "public",
    group: "top",
    kind: "top-passthrough",
    classification: "translation",
    verbs: ["config"],
    tool: TOOLS.init,
    visibility: "public",
    projectRequirement: "none",
    pinPolicy: "active",
    networkPolicy: "explicit-only",
    mutationScope: "project-and-machine",
    outputModes: ["human", "quiet", "json"],
    human: [{ command: "config [args]", summary: "configure, pin, or refresh this project" }],
    all: [
      "config [--harness <name>] [--from <path>|--download [--release-base-url <url>] [--ca-bundle <path>]] [--mcp <defaults|none>] [--pin <version>|--unpin] [--dry-run] [--yes] [--json] [--quiet] [--force] [--plan-token <token>] [--project-dir <path>]",
      "config models [--show [--json]|--check|--keep|--reset|--preset <name>|--from <preset|profile> --save-as <name>] [--local|--project|--global]",
      "config models [--deciding-effort <e>] [--reviewing-effort <e>] [--writing-up-effort <e>] [--agent <name> [--effort <e>] [--model <raw-id>]] [--session-model <id>] [--local|--project|--global] [--dry-run] [--yes] [--download [--release-base-url <url>] [--ca-bundle <path>]]",
      "config runtime [--show [--json]|--check|--record-paths|--reset] [--dry-run] [--yes] [--download [--release-base-url <url>] [--ca-bundle <path>]]",
      "config providers [--show [--json]|--check|--reset|--provider <current|amazon-bedrock|other>] [--region <region>] [--profile <profile>] [--opencode-default <yes|no>] [--acknowledge] [--mark-done <id>] [--dry-run] [--yes] [--download [--release-base-url <url>] [--ca-bundle <path>]]",
      "config trust [--show [--json]|--check|--acknowledge|--kiro-workflows <on|off>|--kiro-cli-workflows <on|off>|--kiro-terminal powershell|--reset] [--dry-run] [--yes] [--download [--release-base-url <url>] [--ca-bundle <path>]]",
      "config flags [--show [--json]|--check|--reset] [--default-scope <name>] [--swarm <on|off>] [--hook-debug <on|off>] [--sensor-timeout-ms <n>] [--question-retention-days <days|unlimited>] [--bypass <name>] [--clear-bypass <name>] [--local|--project|--global] [--dry-run] [--yes] [--download [--release-base-url <url>] [--ca-bundle <path>]]",
      "config project [--show [--json]|--check|--reset] [--plugins <names|all>] [--mcp <defaults|none>] [--completions <shell|none>] [--dry-run] [--yes] [--download [--release-base-url <url>] [--ca-bundle <path>]]",
      "config --pin <version> [--from <dir>] [--release-base-url <url>] [--ca-bundle <path>] [--offline]",
      "config --statusline <on|off> [--harness <claude|codex>] [--dry-run] [--json] [--project-dir <path>]",
      "config --unpin",
      "config --channel [stable|preview]",
    ],
  },
  {
    id: "top-update",
    namespace: "public",
    group: "top",
    kind: "top-passthrough",
    classification: "passthrough",
    verbs: ["update"],
    tool: TOOLS.lifecycle,
    visibility: "public",
    projectRequirement: "optional",
    pinPolicy: "active",
    networkPolicy: "explicit-only",
    mutationScope: "machine",
    outputModes: ["human", "quiet", "json"],
    human: [
      { command: "update [args]", summary: "install and activate a framework release" },
    ],
    all: [
      "update [--version <version>] [--channel <stable|preview>] [--from <dir>] [--release-base-url <url>] [--release-api-url <url>] [--ca-bundle <path>] [--offline] [--check|--dry-run] [--yes] [--json|--quiet]",
    ],
  },
  {
    id: "top-rollback",
    namespace: "system",
    group: "top",
    kind: "top-passthrough",
    classification: "passthrough",
    verbs: ["rollback"],
    tool: TOOLS.lifecycle,
    visibility: "hidden",
    projectRequirement: "optional",
    pinPolicy: "active",
    networkPolicy: "forbidden",
    mutationScope: "machine",
    outputModes: ["human", "quiet", "json"],
    all: ["rollback [<version>|--version <version>|--list] [--allow-harness-loss] [--yes]"],
  },
  {
    id: "top-use",
    namespace: "public",
    group: "top",
    kind: "top-passthrough",
    classification: "passthrough",
    verbs: ["use"],
    tool: TOOLS.lifecycle,
    visibility: "public",
    projectRequirement: "none",
    pinPolicy: "active",
    networkPolicy: "explicit-only",
    mutationScope: "machine",
    outputModes: ["human", "quiet", "json"],
    human: [{ command: "use <version>", summary: "select an exact machine release" }],
    all: [
      "use <version> [--from <dir>] [--release-base-url <url>] [--ca-bundle <path>] [--offline] [--yes] [--json|--quiet]",
    ],
  },
  {
    id: "top-uninstall",
    namespace: "public",
    group: "top",
    kind: "top-passthrough",
    classification: "passthrough",
    verbs: ["uninstall"],
    tool: TOOLS.lifecycle,
    visibility: "public",
    projectRequirement: "none",
    pinPolicy: "active",
    networkPolicy: "forbidden",
    mutationScope: "machine",
    outputModes: ["human", "quiet", "json"],
    human: [{ command: "uninstall [--purge]", summary: "remove the machine installation" }],
    all: ["uninstall [--purge] [--yes] [--allow-root] [--json|--quiet]"],
  },
  {
    id: "top-completions",
    namespace: "system",
    group: "completions",
    kind: "routing-only",
    classification: "routing-only",
    verbs: ["<shell>"],
    tool: TOOLS.completions,
    routeOnly: "tool-passthrough",
    visibility: "hidden",
    projectRequirement: "none",
    pinPolicy: "active",
    networkPolicy: "forbidden",
    mutationScope: "none",
    outputModes: ["human"],
    all: ["completions <bash|zsh|fish|powershell>"],
  },
  {
    id: "versions-list",
    namespace: "system",
    group: "versions",
    kind: "noun-passthrough",
    classification: "passthrough",
    verbs: ["list"],
    tool: TOOLS.lifecycle,
    prefix: ["versions"],
    visibility: "hidden",
    projectRequirement: "optional",
    pinPolicy: "active",
    networkPolicy: "forbidden",
    mutationScope: "none",
    outputModes: ["human", "quiet", "json"],
    human: [{ command: "versions list", summary: "inspect retained releases" }],
    all: ["list"],
  },
  {
    id: "versions-install",
    namespace: "system",
    group: "versions",
    kind: "noun-passthrough",
    classification: "passthrough",
    verbs: ["install"],
    tool: TOOLS.lifecycle,
    prefix: ["versions"],
    visibility: "hidden",
    projectRequirement: "optional",
    pinPolicy: "active",
    networkPolicy: "explicit-only",
    mutationScope: "machine",
    outputModes: ["human", "quiet", "json"],
    human: [{ command: "versions install", summary: "install a retained release" }],
    all: [
      "install <version> [--from <dir>] [--release-base-url <url>] [--ca-bundle <path>]",
    ],
  },
  {
    id: "versions-prune",
    namespace: "system",
    group: "versions",
    kind: "noun-passthrough",
    classification: "passthrough",
    verbs: ["prune"],
    tool: TOOLS.lifecycle,
    prefix: ["versions"],
    visibility: "hidden",
    projectRequirement: "none",
    pinPolicy: "active",
    networkPolicy: "forbidden",
    mutationScope: "machine",
    outputModes: ["human", "quiet", "json"],
    all: ["prune [--yes]"],
  },
  {
    id: "state-passthrough",
    group: "state",
    kind: "noun-passthrough",
    classification: "passthrough",
    tool: TOOLS.state,
    ...HIDDEN_ENGINE,
    verbs: [
      "get",
      "set",
      "set-skeleton-stance",
      "set-construction-iteration",
      "set-construction-checkpoints",
      "set-construction-execution",
      "set-construction-verification-command",
      "checkbox",
      "count",
      "advance",
      "finalize",
      "complete-workflow",
      "gate-start",
      // The review request runs it (aidlc-log.ts, completionChecksHold).
      "completion-checks",
      "approve",
      "reject",
      "revise",
      "skip",
      "resume",
      "acknowledge-compaction",
      "reuse-artifact",
      "lookup",
      "practices-event",
      "practices-promote",
      "set-unit-ownership",
      "set-unit-gate-rhythm",
      // The engine calls these itself once Delivery Planning records
      // `Construction Iteration: unit-major` with `Unit Ownership: team`: the
      // first two from aidlc-orchestrate.ts spawnState, fold-unit-merge from
      // aidlc-unit.ts runStateFold during `unit land`. Under bun both reach
      // aidlc-state.ts directly, so a missing entry here only ever surfaces on
      // a compiled install, where the engine's own call is refused.
      "refresh-unit-progress",
      "sync-unit-scope-stage",
      "fold-unit-merge",
      "fork",
      "merge",
      "park",
      "unpark",
      "unit",
    ],
    helpSections: [
      {
        label: "records",
        forms: [
          "get",
          "set",
          "set-status",
          "set-skeleton-stance",
          "set-construction-iteration",
          "set-construction-checkpoints",
          "set-construction-execution",
          "set-construction-verification-command",
          "checkbox",
          "count",
          "lookup",
        ],
      },
      {
        label: "lifecycle",
        forms: [
          "init",
          "advance",
          "finalize",
          "complete-workflow",
          "skip",
          "resume",
          "acknowledge-compaction",
          "reuse-artifact",
        ],
      },
      {
        label: "gates",
        forms: ["gate-start", "approve", "reject", "revise"],
      },
      {
        label: "practices",
        forms: ["practices-event", "practices-promote"],
      },
      {
        label: "fork/merge",
        forms: ["fork", "merge"],
      },
      {
        label: "parking",
        forms: ["park", "unpark"],
      },
    ],
  },
  {
    id: "state-utility",
    group: "state",
    kind: "noun-map",
    classification: "translation",
    verbs: ["set-status", "init"],
    tool: TOOLS.utility,
    ...HIDDEN_ENGINE,
    targets: { "set-status": "set-status", init: "state-init" },
  },
  {
    id: "audit-passthrough",
    group: "audit",
    kind: "noun-passthrough",
    classification: "passthrough",
    verbs: ["append", "append-batch", "append-raw", "history", "turns"],
    tool: TOOLS.audit,
    ...HIDDEN_ENGINE,
  },
  {
    id: "audit-renames",
    group: "audit",
    kind: "noun-map",
    classification: "translation",
    verbs: ["fork", "merge"],
    tool: TOOLS.audit,
    ...HIDDEN_ENGINE,
    targets: { fork: "audit-fork", merge: "audit-merge" },
  },
  {
    // Commit provenance. `resolve` is read-only attribution and `anchor` appends
    // a SOURCE_COMMITTED audit event, so the route mutates the project at most.
    // It is a public noun (`aidlc attest resolve`, no engine prefix) because it
    // is invoked by people and pipelines outside a workflow turn, but hidden
    // from the capped top-level help like the other non-`top` public nouns.
    // Never pinned: `attest` is not a PINNED_TOP_LEVEL_ROUTE, and the launcher
    // drift guard compares the two.
    id: "attest",
    group: "attest",
    kind: "noun-passthrough",
    classification: "passthrough",
    verbs: ["resolve", "anchor"],
    tool: TOOLS.attest,
    namespace: "public",
    visibility: "hidden",
    projectRequirement: "required",
    pinPolicy: "active",
    networkPolicy: "forbidden",
    mutationScope: "project",
    outputModes: ["human", "json"],
    human: [
      { command: "attest <verb>", summary: "resolve commits/diffs to reviewed units; anchor commits" },
    ],
    all: [
      "resolve [commit|--commit <rev>] [--diff <base>..<head>] [--record-ref <ref>] [--require-trust <level>] [--fail-on <statuses>]",
      "anchor [--commit <rev>] [--reconcile]",
    ],
  },
  {
    id: "graph",
    group: "graph",
    kind: "noun-passthrough",
    classification: "passthrough",
    verbs: [
      "artifacts",
      "producers",
      "consumers",
      "topo",
      "cycles",
      "scope",
      "validate-scope",
      "validate-grid",
      "ars",
      "compile",
      "resolve",
      "export",
    ],
    tool: TOOLS.graph,
    ...HIDDEN_ENGINE,
  },
  {
    id: "runtime",
    group: "runtime",
    kind: "noun-passthrough",
    classification: "passthrough",
    verbs: ["compile", "read", "summary", "fragment-fork", "fragment-merge"],
    tool: TOOLS.runtime,
    ...HIDDEN_ENGINE,
  },
  {
    id: "sensor",
    group: "sensor",
    kind: "noun-passthrough",
    classification: "passthrough",
    verbs: ["list", "describe", "fire"],
    tool: TOOLS.sensor,
    verbHelp: true,
    ...HIDDEN_ENGINE,
  },
  {
    id: "swarm",
    group: "swarm",
    kind: "noun-passthrough",
    classification: "passthrough",
    verbs: ["prepare", "check", "finalize", "allow-change"],
    tool: TOOLS.swarm,
    ...HIDDEN_ENGINE,
  },
  {
    id: "bolt",
    group: "bolt",
    kind: "noun-passthrough",
    classification: "passthrough",
    verbs: ["start", "complete", "fail", "abort", "set-autonomy", "checkpoint", "swarm-checkpoint", "dispatch-event", "hold-merge", "release-merge"],
    tool: TOOLS.bolt,
    verbHelp: true,
    ...HIDDEN_ENGINE,
  },
  {
    id: "worktree",
    group: "worktree",
    kind: "noun-passthrough",
    classification: "passthrough",
    verbs: ["create", "merge", "discard", "restore", "purge", "list", "verify", "info"],
    tool: TOOLS.worktree,
    verbHelp: true,
    ...HIDDEN_ENGINE,
  },
  {
    id: "jump",
    group: "jump",
    kind: "noun-passthrough",
    classification: "passthrough",
    verbs: ["resolve", "execute", "reopen"],
    tool: TOOLS.jump,
    ...HIDDEN_ENGINE,
  },
  {
    id: "log",
    group: "log",
    kind: "noun-passthrough",
    classification: "passthrough",
    verbs: ["decision", "answer", "answers", "review", "link"],
    tool: TOOLS.log,
    verbHelp: true,
    ...HIDDEN_ENGINE,
  },
  {
    id: "learnings",
    group: "learnings",
    kind: "noun-passthrough",
    classification: "passthrough",
    verbs: ["surface", "persist"],
    tool: TOOLS.learnings,
    ...HIDDEN_ENGINE,
  },
  {
    id: "testing-posture",
    group: "testing-posture",
    kind: "noun-passthrough",
    classification: "passthrough",
    verbs: ["resolve", "render", "fingerprint", "verify", "begin", "brief", "reply", "restore"],
    tool: TOOLS.testingPosture,
    ...HIDDEN_ENGINE,
  },
  {
    id: "validate",
    group: "validate",
    kind: "noun-passthrough",
    classification: "passthrough",
    verbs: ["outputs"],
    tool: TOOLS.validate,
    ...HIDDEN_ENGINE,
  },
  {
    id: "intent",
    group: "intent",
    kind: "custom",
    classification: "translation",
    verbs: ["list", "switch", "<name>", "create", "archive", "unarchive", "add-repo", "remove-repo", "set-repos", "add-checkout", "remove-checkout"],
    custom: "workspace",
    ...PUBLIC_ENGINE,
    human: [
      {
        command: "intent [list|switch|create|archive|unarchive|add-repo|remove-repo|set-repos|add-checkout|remove-checkout]",
        summary: "list, switch, create, archive, or unarchive intent context; add or remove one of its sibling repos or recorded checkouts, or set exactly which repos it covers",
      },
    ],
    all: [
      "list [--json] [--all]",
      "switch <name>",
      "<name>",
      "create [args]",
      "archive <name> [--reason <text>]",
      "unarchive <name>",
      "add-repo <name> [--url <address>] [--reason <text>]",
      "remove-repo <name>",
      "set-repos <name,...> | --all",
      "add-checkout <path>",
      "remove-checkout <path>",
    ],
  },
  {
    id: "space",
    group: "space",
    kind: "custom",
    classification: "translation",
    verbs: ["list", "switch", "<name>", "create"],
    custom: "workspace",
    ...PUBLIC_ENGINE,
    human: [{ command: "space [list|switch|create]", summary: "list, switch, or create a space" }],
    all: ["list", "switch <name>", "<name>", "create <name>"],
  },
  {
    id: "scope",
    group: "scope",
    kind: "noun-map",
    classification: "translation",
    verbs: ["change", "save", "detect", "resolve-env"],
    tool: TOOLS.utility,
    ...PUBLIC_ENGINE,
    targets: {
      change: "scope-change",
      save: "scope-save",
      detect: "detect-scope",
      "resolve-env": "resolve-env-scope",
    },
  },
  {
    id: "config-global",
    namespace: "system",
    group: "config",
    kind: "noun-passthrough",
    classification: "passthrough",
    verbs: ["global"],
    tool: TOOLS.machineConfig,
    visibility: "hidden",
    projectRequirement: "none",
    pinPolicy: "active",
    networkPolicy: "forbidden",
    mutationScope: "machine",
    outputModes: ["human", "quiet", "json"],
    all: ["global <get|set|clear|list>"],
  },
  {
    id: "config",
    group: "config",
    kind: "custom",
    classification: "translation",
    verbs: [
      "set depth",
      "set test-strategy",
      "set review",
      "set guard-policy",
      "set change-control",
      "set sensors",
      "set learnings",
      "set collaborators",
      "set summary-confirmation",
      "set plan-approval",
      "set guard.plan-approval",
      "set guard.review-freeze",
      "set guard.state-transition",
      "set guard.reviewer-scope",
      "get",
      "list",
    ],
    custom: "config",
    ...PUBLIC_ENGINE,
    visibility: "hidden",
    targets: {
      "set depth": "config-change",
      "set test-strategy": "config-change",
      "set review": "config-change",
      "set guard-policy": "config-change",
      // Retired spelling of guard-policy, accepted for one release.
      "set change-control": "config-change",
      "set sensors": "config-change",
      "set learnings": "config-change",
      "set collaborators": "config-change",
      "set summary-confirmation": "config-change",
      "set plan-approval": "config-change",
      "set guard.plan-approval": "config-change",
      "set guard.review-freeze": "config-change",
      "set guard.state-transition": "config-change",
      "set guard.reviewer-scope": "config-change",
      get: "config-get",
      list: "config-list",
    },
    human: [
      { command: "config get <key>", summary: "print supported project configuration" },
      { command: "config set <key> <value>", summary: "change supported project configuration" },
      { command: "config list", summary: "list supported project configuration" },
    ],
    all: ["set depth <value>", "set test-strategy <value>", "set review <value>", "set guard-policy <strict|relaxed|off>", "set sensors <on|off>", "set learnings <on|off>", "set summary-confirmation <on|off>", "set guard.<fence> <on|off>", "get <key>", "list"],
  },
  {
    id: "plugin",
    group: "plugin",
    kind: "custom",
    classification: "translation",
    verbs: ["select", "sync", "list", "validate", "build"],
    custom: "plugin",
    ...PUBLIC_ENGINE,
    visibility: "hidden",
    targets: {
      select: "select-plugins",
      sync: "sync",
      list: "list",
      validate: "plugin-validate",
      build: "plugin-build",
    },
    human: [
      { command: "plugin select [names]", summary: "set enabled plugins" },
      { command: "plugin list [--verbose|--json]", summary: "compare installed and composed plugins" },
      { command: "plugin sync [--prune-missing]", summary: "transactionally compose installed plugins" },
      { command: "plugin validate [path] [--with <base-root>]", summary: "validate an authored plugin" },
      { command: "plugin build <harness> [outDir]", summary: "build an authored plugin for a harness" },
    ],
    all: ["select [names]", "sync [--prune-missing] [--yes]", "list [--verbose] [--json]", "validate [path] [--with <base-root>]", "build <harness> [outDir]"],
  },
  {
    // The plugin AUTHORING surface (v2): `aidlc plugin validate` / `aidlc plugin
    // build` / `aidlc plugin test` run against a plugin checkout, which is
    // usually NOT an installed project, so this route is public, unpinned, and
    // carries no project requirement. The installed-plugin lifecycle
    // (select/sync/list) stays on the engine `plugin` noun above. The `test`
    // usage form is that verb's one list of options: its help and the flags
    // its handler accepts are both read from it.
    id: "plugin-author",
    group: "plugin",
    kind: "noun-map",
    classification: "translation",
    verbs: ["validate", "build", "test"],
    tool: TOOLS.utility,
    targets: { validate: "plugin-validate", build: "plugin-build", test: "plugin-test" },
    namespace: "public",
    visibility: "hidden",
    projectRequirement: "none",
    pinPolicy: "active",
    networkPolicy: "forbidden",
    mutationScope: "none",
    outputModes: ["human", "json"],
    all: [
      "validate [path] [--with <base-root>]",
      "build <harness> [outDir] [--plugin-root <path>]",
      "test [path] --install <project-root> [--harness <name>] [--with <base-root>] [--json]",
    ],
  },
  {
    // The DocumentKB noun. Unlike `plugin`, the verb IS the subcommand -- these
    // verbs live in their own tool -- so there is no `targets` translation table
    // to keep in step. Only the verbs the tool actually implements are listed:
    // registering a verb the tool would reject turns a clean "unknown verb"
    // error into a confusing one from a layer down.
    id: "knowledge",
    group: "knowledge",
    // `noun-passthrough`, NOT `top-passthrough`: this route's group is
    // "knowledge", and the two resolvers split on group. `resolveTop` only
    // iterates `group === "top"` routes, so it never saw this one; `resolveNoun`
    // did see it but handles only `noun-passthrough`/`noun-map`/`custom`/
    // `routing-only`, so it fell through to "unknown verb". The result was that
    // NO knowledge verb ran through the compiled dispatcher while the tool
    // itself worked perfectly when invoked directly -- which is why the defect
    // survived a review round in which it was reported, claimed fixed, and never
    // executed. The dispatcher test below runs every verb rather than asserting
    // this literal, because reading the route is exactly what missed it.
    kind: "noun-passthrough",
    classification: "passthrough",
    // `read-pdf` is the built-in PDF reader's child-process entry in a compiled binary (aidlc-knowledge.ts
    // extractDocument); it is routed but never listed in help.
    verbs: ["onboard", "sync", "list", "show", "associate", "dissociate", "rebind", "summarize", "help", "read-pdf"],
    tool: TOOLS.knowledge,
    ...PUBLIC_ENGINE,
    // ONE line in the human help, which is capped at 20 lines: it is a summary
    // for a person deciding what to type, not the surface. Every verb still
    // appears in `help --all` via `all` below.
    human: [
      { command: "knowledge <verb>", summary: "index and read customer documents" },
    ],
    all: [
      "onboard [path]", "sync", "list", "show <id>",
      "associate <id> --intent [slug]", "dissociate <id> --intent [slug]",
      "rebind <id> --to <path>",
      "summarize <id> --text-file <path> --source-revision <sha256>",
    ],
  },
  {
    id: "gen",
    group: "gen",
    kind: "custom",
    classification: "translation",
    verbs: ["runners", "runners --check", "runner-list", "runner-scopes", "stage-table", "scope-table"],
    custom: "gen",
    tool: TOOLS.runnerGen,
    ...HIDDEN_ENGINE,
    all: ["runners [args]", "runners --check", "runner-list", "runner-scopes", "stage-table [args]", "scope-table [args]"],
  },
  {
    id: "workspace",
    group: "workspace",
    kind: "noun-map",
    classification: "translation",
    verbs: [
      "detect",
      "reclassify",
      "codekb",
      "codekb-scope-diff",
      "codekb-snapshot",
      "codekb-publish",
      "project-description",
      "document-input",
    ],
    tool: TOOLS.utility,
    ...HIDDEN_ENGINE,
    targets: {
      detect: "detect",
      reclassify: "reclassify",
      codekb: "codekb-path",
      "codekb-scope-diff": "codekb-scope-diff",
      "codekb-snapshot": "codekb-snapshot",
      "codekb-publish": "codekb-publish",
      "project-description": "project-description",
      "document-input": "document-input",
    },
  },
  {
    id: "review-brief",
    group: "review-brief",
    kind: "noun-passthrough",
    classification: "passthrough",
    verbs: ["review", "context", "summary"],
    tool: TOOLS.reviewBrief,
    verbHelp: true,
    ...HIDDEN_ENGINE,
  },
  {
    id: "workspace-sync",
    namespace: "system",
    group: "workspace-sync",
    kind: "routing-only",
    classification: "routing-only",
    verbs: ["<args>"],
    tool: TOOLS.workspaceSync,
    routeOnly: "tool-passthrough",
    visibility: "hidden",
    projectRequirement: "required",
    pinPolicy: "pinned",
    networkPolicy: "required",
    mutationScope: "project",
    outputModes: ["human", "quiet", "json"],
    all: ["[--force] [--project-dir <path>]"],
  },
  {
    id: "engine-orchestrate",
    group: "orchestrate",
    kind: "noun-passthrough",
    classification: "passthrough",
    verbs: ["next", "continue", "report", "park", "wait", "team-board"],
    tool: TOOLS.orchestrate,
    ...HIDDEN_ENGINE,
    all: [
      "next [args]",
      "continue <token>",
      "report [args]",
      "park [args]",
      "wait --stage <slug> --for collaborators|artifacts|review [--unit <unit>] [--review-file <path>] [--timeout <seconds>]",
      "team-board [--snapshot] [--space <name>] [--intent <name>]",
    ],
  },
  {
    id: "engine-orchestrate-help",
    group: "orchestrate",
    kind: "noun-map",
    classification: "translation",
    verbs: ["help"],
    tool: TOOLS.utility,
    targets: { help: "help" },
    ...HIDDEN_ENGINE,
    all: ["help"],
  },
  ...SENSOR_WORKERS.map(([sensorId, tool]): Route => {
    const group = `sensor-${sensorId}`;
    return {
    id: `engine-${group}`,
    namespace: "engine",
    group,
    kind: "routing-only",
    classification: "routing-only",
    verbs: ["<args>"],
    tool,
    routeOnly: "tool-passthrough",
    visibility: "hidden",
    projectRequirement: "required",
    pinPolicy: "pinned",
    networkPolicy: "forbidden",
    mutationScope: "project",
    outputModes: ["human", "quiet", "json"],
  };
  }),
  {
    id: "system-lifecycle",
    namespace: "system",
    group: "lifecycle",
    kind: "routing-only",
    classification: "routing-only",
    verbs: ["<command>"],
    tool: TOOLS.lifecycle,
    routeOnly: "tool-passthrough",
    visibility: "hidden",
    projectRequirement: "optional",
    pinPolicy: "active",
    networkPolicy: "explicit-only",
    mutationScope: "machine",
    outputModes: ["human", "quiet", "json"],
    all: [
      "install-apply --from <dir> --version <version> [args]",
      "install-profile --profile <path> --bin-dir <path> [args]",
    ],
  },
  {
    id: "hook",
    group: "hook",
    kind: "routing-only",
    classification: "routing-only",
    verbs: ["<name>"],
    routeOnly: "hook",
    ...HIDDEN_ENGINE,
    all: ["<name>"],
  },
  {
    id: "statusline",
    group: "top",
    kind: "routing-only",
    classification: "routing-only",
    verbs: ["statusline"],
    routeOnly: "statusline",
    ...HIDDEN_ENGINE,
    all: ["statusline"],
  },
  {
    id: "adapter",
    group: "top",
    kind: "routing-only",
    classification: "routing-only",
    verbs: ["adapter"],
    routeOnly: "adapter",
    ...HIDDEN_ENGINE,
    all: ["adapter <harness> <target> [args]"],
  },
];
// ROUTES_TABLE_END
