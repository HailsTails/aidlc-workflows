import { afterAll, expect, test } from "bun:test";
import { createNodeFileSystem } from "../../kernel/file-system.ts";
import { createNodeProcessRunner } from "../../kernel/process-runner.ts";
import { createBunContentDigester } from "../../kernel/content-digester.ts";
import { accept } from "../../kernel/fixtures/accept.ts";
import { host, path, source } from "../../kernel/fixtures/values.fixture.ts";
import { createRuntimeRootFixture, writeRuntimeBundleFixture } from "../fixtures/runtime-root.fixture.ts";
import { BUN_BUILD_LIB, createBunToolBundler } from "./bun-tool-bundler.ts";

const fileSystem = createNodeFileSystem();
const processRunner = createNodeProcessRunner();
const digester = createBunContentDigester();
const HOST = host({ name: "fixture", directory: ".fixture" });
const ENTRY = { name: "aidlc", compositionRoot: source("src/cli/main.ts") };
const PARENT = new URL("../../../../.cache/tmp/", import.meta.url);
accept(await fileSystem.makeFolder({ folder: PARENT }));
const sourceRoot = accept(await createRuntimeRootFixture({ fileSystem,
  root: accept(await fileSystem.makeScratchFolder({ parent: PARENT })) }));
const outputRoot = accept(await fileSystem.makeScratchFolder({ parent: PARENT }));

afterAll(async () => {
  accept(await fileSystem.removeFolder({ folder: sourceRoot }));
  accept(await fileSystem.removeFolder({ folder: outputRoot }));
});

const fixtureBundle = () => createBunToolBundler({ sourceRoot, digester, buildLib: BUN_BUILD_LIB })
  .bundle({ entries: [ENTRY], host: HOST, channel: "copy" });

test("two fixture builds have the same bytes and hash in the requested host directory", async () => {
  const first = accept(await fixtureBundle());
  const second = accept(await fixtureBundle());
  expect(first).toHaveLength(1);
  expect(first).toEqual(second);
  expect(first).toMatchObject([{ path: path(".fixture/tools/lib/aidlc.js"), mode: "regular",
    origin: { kind: "bundled-runtime", entry: ENTRY } }]);
});

test("the in-memory bundle contains no absolute source location", async () => {
  const files = accept(await fixtureBundle());
  expect(files).toHaveLength(1);
  expect(files).toMatchObject([{ content: { kind: "text", text: expect.not.stringContaining(sourceRoot.pathname) } }]);
  expect(files).toMatchObject([{ content: { kind: "text", text: expect.not.stringMatching(/(?:file:\/\/|[A-Za-z]:[\\/])/) } }]);
});

test("the bundle runs from an otherwise empty tree without node_modules", async () => {
  const files = accept(await fixtureBundle());
  const executable = accept(await writeRuntimeBundleFixture({ root: outputRoot, files, fileSystem }));
  expect(await fileSystem.listFolder({ folder: outputRoot })).toEqual({ ok: true,
    value: [{ name: ".fixture", kind: "folder" }] });
  expect(await processRunner.runCurrentRuntime({ cwd: outputRoot, env: {}, input: "",
    argv: [{ kind: "path", location: executable }],
  })).toEqual({ ok: true, value: { exit: { kind: "exited", code: 0 }, stdout: "fixture runtime\n", stderr: "" } });
});
