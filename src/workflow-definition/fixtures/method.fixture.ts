import { brand } from "../../kernel/brand.ts";
import { accept } from "../../kernel/fixtures/accept.ts";
import type { Agent, PersonaAdditions } from "../domain/agent.ts";
import type { KnowledgeDocument } from "../domain/knowledge.ts";
import type { CompiledMethod, Method } from "../domain/method.ts";
import type { AuthoredBody } from "../domain/outline.ts";
import type { Rule } from "../domain/rule.ts";
import type { Scope, ScopeMembership } from "../domain/scope.ts";
import type { SensorDeclaration, SensorFieldShape } from "../domain/sensor.ts";
import type { Stage } from "../domain/stage.ts";
import { stageNumber } from "../domain/stage-graph.ts";
import { authoredBody } from "./authored-body.fixture.ts";
import { agent, artifact, rule, scope, scopes, sensor, stage } from "./identities.fixture.ts";
import { methodSource } from "./method-source.fixture.ts";

const core = { kind: "core" } as const;

const noAdditions: PersonaAdditions = { afterPreflight: [], endOfBody: [] };

const value = (type: string): SensorFieldShape => ({ kind: "value", type });

const persona = (role: string): AuthoredBody =>
  authoredBody([{ level: 1, title: role, prose: `\nYou are the ${role} for this AI-DLC run.\n` }]);

const instructions = ({
  title,
  steps,
}: {
  readonly title: string;
  readonly steps: readonly string[];
}): AuthoredBody =>
  authoredBody([
    { level: 1, title, prose: "\n" },
    { level: 2, title: "Steps", prose: "\n" },
    ...steps.map((step, index) => ({
      level: 3 as const,
      title: `Step ${index + 1}: ${step}`,
      prose: "\n",
    })),
  ]);

const productAgent: Agent = {
  slug: agent("aidlc-product-agent"),
  source: methodSource({ kind: "agent", within: "aidlc-product-agent.md" }),
  displayName: "Product Agent",
  description:
    "Product manager and business analyst responsible for requirements, user stories, " +
    "market research, and scope.",
  owner: core,
  model: { kind: "tier", tier: "judgment" },
  examples: ["roadmap.md", "personas.md"],
  tools: { disallowed: ["Task"] },
  maxTurns: null,
  persona: persona("Product Agent"),
  additions: noAdditions,
};

const architectAgent: Agent = {
  slug: agent("aidlc-architect-agent"),
  source: methodSource({ kind: "agent", within: "aidlc-architect-agent.md" }),
  displayName: "Architect Agent",
  description:
    "Solutions architect responsible for domain design, contract design, NFR patterns, " +
    "and component decomposition.",
  owner: core,
  model: { kind: "tier", tier: "judgment" },
  examples: ["tech-stack.md", "infrastructure-preferences.md"],
  tools: { disallowed: ["Task"] },
  maxTurns: null,
  persona: persona("Architect Agent"),
  additions: noAdditions,
};

const deliveryAgent: Agent = {
  slug: agent("aidlc-delivery-agent"),
  source: methodSource({ kind: "agent", within: "aidlc-delivery-agent.md" }),
  displayName: "Delivery Agent",
  description:
    "Engineering manager responsible for team formation, Bolt sequencing, and phase handoffs.",
  owner: core,
  model: { kind: "tier", tier: "templated" },
  examples: ["sprint-cadence.md", "definition-of-done.md"],
  tools: { disallowed: ["Task"] },
  maxTurns: null,
  persona: persona("Delivery Agent"),
  additions: noAdditions,
};

const developerAgent: Agent = {
  slug: agent("aidlc-developer-agent"),
  source: methodSource({ kind: "agent", within: "aidlc-developer-agent.md" }),
  displayName: "Developer Agent",
  description:
    "Senior developer responsible for code generation, reverse engineering, and data modelling.",
  owner: core,
  model: { kind: "tier", tier: "judgment" },
  examples: ["db-conventions.md", "error-handling.md"],
  tools: { disallowed: ["Task"] },
  maxTurns: null,
  persona: persona("Developer Agent"),
  additions: noAdditions,
};

const productLeadAgent: Agent = {
  slug: agent("aidlc-product-lead-agent"),
  source: methodSource({ kind: "agent", within: "aidlc-product-lead-agent.md" }),
  displayName: "Product Lead",
  description:
    "Senior product leader who reviews requirements, user stories, and UX artifacts for " +
    "completeness, business alignment, and testability.",
  owner: core,
  model: { kind: "tier", tier: "balanced" },
  examples: [],
  tools: { disallowed: ["Task"] },
  maxTurns: 60,
  persona: persona("Product Lead"),
  additions: noAdditions,
};

const architectureReviewerAgent: Agent = {
  slug: agent("aidlc-architecture-reviewer-agent"),
  source: methodSource({ kind: "agent", within: "aidlc-architecture-reviewer-agent.md" }),
  displayName: "Architecture Reviewer",
  description:
    "Senior solutions architect who reviews technical design artifacts for soundness, " +
    "implementability, and coherence.",
  owner: core,
  model: { kind: "tier", tier: "balanced" },
  examples: [],
  tools: { disallowed: ["Task"] },
  maxTurns: 60,
  persona: persona("Architecture Reviewer"),
  additions: noAdditions,
};

const everyScope = scopes(
  "enterprise",
  "feature",
  "mvp",
  "poc",
  "bugfix",
  "refactor",
  "infra",
  "security-patch",
  "classic",
  "workshop",
  "express",
);

const requirementsAnalysis: Stage = {
  slug: stage("requirements-analysis"),
  source: methodSource({ kind: "stage", within: "inception/requirements-analysis.md" }),
  displayName: "Requirements Analysis",
  phase: "inception",
  orderingHint: null,
  owner: core,
  execution: {
    trigger: "always",
    condition: "Always executes — depth scales with project complexity",
  },
  participation: {
    mode: "inline",
    lead: { kind: "agent", agent: productAgent.slug },
    supports: [],
  },
  cardinality: { kind: "once" },
  writesWorkspace: false,
  produces: [
    { artifact: artifact("requirements"), obligation: "required", unitKinds: "all" },
    {
      artifact: artifact("requirements-analysis-questions"),
      obligation: "required",
      unitKinds: "all",
    },
    { artifact: artifact("traceability"), obligation: "optional", unitKinds: "all" },
  ],
  consumes: [
    { artifact: artifact("intent-statement"), required: false, when: "always", cited: true },
    { artifact: artifact("scope-document"), required: false, when: "always", cited: true },
    { artifact: artifact("business-overview"), required: false, when: "brownfield", cited: false },
    { artifact: artifact("architecture"), required: false, when: "brownfield", cited: false },
    { artifact: artifact("code-structure"), required: false, when: "brownfield", cited: false },
    { artifact: artifact("team-practices"), required: false, when: "always", cited: false },
  ],
  requires: [stage("approval-handoff"), stage("reverse-engineering")],
  sensors: [sensor("required-sections"), sensor("upstream-coverage")],
  review: {
    reviewer: productLeadAgent.slug,
    artifact: artifact("requirements"),
    maxIterations: 2,
    reviewClass: "advisory",
  },
  summaryConfirmation: "required",
  activation: { kind: "always" },
  composerPrior: null,
  requiredSections: [],
  briefing: {
    inputs:
      "RE artifacts (if brownfield), authoritative project description " +
      "(project-description utility)",
    outputs:
      "requirements.md, requirements-analysis-questions.md, traceability.json " +
      "(under this stage's record dir, engine-resolved)",
    instructions: instructions({
      title: "Requirements Analysis",
      steps: ["Analyze the request", "Ask the open questions", "Write the requirements"],
    }),
  },
};

const unitsGeneration: Stage = {
  slug: stage("units-generation"),
  source: methodSource({ kind: "stage", within: "inception/units-generation.md" }),
  displayName: "Units Generation",
  phase: "inception",
  orderingHint: null,
  owner: core,
  execution: {
    trigger: "always",
    condition:
      "Always executes when in scope. Produces the dependency DAG that Stage 2.9 " +
      "Delivery Planning consumes for Bolt sequencing.",
  },
  participation: {
    mode: "inline",
    lead: { kind: "agent", agent: architectAgent.slug },
    supports: [deliveryAgent.slug],
  },
  cardinality: { kind: "once" },
  writesWorkspace: false,
  produces: [
    { artifact: artifact("unit-of-work"), obligation: "required", unitKinds: "all" },
    { artifact: artifact("unit-of-work-dependency"), obligation: "required", unitKinds: "all" },
    { artifact: artifact("unit-of-work-story-map"), obligation: "required", unitKinds: "all" },
    { artifact: artifact("traceability"), obligation: "required", unitKinds: "all" },
  ],
  consumes: [
    { artifact: artifact("components"), required: true, when: "always", cited: false },
    { artifact: artifact("decisions"), required: false, when: "always", cited: false },
    { artifact: artifact("requirements"), required: true, when: "always", cited: false },
    { artifact: artifact("stories"), required: false, when: "always", cited: false },
  ],
  requires: [stage("domain-design")],
  sensors: [sensor("required-sections"), sensor("upstream-coverage"), sensor("traceability")],
  review: {
    reviewer: architectureReviewerAgent.slug,
    artifact: artifact("unit-of-work"),
    maxIterations: 2,
    reviewClass: "advisory",
  },
  summaryConfirmation: "required",
  activation: { kind: "always" },
  composerPrior: null,
  requiredSections: [],
  briefing: {
    inputs:
      "<record>/inception/domain-design/components.md, " +
      "<record>/inception/requirements-analysis/requirements.md",
    outputs:
      "unit-of-work.md, unit-of-work-dependency.md, unit-of-work-story-map.md, " +
      "traceability.json (under this stage's record dir, engine-resolved)",
    instructions: instructions({
      title: "Units Generation",
      steps: ["Decompose into units", "Map stories"],
    }),
  },
};

const codeGeneration: Stage = {
  slug: stage("code-generation"),
  source: methodSource({ kind: "stage", within: "construction/code-generation.md" }),
  displayName: "Code Generation",
  phase: "construction",
  orderingHint: null,
  owner: core,
  execution: {
    trigger: "always",
    condition: "Always executes for every unit in the execution plan.",
  },
  participation: {
    mode: "subagent",
    lead: { kind: "agent", agent: developerAgent.slug },
    supports: [],
  },
  cardinality: { kind: "per-unit" },
  writesWorkspace: true,
  produces: [
    { artifact: artifact("code-generation-plan"), obligation: "required", unitKinds: "all" },
    { artifact: artifact("unit-test-instructions"), obligation: "required", unitKinds: "all" },
    { artifact: artifact("code-summary"), obligation: "required", unitKinds: "all" },
    { artifact: artifact("traceability"), obligation: "required", unitKinds: "all" },
  ],
  consumes: [
    { artifact: artifact("functional-spec"), required: false, when: "always", cited: false },
    { artifact: artifact("unit-of-work"), required: true, when: "always", cited: false },
    { artifact: artifact("requirements"), required: true, when: "always", cited: false },
  ],
  requires: [
    stage("units-generation"),
    stage("functional-design"),
    stage("nfr-requirements"),
    stage("nfr-design"),
    stage("infrastructure-design"),
  ],
  sensors: [sensor("required-sections"), sensor("traceability")],
  review: {
    reviewer: architectureReviewerAgent.slug,
    artifact: artifact("code-generation-plan"),
    maxIterations: 2,
    reviewClass: "adversarial",
  },
  summaryConfirmation: "none",
  activation: { kind: "always" },
  composerPrior: null,
  requiredSections: [],
  briefing: {
    inputs: "ALL prior design artifacts for this unit",
    outputs:
      "application code + code-generation-plan.md, unit-test-instructions.md, " +
      "code-summary.md, traceability.json (under this stage's per-unit record dir)",
    instructions: instructions({
      title: "Code Generation",
      steps: ["Plan the code", "Generate the code"],
    }),
  },
};

const classicScope: Scope = {
  name: scope("classic"),
  source: methodSource({ kind: "scope", within: "aidlc-classic.md" }),
  owner: core,
  description: "V1-style ceremony through Inception and Construction - the implicit default",
  keywords: [],
  depth: "standard",
  testStrategy: null,
  runner: false,
  skeleton: false,
  existingCode: false,
  guardPolicy: "off",
  ceremony: {
    sensors: "on",
    learnings: "on",
    "summary-confirmation": "off",
    "plan-approval": "on",
    collaborators: "off",
  },
  reviewCap: "advisory",
  guidance: "# classic scope",
};

const featureScope: Scope = {
  name: scope("feature"),
  source: methodSource({ kind: "scope", within: "aidlc-feature.md" }),
  owner: core,
  description: "Full lifecycle for new features, practical depth",
  keywords: [],
  depth: "standard",
  testStrategy: null,
  runner: true,
  skeleton: true,
  existingCode: false,
  guardPolicy: "off",
  ceremony: {
    sensors: "on",
    learnings: "on",
    "summary-confirmation": "on",
    "plan-approval": "on",
    collaborators: "off",
  },
  reviewCap: null,
  guidance: "# feature scope",
};

const requiredSectionsSensor: SensorDeclaration = {
  id: sensor("required-sections"),
  source: methodSource({ kind: "sensor", within: "aidlc-required-sections.md" }),
  owner: core,
  description: "Checks at the gate that stage output contains the required H2 headings",
  category: "document-shape",
  command: "{{INVOKE}} engine sensor-required-sections",
  severity: "advisory",
  firesOn: "gate",
  matches: "**/{aidlc-docs,intents,codekb}/**",
  timeoutSeconds: 300,
  input: { output_path: value("string"), stage_slug: value("string") },
  output: { pass: value("boolean"), h2_count: value("integer"), message: value("string") },
};

const upstreamCoverageSensor: SensorDeclaration = {
  id: sensor("upstream-coverage"),
  source: methodSource({ kind: "sensor", within: "aidlc-upstream-coverage.md" }),
  owner: core,
  description:
    "Checks the stage's deliverables reference the upstream artifacts the stage " +
    "frontmatter declares it requires",
  category: "document-shape",
  command: "{{INVOKE}} engine sensor-upstream-coverage",
  severity: "advisory",
  firesOn: "gate",
  matches: "**/{aidlc-docs,intents,codekb}/**",
  timeoutSeconds: 300,
  input: {
    output_path: value("string"),
    stage_slug: value("string"),
    consumes: value("string[]"),
  },
  output: { pass: value("boolean"), unreferenced_artifacts: value("string[]") },
};

const linterSensor: SensorDeclaration = {
  id: sensor("linter"),
  source: methodSource({ kind: "sensor", within: "aidlc-linter.md" }),
  owner: core,
  description:
    "Wraps the project's configured linter (eslint by default for v0.5.0); fires on TS/JS " +
    "code outputs",
  category: "code-quality",
  command: "{{INVOKE}} engine sensor-linter",
  severity: "advisory",
  firesOn: "write",
  matches: "**/*.{ts,js}",
  timeoutSeconds: 1200,
  input: { file_path: value("string") },
  output: {
    pass: value("boolean"),
    violations: {
      kind: "list-of",
      fields: {
        file: value("string"),
        line: value("number"),
        rule: value("string"),
        message: value("string"),
      },
    },
  },
};

const orgRules: Rule = {
  id: rule("org"),
  source: methodSource({ kind: "rule", within: "org.md" }),
  layer: { kind: "org" },
  owner: core,
  pairing: { kind: "unpaired" },
  status: null,
  staleAfter: null,
  text: "# Org-Level Rules",
};

const teamRules: Rule = {
  id: rule("team"),
  source: methodSource({ kind: "rule", within: "team.md" }),
  layer: { kind: "team" },
  owner: core,
  pairing: { kind: "unpaired" },
  status: null,
  staleAfter: null,
  text: "# Team-Level Rules",
};

const inceptionRules: Rule = {
  id: rule("phase-inception"),
  source: methodSource({ kind: "rule", within: "phases/inception.md" }),
  layer: { kind: "phase", phase: "inception" },
  owner: core,
  pairing: { kind: "unpaired" },
  status: null,
  staleAfter: null,
  text: "# Inception Phase Guardrails",
};

const developerKnowledge: KnowledgeDocument = {
  source: methodSource({
    kind: "knowledge",
    within: "aidlc-developer-agent/code-generation-guide.md",
  }),
  owner: core,
  audience: { kind: "agent", agent: developerAgent.slug },
};

const sharedKnowledge: KnowledgeDocument = {
  source: methodSource({ kind: "knowledge", within: "aidlc-shared/ai-dlc-principles.md" }),
  owner: core,
  audience: { kind: "shared" },
};

const membersOf = ({
  stage,
  names,
}: {
  readonly stage: Stage["slug"];
  readonly names: readonly Scope["name"][];
}): readonly ScopeMembership[] => names.map((name) => ({ scope: name, stage, declaredBy: core }));

const memberships: readonly ScopeMembership[] = [
  ...membersOf({ stage: requirementsAnalysis.slug, names: everyScope }),
  ...membersOf({
    stage: unitsGeneration.slug,
    names: scopes("enterprise", "feature", "mvp", "classic", "workshop"),
  }),
  ...membersOf({ stage: codeGeneration.slug, names: everyScope }),
];

const compiled: CompiledMethod = {
  stages: [requirementsAnalysis, unitsGeneration, codeGeneration],
  scopes: [classicScope, featureScope],
  memberships,
  freeformDefault: null,
  agents: [
    productAgent,
    architectAgent,
    deliveryAgent,
    developerAgent,
    productLeadAgent,
    architectureReviewerAgent,
  ],
  rules: [orgRules, teamRules, inceptionRules],
  sensors: [requiredSectionsSensor, upstreamCoverageSensor, linterSensor],
  knowledge: [developerKnowledge, sharedKnowledge],
  hooks: [],
  installedPlugins: [],
  selection: { kind: "every-installed" },
  findings: [],
  graph: {
    nodes: [
      {
        stage: requirementsAnalysis.slug,
        number: accept(stageNumber("2.3")),
        enabled: true,
        rulesInContext: [orgRules.id, teamRules.id, inceptionRules.id],
        activeSensors: [requiredSectionsSensor.id, upstreamCoverageSensor.id],
      },
      {
        stage: unitsGeneration.slug,
        number: accept(stageNumber("2.7")),
        enabled: true,
        rulesInContext: [orgRules.id, teamRules.id, inceptionRules.id],
        activeSensors: [requiredSectionsSensor.id, upstreamCoverageSensor.id],
      },
      {
        stage: codeGeneration.slug,
        number: accept(stageNumber("3.5")),
        enabled: true,
        rulesInContext: [orgRules.id, teamRules.id],
        activeSensors: [requiredSectionsSensor.id],
      },
    ],
  },
};

export const methodSliceFixture = brand<Method>(compiled);
