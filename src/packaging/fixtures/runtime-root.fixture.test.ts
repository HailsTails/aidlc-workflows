import { hash, path } from "../../kernel/fixtures/values.fixture.ts";
import { expect, test } from "bun:test";
import { createInMemoryFileSystem } from "../../kernel/fixtures/file-system.fake.ts";
import { createRuntimeRootFixture, writeRuntimeBundleFixture } from "./runtime-root.fixture.ts";

const root = new URL("file:///fixture/");

test("the fixture writes an entry that imports a separate local dependency", async () => {
  const fileSystem = createInMemoryFileSystem({ files: {} });
  expect(await createRuntimeRootFixture({ root, fileSystem })).toEqual({ ok: true, value: root });
  expect(fileSystem.snapshot()).toEqual({
    "file:///fixture/src/cli/main.ts": { kind: "text", text: 'import { message } from "./fixture-message.ts"; console.log(message);' },
    "file:///fixture/src/cli/fixture-message.ts": { kind: "text", text: 'export const message = "fixture runtime";' },
  });
});

test("a fixture write failure is returned instead of advertising a complete source tree", async () => {
  const fileSystem = createInMemoryFileSystem({ files: {}, faults: {
    "file:///fixture/src/cli/main.ts": "permission-denied",
  } });
  expect(await createRuntimeRootFixture({ root, fileSystem }))
    .toEqual({ ok: false, refusal: { kind: "unwritable", code: "permission-denied" } });
  expect(fileSystem.snapshot()).toEqual({});
});

test("the bundle fixture writes the one supplied file through its filesystem port", async () => {
  const fileSystem = createInMemoryFileSystem({ files: {} });
  expect(await writeRuntimeBundleFixture({ root, fileSystem, files: [{
    path: path(".fixture/tools/lib/main.js"), mode: "regular", content: { kind: "text", text: "bundle" },
    hash: hash("sha256:1111111111111111111111111111111111111111111111111111111111111111"),
    origin: { kind: "version-stamp" },
  }] })).toEqual({ ok: true, value: new URL("file:///fixture/.fixture/tools/lib/main.js") });
  expect(fileSystem.snapshot()).toEqual({
    "file:///fixture/.fixture/tools/lib/main.js": { kind: "text", text: "bundle" },
  });
});

test("the executable fixture refuses a missing bundle instead of running a different file", async () => {
  const fileSystem = createInMemoryFileSystem({ files: {} });
  expect(await writeRuntimeBundleFixture({ root, fileSystem, files: [] })).toEqual({ ok: false,
    refusal: { kind: "entry-not-bundled", entry: "fixture", reason: "The runtime fixture needs exactly one bundled file." },
  });
  expect(fileSystem.snapshot()).toEqual({});
});
