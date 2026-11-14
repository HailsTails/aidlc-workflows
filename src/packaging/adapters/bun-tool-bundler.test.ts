import { expect, mock, test } from "bun:test";
import { accepted, refused } from "../../kernel/result.ts";
import { hash, host, path, source } from "../../kernel/fixtures/values.fixture.ts";
import { createRecordingToolBuild } from "../fixtures/tool-bundler.fake.ts";
import { createBunToolBundler } from "./bun-tool-bundler.ts";

const HASH = hash("sha256:1111111111111111111111111111111111111111111111111111111111111111");
const HOST = host({ name: "fixture", directory: ".fixture" });
const ENTRY = { name: "aidlc", compositionRoot: source("src/main.ts") };
const SOURCE_ROOT = new URL("./fixture/", import.meta.url);
const output = () => ({ text: async () => "fixture bundle" });

test("the registered adapter builds one entry at the bound source root and hashes its returned bytes", async () => {
  const buildLib = createRecordingToolBuild({ success: true, logs: [], outputs: [output()] });
  const digest = mock(() => accepted(HASH));
  const bundler = createBunToolBundler({ sourceRoot: SOURCE_ROOT, digester: { hash: digest }, buildLib });
  expect(await bundler.bundle({ entries: [ENTRY], host: HOST, channel: "native" })).toEqual(accepted([{
    path: path(".fixture/tools/lib/aidlc.js"), content: { kind: "text", text: "fixture bundle" },
    mode: "regular", hash: HASH, origin: { kind: "bundled-runtime", entry: ENTRY },
  }]));
  expect(buildLib.received()).toEqual([{
    entrypoints: [expect.stringMatching(/[\\/]fixture[\\/]src[\\/]main[.]ts$/)],
    root: expect.stringMatching(/[\\/]fixture[\\/]$/), target: "bun", format: "esm",
    minify: false, sourcemap: "none", splitting: false,
  }]);
  expect(digest).toHaveBeenCalledWith({ kind: "text", text: "fixture bundle" });
});

test("build diagnostics refuse the actual entry without partial files", async () => {
  const buildLib = createRecordingToolBuild({ success: false, outputs: [], logs: [{ message: "fixture build failed" }] });
  const bundler = createBunToolBundler({ sourceRoot: SOURCE_ROOT, digester: { hash: () => accepted(HASH) }, buildLib });
  expect(await bundler.bundle({ entries: [ENTRY], host: HOST, channel: "copy" })).toEqual(refused({
    kind: "entry-not-bundled", entry: "aidlc", reason: "fixture build failed",
  }));
});

test("a digest refusal is represented at the bundler boundary", async () => {
  const buildLib = createRecordingToolBuild({ success: true, logs: [], outputs: [output()] });
  const bundler = createBunToolBundler({ sourceRoot: SOURCE_ROOT, buildLib,
    digester: { hash: () => refused({ kind: "invalid-content-hash", raw: "bad fixture digest" }) } });
  expect(await bundler.bundle({ entries: [ENTRY], host: HOST, channel: "copy" })).toEqual(refused({
    kind: "entry-not-bundled", entry: "aidlc", reason: "The bundle content digest was refused: invalid-content-hash.",
  }));
});
