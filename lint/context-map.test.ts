import { describe, expect, test } from "bun:test";
import {
  CONTEXT_MAP,
  CONTEXTS,
  HARNESS_ADAPTER_FILES,
  HOST_BUNDLE_ROOT,
  LEGACY_BRIDGES,
  LEGACY_TERRITORY,
  MONOLITH_FILES,
  SHIPPED_TYPE_BRIDGES,
} from "./context-map.ts";

describe("context arrows", () => {
  test("the contexts are the kernel, the five bounded contexts and the CLI", () => {
    expect(CONTEXTS).toEqual([
      "kernel",
      "workflow-definition",
      "projection",
      "packaging",
      "installation",
      "execution",
      "cli",
    ]);
  });

  test("each context depends only on the contexts upstream of it", () => {
    expect({
      kernel: CONTEXT_MAP.kernel.dependsOn,
      workflowDefinition: CONTEXT_MAP["workflow-definition"].dependsOn,
      projection: CONTEXT_MAP.projection.dependsOn,
      packaging: CONTEXT_MAP.packaging.dependsOn,
      installation: CONTEXT_MAP.installation.dependsOn,
      execution: CONTEXT_MAP.execution.dependsOn,
    }).toEqual({
      kernel: [],
      workflowDefinition: ["kernel"],
      projection: ["kernel", "workflow-definition"],
      packaging: ["kernel", "projection"],
      installation: ["kernel", "packaging"],
      execution: ["kernel", "workflow-definition"],
    });
  });

  test("only installation reads another context's file format, and only packaging's", () => {
    expect({
      packaging: CONTEXT_MAP.packaging.readsFileFormatsOf,
      installation: CONTEXT_MAP.installation.readsFileFormatsOf,
      execution: CONTEXT_MAP.execution.readsFileFormatsOf,
    }).toEqual({ packaging: [], installation: ["packaging"], execution: [] });
  });

  test("only the CLI composes roots, and it composes every bounded context", () => {
    expect({
      cli: CONTEXT_MAP.cli.composesRootsOf,
      installation: CONTEXT_MAP.installation.composesRootsOf,
    }).toEqual({
      cli: ["workflow-definition", "projection", "packaging", "installation", "execution"],
      installation: [],
    });
  });
});

const OWNER_MOVES = "Phase 2: its owner moves into src and ships in the runtime bundle (R1).";

const EXPECTED_BRIDGES = [
  {
    module: "core/tools/aidlc-model-policy.ts",
    readBy: "src/projection/adapters/legacy-agent-surfaces.ts",
    retiresWhen:
      "Phase 2 model-policy cutover: its owner moves into src and ships in the runtime bundle " +
      "(R1), deleting agentTiersFromAuthoredDirectory, the unreachable authored-agents walk " +
      "the phase 1 freeze keeps in shipped bytes.",
  },
  {
    module: "core/tools/aidlc-model-policy.ts",
    readBy: "src/hosts/codex/projection/toml-models.ts",
    retiresWhen: "Phase 2 model-policy cutover: Codex's agent TOML model rewrite moves into src with the policy owner.",
  },
  { module: "core/tools/aidlc-tiers.ts", readBy: "src/projection/adapters/legacy-tiers.ts", retiresWhen: OWNER_MOVES },
  {
    module: "core/tools/aidlc-runner-gen.ts",
    readBy: "src/cli/legacy-runner-child.ts",
    retiresWhen: OWNER_MOVES,
  },
  {
    module: "core/tools/aidlc-utility.ts",
    readBy: "src/projection/adapters/legacy-skill-tables.ts",
    retiresWhen: OWNER_MOVES,
  },
  {
    module: "core/tools/aidlc-settings.ts",
    readBy: "src/projection/adapters/legacy-settings-schema.ts",
    retiresWhen: OWNER_MOVES,
  },
  {
    module: "core/tools/aidlc-command.ts",
    readBy: "src/projection/adapters/legacy-trusted-commands.ts",
    retiresWhen: OWNER_MOVES,
  },
  {
    module: "core/tools/aidlc-runtime-budget.ts",
    readBy: "src/projection/adapters/legacy-runtime-budget.ts",
    retiresWhen: OWNER_MOVES,
  },
  {
    module: "core/tools/aidlc-launcher-voucher.ts",
    readBy: "src/hosts/copilot/projection/launcher.ts",
    retiresWhen: OWNER_MOVES,
  },
  {
    module: "core/tools/aidlc-includes.ts",
    readBy: "src/projection/adapters/legacy-includes.ts",
    retiresWhen: OWNER_MOVES,
  },
  {
    module: "core/tools/aidlc-inline-context.ts",
    readBy: "src/projection/adapters/legacy-format-docs.ts",
    retiresWhen: OWNER_MOVES,
  },
  {
    module: "core/tools/aidlc-plugin-emit.ts",
    readBy: "src/projection/adapters/legacy-plugin-emit.ts",
    retiresWhen:
      "Phase 2 plugin-tools cutover: its owner moves into src and ships in the runtime bundle " +
      "(R1), deleting the pluginReviewerAgents stage-file regex fallback that the shipped " +
      "plugin build and plugin test still reach.",
  },
  { module: "core/tools/aidlc.ts", readBy: "src/projection/adapters/legacy-dispatcher.ts", retiresWhen: OWNER_MOVES },
  {
    module: "core/hooks/aidlc-state-transition-guard.ts",
    readBy: "src/projection/adapters/legacy-delegate-admission.ts",
    retiresWhen: OWNER_MOVES,
  },
  {
    module: "core/tools/aidlc-lib.ts",
    readBy: "src/projection/adapters/legacy-workspace-commands.ts",
    retiresWhen: OWNER_MOVES,
  },
  {
    module: "core/tools/aidlc-distribution.ts",
    readBy: "src/packaging/adapters/legacy-distribution.ts",
    retiresWhen: OWNER_MOVES,
  },
  {
    module: "core/tools/aidlc-version.ts",
    readBy: "src/packaging/adapters/legacy-version.ts",
    retiresWhen: OWNER_MOVES,
  },
  {
    module: "core/tools/aidlc-channel.ts",
    readBy: "src/packaging/adapters/legacy-channel.ts",
    retiresWhen: OWNER_MOVES,
  },
  {
    module: "core/tools/aidlc-archive.ts",
    readBy: "src/packaging/adapters/legacy-archive.ts",
    retiresWhen: OWNER_MOVES,
  },
];

describe("host and legacy boundaries", () => {
  test("host knowledge lives under src/hosts and the legacy harness tree", () => {
    expect({ adapters: HARNESS_ADAPTER_FILES, bundles: HOST_BUNDLE_ROOT }).toEqual({
      adapters: ["harness/**", "src/hosts/**"],
      bundles: "src/hosts",
    });
  });


  test("the monoliths are the lib, orchestrate and init tools", () => {
    expect(MONOLITH_FILES).toEqual([
      "core/tools/aidlc-lib.ts",
      "core/tools/aidlc-orchestrate.ts",
      "core/tools/aidlc-init.ts",
    ]);
  });

  test("the stage graph tool is Workflow Definition's legacy territory", () => {
    expect(LEGACY_TERRITORY["workflow-definition"]).toContain("core/tools/aidlc-graph.ts");
  });
});

describe("legacy bridges", () => {
  test("each shipped tool the build reads has one named src reader until its owner moves", () => {
    expect(LEGACY_BRIDGES).toEqual(EXPECTED_BRIDGES);
  });

  test("host data reads the shipped owners' types through declarations until those owners move", () => {
    expect(SHIPPED_TYPE_BRIDGES).toEqual([
      { module: "core/tools/aidlc-lib.ts", readBy: "src/projection/domain/host-surface.ts", retiresWhen: OWNER_MOVES },
      { module: "core/tools/aidlc-runtime-paths.ts", readBy: "src/projection/domain/host-surface.ts", retiresWhen: OWNER_MOVES },
    ]);
  });
});
