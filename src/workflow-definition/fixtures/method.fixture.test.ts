import { describe, expect, test } from "bun:test";
import { methodSliceFixture } from "./method.fixture.ts";

const STAGES = [
  {
    slug: "requirements-analysis",
    source: "aidlc-common/stages/inception/requirements-analysis.md",
  },
  { slug: "units-generation", source: "aidlc-common/stages/inception/units-generation.md" },
  { slug: "code-generation", source: "aidlc-common/stages/construction/code-generation.md" },
];

const AGENTS = [
  { slug: "aidlc-product-agent", source: "aidlc-common/agents/aidlc-product-agent.md" },
  { slug: "aidlc-architect-agent", source: "aidlc-common/agents/aidlc-architect-agent.md" },
  { slug: "aidlc-delivery-agent", source: "aidlc-common/agents/aidlc-delivery-agent.md" },
  { slug: "aidlc-developer-agent", source: "aidlc-common/agents/aidlc-developer-agent.md" },
  { slug: "aidlc-product-lead-agent", source: "aidlc-common/agents/aidlc-product-lead-agent.md" },
  {
    slug: "aidlc-architecture-reviewer-agent",
    source: "aidlc-common/agents/aidlc-architecture-reviewer-agent.md",
  },
];

const GRAPH_NODES = [
  { stage: "requirements-analysis", number: "2.3", availability: "enabled" },
  { stage: "units-generation", number: "2.7", availability: "enabled" },
  { stage: "code-generation", number: "3.5", availability: "enabled" },
];

const MEMBERSHIPS = [
  { stage: "requirements-analysis", scope: "enterprise" },
  { stage: "requirements-analysis", scope: "feature" },
  { stage: "requirements-analysis", scope: "mvp" },
  { stage: "requirements-analysis", scope: "poc" },
  { stage: "requirements-analysis", scope: "bugfix" },
  { stage: "requirements-analysis", scope: "refactor" },
  { stage: "requirements-analysis", scope: "infra" },
  { stage: "requirements-analysis", scope: "security-patch" },
  { stage: "requirements-analysis", scope: "classic" },
  { stage: "requirements-analysis", scope: "workshop" },
  { stage: "requirements-analysis", scope: "express" },
  { stage: "units-generation", scope: "enterprise" },
  { stage: "units-generation", scope: "feature" },
  { stage: "units-generation", scope: "mvp" },
  { stage: "units-generation", scope: "classic" },
  { stage: "units-generation", scope: "workshop" },
  { stage: "code-generation", scope: "enterprise" },
  { stage: "code-generation", scope: "feature" },
  { stage: "code-generation", scope: "mvp" },
  { stage: "code-generation", scope: "poc" },
  { stage: "code-generation", scope: "bugfix" },
  { stage: "code-generation", scope: "refactor" },
  { stage: "code-generation", scope: "infra" },
  { stage: "code-generation", scope: "security-patch" },
  { stage: "code-generation", scope: "classic" },
  { stage: "code-generation", scope: "workshop" },
  { stage: "code-generation", scope: "express" },
];

const SUPPORTING_SOURCES = {
  scopes: [{ source: "scopes/aidlc-classic.md" }, { source: "scopes/aidlc-feature.md" }],
  rules: [
    { source: "memory/org.md" },
    { source: "memory/team.md" },
    { source: "memory/phases/inception.md" },
  ],
  sensors: [
    { source: "sensors/aidlc-required-sections.md" },
    { source: "sensors/aidlc-upstream-coverage.md" },
    { source: "sensors/aidlc-linter.md" },
  ],
  knowledge: [
    { source: "knowledge/aidlc-developer-agent/code-generation-guide.md" },
    { source: "knowledge/aidlc-shared/ai-dlc-principles.md" },
  ],
};

describe("methodSliceFixture stages and agents", () => {
  test("holds three stages whose sources sit under aidlc-common/stages", () => {
    expect(methodSliceFixture.stages).toMatchObject(STAGES);
  });

  test("holds the six core agents those stages name, sourced under aidlc-common/agents", () => {
    expect(methodSliceFixture.agents).toMatchObject(AGENTS);
  });

  test("numbers its graph nodes as the shipped stage graph does", () => {
    expect(methodSliceFixture.graph.nodes).toMatchObject(GRAPH_NODES);
  });

  test("declares units generation in five scopes and the other stages in all eleven", () => {
    expect(methodSliceFixture.memberships).toMatchObject(MEMBERSHIPS);
  });
});

describe("methodSliceFixture supporting content", () => {
  test("sources scopes, rules, sensors and knowledge under their own folders", () => {
    expect(methodSliceFixture).toMatchObject(SUPPORTING_SOURCES);
  });

  test("is a core-only method with no plugins, hooks or findings", () => {
    expect(methodSliceFixture).toMatchObject({
      hooks: [],
      installedPlugins: [],
      selection: { kind: "every-installed" },
      findings: [],
      freeformDefault: null,
    });
  });
});
