import { describe, expect, test } from "bun:test";
import {
  CONTEXT_MAP,
  CONTEXTS,
  HARNESS_ADAPTER_FILES,
  HOST_BUNDLE_ROOT,
  LEGACY_BRIDGES,
  LEGACY_TERRITORY,
  MONOLITH_FILES,
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

describe("host and legacy boundaries", () => {
  test("host knowledge lives under src/hosts and the legacy harness tree", () => {
    expect({ adapters: HARNESS_ADAPTER_FILES, bundles: HOST_BUNDLE_ROOT }).toEqual({
      adapters: ["harness/**", "src/hosts/**"],
      bundles: "src/hosts",
    });
  });

  test("the Markdown interpreter is the one legacy bridge, read by the outliner adapter", () => {
    expect(LEGACY_BRIDGES.map((bridge) => [bridge.module, bridge.readBy])).toEqual([
      [
        "core/tools/aidlc-markdown.ts",
        "src/workflow-definition/adapters/markdown-outliner.ts",
      ],
    ]);
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
