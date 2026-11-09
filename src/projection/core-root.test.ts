import { expect, test } from "bun:test";
import { createInMemoryFileSystem } from "../kernel/fixtures/file-system.fake.ts";
import { createScriptedProcessRunner } from "../kernel/fixtures/process-runner.fake.ts";
import { host, path, source } from "../kernel/fixtures/values.fixture.ts";
import { methodSliceFixture } from "../workflow-definition/fixtures/method.fixture.ts";
import { accepted, refused } from "../kernel/result.ts";
import { tokenBindingsFixture } from "./fixtures/token-bindings.fixture.ts";
import { createBuildProjection } from "./core-root.ts";

const identity = host({ name: "claude", directory: ".claude" });

test("Projection composes host capture and graph serialization through its own adapters", async () => {
  const fileSystem = createInMemoryFileSystem({ files: { "file:///host/SKILL.md": "raw" } });
  const projection = createBuildProjection({ hostFiles: fileSystem, sessionFiles: fileSystem, runnerScratch: fileSystem,
    runnerProcess: createScriptedProcessRunner({ outcome: refused({ kind: "not-started", reason: "Unused" }) }),
    runnerFrames: new URL("file:///frames/"), runnerChild: new URL("file:///child.ts") });
  expect(await projection.readHostSources({ host: identity, root: new URL("file:///host/"),
    sources: [source("SKILL.md")], required: [] })).toEqual(accepted([{
      source: source("SKILL.md"), content: { kind: "bytes", bytes: new Uint8Array([114, 97, 119]) },
    }]));
  expect(JSON.parse(projection.serializeMethod({ method: methodSliceFixture, host: identity,
    memoryRoot: path("aidlc/spaces/default/memory") }).graph)[0]).toMatchObject({
    slug: "requirements-analysis", number: "2.3",
  });
});

test("Projection composition serves the retained shell policy to a native data renderer", () => {
  const fileSystem = createInMemoryFileSystem({ files: {} });
  const projection = createBuildProjection({ hostFiles: fileSystem, sessionFiles: fileSystem, runnerScratch: fileSystem,
    runnerProcess: createScriptedProcessRunner({ outcome: refused({ kind: "not-started", reason: "Unused" }) }),
    runnerFrames: new URL("file:///frames/"), runnerChild: new URL("file:///child.ts") });
  expect(projection.projectHostSurface({ host: identity, files: [], placements: [], prepare: accepted,
    tokens: tokenBindingsFixture({ harnessDir: ".claude" }), channel: "copy",
    renderData: ({ delegateShell }) => ({ productName: "Policy fixture", configNextStep: "Open", rulesFolder: null,
      pluginAgentFrontmatter: { copy: delegateShell.riskyForms, native: [] } }),
  })).toEqual(accepted([
    { path: path(".claude/tools/data/harness.json"), content: { kind: "text", text: `{
  "schemaVersion": 1,
  "distribution": "claude",
  "productName": "Policy fixture",
  "configNextStep": "Open",
  "name": "claude",
  "harnessDir": ".claude",
  "rulesSubdir": "rules"
}
` }, mode: "regular", availability: "always",
      origin: { kind: "rendered", concept: "host-data", name: "claude" } },
    { path: path(".claude/tools/data/plugin-agent.md"),
      content: { kind: "text", text: "---\n$\n`\n>\n<\n&\n@(\n@{\n\\n\n---\n" },
      mode: "regular", availability: "always",
      origin: { kind: "rendered", concept: "host-data", name: "claude" } },
  ]));
});
