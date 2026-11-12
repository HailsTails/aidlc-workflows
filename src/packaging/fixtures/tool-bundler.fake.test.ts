import { expect, test } from "bun:test";
import { accepted, refused } from "../../kernel/result.ts";
import { host } from "../../kernel/fixtures/values.fixture.ts";
import { createRecordingToolBuild, createScriptedToolBundler } from "./tool-bundler.fake.ts";

const HOST = host({ name: "fixture", directory: ".fixture" });

test("the consumer fake records the explicit host and preserves a bundling refusal", async () => {
  const outcome = refused({ kind: "entry-not-bundled" as const, entry: "missing", reason: "fixture failure" });
  const bundler = createScriptedToolBundler(outcome);
  expect(await bundler.bundle({ entries: [], channel: "native", host: HOST })).toEqual(outcome);
  expect(bundler.received()).toEqual([{ entries: [], channel: "native", host: HOST }]);
});

test("fresh consumer fakes have independent request history", async () => {
  const first = createScriptedToolBundler(accepted([]));
  const second = createScriptedToolBundler(accepted([]));
  await first.bundle({ entries: [], channel: "copy", host: HOST });
  expect(second.received()).toEqual([]);
});

test("the adapter fake records build configuration and returns the scripted diagnostics", async () => {
  const buildLib = createRecordingToolBuild({ success: false, outputs: [], logs: [{ message: "build failure" }] });
  expect(await buildLib.build({ entrypoints: ["fixture.ts"], target: "bun" }))
    .toEqual({ success: false, outputs: [], logs: [{ message: "build failure" }] });
  expect(buildLib.received()).toEqual([{ entrypoints: ["fixture.ts"], target: "bun" }]);
});
