import { expect, test } from "bun:test";
import { accepted } from "../../kernel/result.ts";
import { host, path, source } from "../../kernel/fixtures/values.fixture.ts";
import { methodSource } from "../../workflow-definition/fixtures/method-source.fixture.ts";
import { tokenBindingsFixture } from "../fixtures/token-bindings.fixture.ts";
import { projectWorkspace } from "./project-workspace.ts";

const request = () => ({ host: host({ name: "claude", directory: ".claude" }), companions: [],
  tokens: tokenBindingsFixture({ harnessDir: ".claude" }), rules: [{ owner: { kind: "core" as const },
    path: methodSource({ kind: "rule", within: "phases/construction.md" }),
    content: { kind: "text" as const, text: "Use {{INVOKE}} in {{HARNESS_DIR}}.\n" } }],
});

test("each rule has exactly a bound space copy and seed copy, followed by the pointer", () => {
  expect(projectWorkspace(request())).toEqual(accepted([
    { path: path("aidlc/spaces/default/memory/phases/construction.md"), mode: "regular", availability: "always",
      content: { kind: "text", text: "Use bun .claude/tools/aidlc.ts in .claude.\n" },
      origin: { kind: "workspace-memory", copy: "space",
        path: methodSource({ kind: "rule", within: "phases/construction.md" }) } },
    { path: path(".claude/tools/data/memory-seed/phases/construction.md"), mode: "regular", availability: "always",
      content: { kind: "text", text: "Use bun .claude/tools/aidlc.ts in .claude.\n" },
      origin: { kind: "workspace-memory", copy: "seed",
        path: methodSource({ kind: "rule", within: "phases/construction.md" }) } },
    { path: path("aidlc/active-space"), content: { kind: "text", text: "default\n" },
      mode: "regular", availability: "always", origin: { kind: "active-space" } },
  ]));
});

test("an empty rule set still writes only the default pointer", () => {
  expect(projectWorkspace({ ...request(), rules: [] })).toEqual(accepted([
    { path: path("aidlc/active-space"), content: { kind: "text", text: "default\n" },
      mode: "regular", availability: "always", origin: { kind: "active-space" } },
  ]));
});

test("a companion has exactly two byte-identical copies with distinct provenance and no token pass", () => {
  expect(projectWorkspace({ ...request(), rules: [], companions: [{ source: source("memory/templates/.gitkeep"),
    content: { kind: "text", text: "{{INVOKE}}" } }] })).toEqual(accepted([
    { path: path("aidlc/spaces/default/memory/templates/.gitkeep"), mode: "regular", availability: "always",
      content: { kind: "text", text: "{{INVOKE}}" },
      origin: { kind: "memory-companion", copy: "space", source: source("memory/templates/.gitkeep") } },
    { path: path(".claude/tools/data/memory-seed/templates/.gitkeep"), mode: "regular", availability: "always",
      content: { kind: "text", text: "{{INVOKE}}" },
      origin: { kind: "memory-companion", copy: "seed", source: source("memory/templates/.gitkeep") } },
    { path: path("aidlc/active-space"), content: { kind: "text", text: "default\n" },
      mode: "regular", availability: "always", origin: { kind: "active-space" } },
  ]));
});
