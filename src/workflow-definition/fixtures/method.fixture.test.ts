import { describe, expect, test } from "bun:test";
import { methodSliceFixture } from "./method.fixture.ts";

describe("methodSliceFixture", () => {
  test("holds three stages whose sources sit under aidlc-common/stages", () => {
    expect(methodSliceFixture.stages.map((stage) => stage.source)).toEqual<string[]>([
      "aidlc-common/stages/inception/requirements-analysis.md",
      "aidlc-common/stages/inception/units-generation.md",
      "aidlc-common/stages/construction/code-generation.md",
    ]);
  });

  test("holds the six core agents those stages name, sourced under aidlc-common/agents", () => {
    expect(methodSliceFixture.agents.map((agent) => agent.source)).toEqual<string[]>([
      "aidlc-common/agents/aidlc-product-agent.md",
      "aidlc-common/agents/aidlc-architect-agent.md",
      "aidlc-common/agents/aidlc-delivery-agent.md",
      "aidlc-common/agents/aidlc-developer-agent.md",
      "aidlc-common/agents/aidlc-product-lead-agent.md",
      "aidlc-common/agents/aidlc-architecture-reviewer-agent.md",
    ]);
  });

  test("numbers its graph nodes as the shipped stage graph does", () => {
    expect(methodSliceFixture.graph.nodes).toMatchObject([
      { stage: "requirements-analysis", number: "2.3", availability: "enabled" },
      { stage: "units-generation", number: "2.7", availability: "enabled" },
      { stage: "code-generation", number: "3.5", availability: "enabled" },
    ]);
  });

  test("declares the classic and feature scopes from their scope files", () => {
    expect(methodSliceFixture.scopes.map((scope) => scope.source)).toEqual<string[]>([
      "scopes/aidlc-classic.md",
      "scopes/aidlc-feature.md",
    ]);
  });

  test("sources its rules under memory", () => {
    expect(methodSliceFixture.rules.map((rule) => rule.source)).toEqual<string[]>([
      "memory/org.md",
      "memory/team.md",
      "memory/phases/inception.md",
    ]);
  });

  test("sources its sensors under sensors", () => {
    expect(methodSliceFixture.sensors.map((sensor) => sensor.source)).toEqual<string[]>([
      "sensors/aidlc-required-sections.md",
      "sensors/aidlc-upstream-coverage.md",
      "sensors/aidlc-linter.md",
    ]);
  });

  test("sources its knowledge under knowledge", () => {
    expect(methodSliceFixture.knowledge.map((document) => document.source)).toEqual<string[]>([
      "knowledge/aidlc-developer-agent/code-generation-guide.md",
      "knowledge/aidlc-shared/ai-dlc-principles.md",
    ]);
  });

  test("declares units generation in five scopes and the other stages in all eleven", () => {
    expect(methodSliceFixture.memberships).toMatchObject([
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
    ]);
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
