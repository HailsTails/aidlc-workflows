import { expect, test } from "bun:test";
import { hash, host, path, version } from "../../kernel/fixtures/values.fixture.ts";
import type { ContentHash } from "../../kernel/values.ts";
import type { Payload, PayloadFile } from "./payload.ts";
import { managedPayloadDirectories, nativeCopyHistory } from "./native-copy-history.ts";

const ZERO = hash("sha256:0000000000000000000000000000000000000000000000000000000000000000");
const ONE = hash("sha256:1111111111111111111111111111111111111111111111111111111111111111");
const TWO = hash("sha256:2222222222222222222222222222222222222222222222222222222222222222");
const file = (relative: string, hash: ContentHash): PayloadFile => ({ path: path(relative), hash,
  mode: "regular", content: { kind: "text", text: "fixture" }, origin: { kind: "version-stamp" } });
const releasePayload = (files: readonly PayloadFile[]): Payload => ({ version: version("1.0.0"), channel: "native", files,
  descriptor: { host: host({ name: "fixture", directory: ".fixture" }),
    layout: { rootIntegrations: [], managedDirectories: [] }, history: { retiredFiles: [], priorIntegrations: [] } } });

test("changed native bytes and the copy descriptor retain the copy-channel signatures", () => {
  expect(nativeCopyHistory({ native: releasePayload([file(".fixture/note.md", ONE),
    file(".fixture/tools/data/aidlc-projection.json", ONE)]),
  copy: { ...releasePayload([file(".fixture/note.md", ZERO), file(".fixture/tools/data/aidlc-projection.json", TWO)]), channel: "copy" } }))
    .toEqual({ legacyManagedFileHashes: { ".fixture/note.md": [ZERO],
      ".fixture/tools/data/aidlc-projection.json": [TWO] }, retiredCopyFileHashes: {} });
});

test("copy-era history keeps present and absent files while excluding workspace and unmanaged paths", () => {
  const native = releasePayload([file(".fixture/current.md", ONE), file("aidlc/active-space", ONE)]);
  expect(nativeCopyHistory({ native: { ...native, descriptor: { ...native.descriptor, history: {
    priorIntegrations: [], retiredFiles: [
      { path: path(".fixture/current.md"), shippedHashes: [ONE, TWO] },
      { path: path(".fixture/removed.md"), shippedHashes: [TWO, ZERO] },
      { path: path("aidlc/removed.md"), shippedHashes: [ZERO] },
      { path: path(".unmanaged/removed.md"), shippedHashes: [ZERO] },
    ],
  } } }, copy: { ...releasePayload([file(".fixture/current.md", ZERO)]), channel: "copy" } }))
    .toEqual({ legacyManagedFileHashes: { ".fixture/current.md": [ZERO, TWO] },
      retiredCopyFileHashes: { ".fixture/removed.md": [ZERO, TWO] } });
});

test("root-only folders remain the project's and do not become managed native directories", () => {
  const native = releasePayload([file(".fixture/a.md", ONE), file(".vscode/settings.json", ONE)]);
  expect(managedPayloadDirectories({ ...native, descriptor: { ...native.descriptor,
    layout: { managedDirectories: [], rootIntegrations: [{ path: path(".vscode/settings.json"),
      policy: "jsonc-settings", presence: "required" }] },
  } })).toEqual([".fixture"]);
});
