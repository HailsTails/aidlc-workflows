import { expect, test } from "bun:test";
import { createInMemoryFileSystem } from "../kernel/fixtures/file-system.fake.ts";
import { createScriptedProcessRunner } from "../kernel/fixtures/process-runner.fake.ts";
import { host, path, source } from "../kernel/fixtures/values.fixture.ts";
import { methodSliceFixture } from "../workflow-definition/fixtures/method.fixture.ts";
import { accepted, refused } from "../kernel/result.ts";
import { createBuildProjection } from "./core-root.ts";

const identity = host({ name: "claude", directory: ".claude" });

test("Projection composes host capture and graph serialization through its own adapters", async () => {
  const fileSystem = createInMemoryFileSystem({ files: { "file:///host/SKILL.md": "raw" } });
  const projection = createBuildProjection({ hostFiles: fileSystem, runnerScratch: fileSystem,
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
