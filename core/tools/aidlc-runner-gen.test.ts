import { describe, expect, test } from "bun:test";
import type { GraphStage } from "./aidlc-graph.ts";
import { scopeMappingFrom } from "./aidlc-lib.ts";
import { renderScopeTable, renderStageTable } from "./aidlc-utility.ts";
import {
  defaultScopeBatch, planScopeRunners, renderComposeRunner, renderInitRunner, renderRunner, renderScopeRunner,
  renderStageRunner, runnableStages, runnerOwnership, runnerSurfaceRequest, scopeRunnerSlugFromBody,
  type RunnerRenderContext, type RunnerSurfaceInput,
} from "./aidlc-runner-gen.ts";

function stageValue(overrides: Partial<GraphStage> = {}): GraphStage {
  return {
    slug: "build-and-test", number: "3.1", name: "Build and Test",
    phase: "construction", execution: "ALWAYS", lead_agent: "aidlc-quality-agent",
    support_agents: [], mode: "inline", produces: ["build-summary"],
    consumes: [{ artifact: "plan", required: true }], requires_stage: [],
    inputs: "plan", outputs: "build-summary", rules_in_context: [],
    sensors_applicable: [], ...overrides,
  };
}

const SOURCE_RENDER: RunnerRenderContext = {
  harnessDir: ".codex", distribution: "codex", mode: "source",
  frontmatter: ["model: source-test"],
};
const NATIVE_RENDER: RunnerRenderContext = {
  harnessDir: ".aidlc", distribution: "copilot", mode: "native",
  frontmatter: ["agent: native-test"],
};

function surfaceInput(overrides: Partial<RunnerSurfaceInput> = {}): RunnerSurfaceInput {
  return {
    projectDir: "/fixture", skillsDir: "/fixture/skills", scopesDir: "/fixture/scopes", render: SOURCE_RENDER,
    allStages: [stageValue()],
    allScopes: {
      feature: { name: "feature", description: "Feature work", runner: true },
      "test-pro-validation": { name: "test-pro-validation", plugin: "test-pro", description: "Validate", runner: true },
      "custom-composed": { name: "custom-composed", description: "Composed work", runner: true },
      quiet: { name: "quiet", description: "No shortcut", runner: false },
    },
    allScopeOwners: { "test-pro-validation": { plugin: "test-pro" } },
    gridScopeNames: [], selectedPlugins: null, ...overrides,
  };
}

describe("explicit runner requests", () => {
  test("keeps disabled rows for legacy ownership but excludes them from generated stages", () => {
    const disabled = stageValue({ slug: "test-pro-integration", plugin: "test-pro", enabled: false });
    const request = runnerSurfaceRequest(surfaceInput({ allStages: [stageValue(), disabled] }));
    expect(request.allStages).toHaveLength(2);
    expect(request.allStages[1]).toEqual(disabled);
    expect(request.stages).toEqual([stageValue()]);
  });

  test("excludes initialization stages from standalone runners", () => {
    expect(runnableStages([stageValue({ slug: "workspace-scaffold", phase: "initialization" }), stageValue()]))
      .toEqual([stageValue()]);
  });

  test("explicit plugin selection preserves a composed scope present in the candidate grid", () => {
    const request = runnerSurfaceRequest(surfaceInput({ selectedPlugins: ["test-pro"], gridScopeNames: ["custom-composed"] }));
    expect(Object.keys(request.scopes)).toEqual(["test-pro-validation", "custom-composed"]);
    expect(defaultScopeBatch(request.scopes)).toEqual(["custom-composed", "test-pro-validation"]);
  });

  test("no plugin selection preserves discovered scopes but runner false never joins the batch", () => {
    const request = runnerSurfaceRequest(surfaceInput());
    expect(Object.keys(request.scopes)).toEqual(["feature", "test-pro-validation", "custom-composed", "quiet"]);
    expect(defaultScopeBatch(request.scopes)).toEqual(["custom-composed", "feature", "test-pro-validation"]);
  });

  test("an empty explicit selection produces an empty scope batch", () => {
    const request = runnerSurfaceRequest(surfaceInput({ selectedPlugins: [] }));
    expect(request.scopes).toEqual({});
    expect(defaultScopeBatch(request.scopes)).toEqual([]);
  });

});

describe("runner capture isolation", () => {
  test("captures detached nested values and freezes the complete request", () => {
    const stage = stageValue();
    const frontmatter = ["model: captured"];
    const scopes = { feature: { name: "feature", description: "Captured", runner: true } };
    const owners = { feature: { plugin: "aidlc" } };
    const selection = ["aidlc"];
    const grid = ["feature"];
    const request = runnerSurfaceRequest(surfaceInput({
      allStages: [stage], allScopes: scopes, allScopeOwners: owners,
      selectedPlugins: selection, gridScopeNames: grid,
      render: { ...SOURCE_RENDER, frontmatter },
    }));
    stage.consumes[0].artifact = "changed";
    scopes.feature.description = "Changed";
    owners.feature.plugin = "changed";
    frontmatter.push("model: changed");
    selection.push("changed");
    grid.push("changed");
    expect(request.stages[0].consumes).toEqual([{ artifact: "plan", required: true }]);
    expect(request.scopes.feature.description).toBe("Captured");
    expect(request.allScopeOwners).toEqual({ feature: { plugin: "aidlc" } });
    expect(request.render.frontmatter).toEqual(["model: captured"]);
    expect(request.selectedPlugins).toEqual(["aidlc"]);
    expect(request.gridScopeNames).toEqual(["feature"]);
    expect(Object.isFrozen(request)).toBe(true);
    expect(Object.isFrozen(request.stages[0].consumes[0])).toBe(true);
    expect(Object.isFrozen(request.allScopes.feature)).toBe(true);
    expect(Object.isFrozen(request.allScopeOwners.feature)).toBe(true);
    expect(Object.isFrozen(request.render.frontmatter)).toBe(true);
    expect(Object.isFrozen(request.selectedPlugins)).toBe(true);
  });
});

describe("explicit runner rendering", () => {
  test("stage rendering remains A/B/A deterministic across source and native contexts", () => {
    const source = renderStageRunner(stageValue(), SOURCE_RENDER);
    const native = renderStageRunner(stageValue(), NATIVE_RENDER);
    expect(renderStageRunner(stageValue(), SOURCE_RENDER)).toBe(source);
    expect(source).toContain("bun .codex/tools/aidlc-orchestrate.ts next --stage build-and-test --single");
    expect(source).toContain(".codex/aidlc-common/protocols/stage-protocol.md");
    expect(source).toContain("model: source-test\n");
    expect(source).not.toContain("agent: native-test");
    expect(native).toContain("aidlc engine orchestrate next --stage build-and-test --single");
    expect(native).toContain(".aidlc/aidlc-common/protocols/stage-protocol.md");
    expect(native).toContain("agent: native-test\n");
    expect(native).not.toContain("bun .codex");
  });

  test("plugin stage and scope runners retain the bare plugin-owned names", () => {
    const stage = renderStageRunner(stageValue({ slug: "test-pro-integration", plugin: "test-pro" }), SOURCE_RENDER);
    const scope = renderRunner("test-pro-validation", "Validate the plugin", SOURCE_RENDER, { plugin: "test-pro" });
    expect(stage).toContain("name: test-pro-integration\n");
    expect(stage).not.toContain("name: aidlc-test-pro-integration");
    expect(scope).toContain("name: test-pro-validation\n");
    expect(scope).not.toContain("name: aidlc-test-pro-validation");
  });

  test("scope rendering uses the captured entry syntax and description", () => {
    const source = renderRunner("feature", "Source work", SOURCE_RENDER, {});
    const native = renderRunner("feature", "Native work", NATIVE_RENDER, {});
    expect(renderRunner("feature", "Source work", SOURCE_RENDER, {})).toBe(source);
    expect(source).toContain("Source work. Packaging over `$aidlc --scope feature`");
    expect(source).toContain("bun .codex/tools/aidlc-orchestrate.ts next --scope feature");
    expect(source).not.toContain("Native work");
    expect(native).toContain("Native work. Packaging over `/aidlc --scope feature`");
    expect(native).toContain("aidlc engine orchestrate next --scope feature");
    expect(native).not.toContain("model: source-test");
  });

  test.each([
    { name: "init", render: renderInitRunner },
    { name: "compose", render: renderComposeRunner },
  ])("$name wrapper honors independent source and native render contexts", ({ render }) => {
    const source = render(SOURCE_RENDER);
    const native = render(NATIVE_RENDER);
    expect(render(SOURCE_RENDER)).toBe(source);
    expect(source).toContain("bun .codex/tools/aidlc-orchestrate.ts");
    expect(source).toContain("model: source-test\n");
    expect(source).not.toContain("agent: native-test");
    expect(native).toContain("aidlc engine orchestrate");
    expect(native).toContain("agent: native-test\n");
    expect(native).not.toContain("bun .codex");
  });

  test("a captured projected dispatcher is used without rediscovering a harness", () => {
    const rendered = renderStageRunner(stageValue(), { ...SOURCE_RENDER, projectedInvocation: "custom-aidlc" });
    expect(rendered).toContain("custom-aidlc engine orchestrate next --stage build-and-test --single");
    expect(rendered).not.toContain("bun .codex/tools/aidlc-orchestrate.ts");
  });
});

describe("explicit workflow table boundary values", () => {
  test("the stage table renders only the supplied captured rows in their supplied order", () => {
    const table = renderStageTable([
      stageValue({ slug: "deployment", number: "4.1", name: "Deployment", phase: "operation" }),
      stageValue(),
    ]);
    expect(table).toBe([
      "| Slug | # | Stage | Phase | Execution | Lead Agent | Support Agents | Mode |",
      "|------|---|-------|-------|-----------|------------|----------------|------|",
      "| deployment | 4.1 | Deployment | Operation | ALWAYS | aidlc-quality-agent | \u2014 | inline |",
      "| build-and-test | 3.1 | Build and Test | Construction | ALWAYS | aidlc-quality-agent | \u2014 | inline |",
    ].join("\n"));
  });

  test("scope tables use explicit metadata and grid cells rather than ambient scope names", () => {
    const mapping = scopeMappingFrom({
      validation: { name: "validation", depth: "Minimal", description: "Validate", keywords: ["test"], skeleton: false, runner: true, plugin: "test-pro", testStrategy: "unit" },
    }, { validation: { stages: { build: "EXECUTE", deploy: "SKIP" } }, unrelated: { stages: { build: "EXECUTE" } } });
    expect(mapping).toEqual({
      validation: { depth: "Minimal", description: "Validate", keywords: ["test"], skeleton: false, runner: true, plugin: "test-pro", testStrategy: "unit", stages: { build: "EXECUTE", deploy: "SKIP" } },
    });
    expect(renderScopeTable(mapping)).toBe([
      "| Scope          | Depth         | TestStrategy | EXECUTE / Total |",
      "|----------------|---------------|--------------|-----------------|",
      "| validation     | Minimal       | unit         | 1 / 2           |",
    ].join("\n"));
  });
});

describe("generated runner ownership", () => {
  test("provenance owns a runner independently of directory and stage membership", () => {
    expect(runnerOwnership({
      dirName: "orphan-shortcut",
      slug: "retired-stage",
      marker: "present",
      legacyBareSlugs: new Set(),
    })).toBe("generated");
  });

  test("a markerless core generated directory remains owned for an unknown stage", () => {
    expect(runnerOwnership({
      dirName: "aidlc-retired-stage",
      slug: "retired-stage",
      marker: "absent",
      legacyBareSlugs: new Set(),
    })).toBe("generated");
  });

  test("a markerless plugin generated directory uses the complete legacy ownership set", () => {
    expect(runnerOwnership({
      dirName: "test-pro-disabled-stage",
      slug: "test-pro-disabled-stage",
      marker: "absent",
      legacyBareSlugs: new Set(["test-pro-disabled-stage"]),
    })).toBe("generated");
  });

  test("entry documentation without generated ownership is unmanaged", () => {
    expect(runnerOwnership({
      dirName: "aidlc",
      slug: "documented-stage",
      marker: "absent",
      legacyBareSlugs: new Set(),
    })).toBe("unmanaged");
  });

  test("an unmanaged playbook remains unmanaged even for a plugin-owned slug", () => {
    expect(runnerOwnership({
      dirName: "team-playbook",
      slug: "test-pro-disabled-stage",
      marker: "absent",
      legacyBareSlugs: new Set(["test-pro-disabled-stage"]),
    })).toBe("unmanaged");
  });

  test("a core prefix does not own a mismatched body slug", () => {
    expect(runnerOwnership({
      dirName: "aidlc-other-stage",
      slug: "documented-stage",
      marker: "absent",
      legacyBareSlugs: new Set(),
    })).toBe("unmanaged");
  });

  test("a bare directory without legacy plugin ownership is unmanaged", () => {
    expect(runnerOwnership({
      dirName: "retired-stage",
      slug: "retired-stage",
      marker: "absent",
      legacyBareSlugs: new Set(),
    })).toBe("unmanaged");
  });
});


describe("scope runner generation plans", () => {
  test("plans selected runner artifacts in stable order with one captured rendering context", () => {
    const request = runnerSurfaceRequest(surfaceInput());
    const plan = planScopeRunners(request);
    expect(plan.names).toEqual(["custom-composed", "feature", "test-pro-validation"]);
    expect(plan.mode).toBe("write");
    expect(plan.pruning).toBe("reconcile");
    expect(plan.surface).toBe(request);
    expect(plan.artifacts.map((artifact) => artifact.path.replaceAll("\\", "/"))).toEqual([
      "/fixture/skills/aidlc-custom-composed/SKILL.md", "/fixture/skills/aidlc-feature/SKILL.md",
      "/fixture/skills/test-pro-validation/SKILL.md",
    ]);
    expect(plan.artifacts.map((artifact) => artifact.body)).toEqual(plan.names.map((name) =>
      renderRunner(name, request.scopes[name].description, request.render, request.scopes[name])
    ));
    expect(Object.isFrozen(plan)).toBe(true);
    expect(Object.isFrozen(plan.names)).toBe(true);
    expect(Object.isFrozen(plan.artifacts[0])).toBe(true);
  });

  test("all adds non-default scopes without re-enabling deselected plugins", () => {
    const request = runnerSurfaceRequest(surfaceInput({ selectedPlugins: ["aidlc"] }));
    const plan = planScopeRunners(request, { all: true });
    expect(plan.names).toEqual(["custom-composed", "feature", "quiet"]);
    expect(plan.artifacts).toHaveLength(3);
    expect(plan.artifacts.some((artifact) => artifact.body.includes("test-pro-validation"))).toBe(false);
  });

  test("checking and writing share exactly the same expected artifacts", () => {
    const request = runnerSurfaceRequest(surfaceInput());
    const write = planScopeRunners(request, { skillsDir: "/explicit/skills" });
    const check = planScopeRunners(request, { check: true, skillsDir: "/explicit/skills" });
    expect(check.mode).toBe("check");
    expect(check.names).toEqual(write.names);
    expect(check.artifacts).toEqual(write.artifacts);
    expect(check.skillsDir).toBe("/explicit/skills");
    expect(request.skillsDir).toBe("/fixture/skills");
  });
});

describe("scope runner pruning authority", () => {
  test("empty discovery without explicit selection never permits pruning", () => {
    const plan = planScopeRunners(runnerSurfaceRequest(surfaceInput({ allScopes: {} })));
    expect(plan.names).toEqual([]);
    expect(plan.artifacts).toEqual([]);
    expect(plan.pruning).toBe("preserve-undiscovered");
  });

  test("an explicit empty selection can reconcile only through the retained owners", () => {
    const request = runnerSurfaceRequest(surfaceInput({ selectedPlugins: [] }));
    const plan = planScopeRunners(request);
    expect(plan.names).toEqual([]);
    expect(plan.artifacts).toEqual([]);
    expect(plan.pruning).toBe("reconcile");
    expect(plan.surface.allScopeOwners).toEqual({ "test-pro-validation": { plugin: "test-pro" } });
  });
});

describe("named scope rendering compatibility", () => {
  test.each([
    { name: "feature", description: "", plugin: undefined },
    { name: "feature", description: "Keep the punctuation!", plugin: undefined },
    { name: "test-pro-validation", description: "Plugin validation", plugin: "test-pro" },
  ])("$name retains positional facade bytes in both command modes", (scope) => {
    for (const render of [SOURCE_RENDER, NATIVE_RENDER]) {
      expect(renderScopeRunner({ scope, render })).toBe(renderRunner(scope.name, scope.description, render, scope));
    }
  });
});


describe("scope runner command identity", () => {
  test.each(["feature.dot", "feature+api", "feature@home", "Build_2026", "2fast", "feature", "a.-_+@9"])("preserves %s in current and legacy command framing", (name) => {
    for (const render of [SOURCE_RENDER, NATIVE_RENDER]) {
      expect(scopeRunnerSlugFromBody(renderScopeRunner({ scope: { name, description: "Identity" }, render }))).toBe(name);
    }
    expect(scopeRunnerSlugFromBody(`\`bun .claude/tools/aidlc-orchestrate.ts next --scope ${name}\``)).toBe(name);
    expect(scopeRunnerSlugFromBody(`\`\`\`bash\nbun .claude/tools/aidlc-orchestrate.ts next --scope ${name}\n\`\`\``)).toBe(name);
  });

  test.each(["feature/other", "feature:other", "feature;echo", "feature&&echo", "feature$HOME", "'feature'", '"feature"', "feature --scope other", "feature $ARGUMENTS extra", "feature\\tail", "feature)", "feature`whoami`" ])("refuses malformed or non-generated command tail %s", (tail) => {
    expect(scopeRunnerSlugFromBody(`aidlc engine orchestrate next --scope ${tail}`)).toBeNull();
  });

  test("does not choose the first of conflicting scope commands", () => {
    expect(scopeRunnerSlugFromBody("aidlc engine orchestrate next --scope feature\naidlc engine orchestrate next --scope feature.dot")).toBeNull();
  });
});


describe("scope command executable identity", () => {
  test.each([
    "notaidlc engine orchestrate next --scope Build_2026",
    "bun .claude/tools/notaidlc-orchestrate.ts next --scope Build_2026",
    "custom-aidlc engine orchestrate next --scope Build_2026",
  ])("does not infer runner identity from another executable: %s", (command) => {
    expect(scopeRunnerSlugFromBody(command)).toBeNull();
  });
  test.each([
    "`aidlc engine orchestrate next --scope Build_2026`",
    "bun .claude/tools/aidlc-orchestrate.ts next --scope Build_2026",
    "bun .claude\\tools\\aidlc-orchestrate.ts next --scope Build_2026",
  ])("recognizes the actual native command or source basename: %s", (command) => {
    expect(scopeRunnerSlugFromBody(command)).toBe("Build_2026");
  });
});


describe("complete generated scope command framing", () => {
  test.each([
    "echo aidlc engine orchestrate next --scope Build_2026",
    "printf aidlc engine orchestrate next --scope Build_2026",
    "bun other.ts aidlc-orchestrate.ts next --scope Build_2026",
    "Discuss aidlc engine orchestrate next --scope Build_2026",
    '"aidlc engine orchestrate next --scope Build_2026"',
    "`aidlc engine orchestrate next --scope Build_2026",
    "aidlc engine orchestrate next --scope Build_2026`",
  ])("refuses command arguments or malformed Markdown: %s", (body) => {
    expect(scopeRunnerSlugFromBody(body)).toBeNull();
  });

  test("accepts repeated identical complete commands with CRLF, tabs and inline assignment", () => {
    expect(scopeRunnerSlugFromBody("  aidlc\tengine\torchestrate next --scope Build_2026\r\n1. `directive = aidlc engine orchestrate next --scope Build_2026 $ARGUMENTS`\r\n")).toBe("Build_2026");
  });

  test.each([
    "aidlc engine orchestrate next --scope",
    "aidlc engine orchestrate next --scope bad/name",
    "`aidlc engine orchestrate next --scope`",
    "aidlc engine orchestrate next --scopeBuild_2026",
    "`aidlc engine orchestrate next --scope Build_2026",
    "aidlc engine orchestrate next --scope build_2026",
  ])("does not discard a malformed or conflicting fixed command beside a valid one: %s", (body) => {
    expect(scopeRunnerSlugFromBody(`${body}\naidlc engine orchestrate next --scope Build_2026`)).toBeNull();
  });
});


test("unrelated command mentions do not conflict with an actual generated scope command", () => {
  expect(scopeRunnerSlugFromBody("echo aidlc engine orchestrate next --scope other\naidlc engine orchestrate next --scope Build_2026")).toBe("Build_2026");
});
