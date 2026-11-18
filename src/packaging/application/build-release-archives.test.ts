import { expect, mock, test } from "bun:test";
import { accepted, refused, type Result } from "../../kernel/result.ts";
import type { HostIdentity } from "../../kernel/host.ts";
import { hash, host, version } from "../../kernel/fixtures/values.fixture.ts";
import type { ReleaseArtifact } from "../domain/artifact.ts";
import type { Payload } from "../domain/payload.ts";
import { claudeCopyPayloadFixture } from "../fixtures/claude-payload.fixture.ts";
import type { DistributionPayloads, DistributionBuildFailure } from "./ports.ts";
import { createBuildReleaseArchives } from "./build-release-archives.ts";

type PreparationFailure = { readonly kind: "preparation-refused"; readonly reason: string };
type ReleasePorts = Parameters<typeof createBuildReleaseArchives<PreparationFailure>>[0];
const alpha = host({ name: "alpha", directory: ".alpha" });
const zeta = host({ name: "zeta", directory: ".zeta" });
const alphaCopy: Payload = { ...claudeCopyPayloadFixture,
  descriptor: { ...claudeCopyPayloadFixture.descriptor, host: alpha } };
const alphaNative: Payload = { ...alphaCopy, channel: "native" };
const zetaCopy: Payload = { ...claudeCopyPayloadFixture,
  descriptor: { ...claudeCopyPayloadFixture.descriptor, host: zeta } };
const zetaNative: Payload = { ...zetaCopy, channel: "native" };
const runtime: ReleaseArtifact = { name: "runtime.tar.gz", format: "tar.gz", channel: "native",
  version: version("2.12.0"), distributions: [alpha.distribution, zeta.distribution],
  digest: hash("sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"), entries: [] };
const copyRuntime: ReleaseArtifact = { ...runtime, name: "copy.tar.gz", channel: "copy" };
const request = { pluginTrees: new URL("file:///plugins/"),
  names: { runtime: "runtime.tar.gz", copyRuntime: "copy.tar.gz" }, stampedAs: version("2.12.0") };

const fixture = (capturedVersion: ReleasePorts["version"] = accepted(version("2.12.0"))) => {
  const payloads = mock<DistributionPayloads>().mockResolvedValueOnce(accepted(alphaCopy))
    .mockResolvedValueOnce(accepted(alphaNative)).mockResolvedValueOnce(accepted(zetaCopy))
    .mockResolvedValueOnce(accepted(zetaNative));
  const payloadsFor = mock<(host: HostIdentity) => Promise<Result<DistributionPayloads, readonly DistributionBuildFailure[]>>>()
    .mockResolvedValue(accepted(payloads));
  const prepare = mock<ReleasePorts["prepare"]>().mockResolvedValue(accepted({ payloadsFor }));
  const build = mock<ReturnType<ReleasePorts["artifacts"]>["build"]>()
    .mockResolvedValueOnce(accepted(runtime)).mockResolvedValueOnce(accepted(copyRuntime));
  const readPlugins = mock<ReturnType<ReleasePorts["artifacts"]>["readPlugins"]>().mockResolvedValue(accepted([]));
  const artifacts = mock<ReleasePorts["artifacts"]>().mockReturnValue({ build, readPlugins });
  return { payloads, payloadsFor, prepare, build, readPlugins, artifacts,
    release: createBuildReleaseArchives({ version: capturedVersion, hosts: [zeta, alpha], root: new URL("file:///"),
      prepare, artifacts }) };
};

test("invalid packaging version and stamped mismatch refuse before preparation or artifact creation", async () => {
  const invalid = fixture(refused({ kind: "invalid-framework-version", raw: "invalid" }));
  expect(await invalid.release(request)).toEqual(refused([{ kind: "invalid-framework-version", raw: "invalid" }]));
  expect(invalid.prepare).not.toHaveBeenCalled();
  expect(invalid.artifacts).not.toHaveBeenCalled();
  const mismatch = fixture();
  expect(await mismatch.release({ ...request, stampedAs: version("0.0.0") })).toEqual(refused([
    { kind: "mixed-versions", versions: [version("2.12.0"), version("0.0.0")] },
  ]));
  expect(mismatch.prepare).not.toHaveBeenCalled();
  expect(mismatch.artifacts).not.toHaveBeenCalled();
});

test("release preparation retains its caller-owned typed refusal without touching hosts or artifacts", async () => {
  const current = fixture();
  const failure = refused([{ kind: "preparation-refused" as const, reason: "exact caller-owned refusal" }]);
  current.prepare.mockResolvedValue(failure);
  expect(await current.release(request)).toBe(failure);
  expect(current.payloadsFor).not.toHaveBeenCalled();
  expect(current.artifacts).not.toHaveBeenCalled();
});

test("release hosts sort before sequential capture-copy-native pairs with the exact copy payload identity", async () => {
  const current = fixture();
  expect(await current.release(request)).toEqual(accepted({ runtime, copyRuntime }));
  expect(current.prepare).toHaveBeenCalledWith();
  expect(current.payloadsFor).toHaveBeenNthCalledWith(1, alpha);
  expect(current.payloadsFor).toHaveBeenNthCalledWith(2, zeta);
  expect(current.payloads).toHaveBeenNthCalledWith(1, { host: alpha, channel: "copy", copy: null,
    projectRoot: new URL("file:///dist/alpha") });
  expect(current.payloads).toHaveBeenNthCalledWith(2, { host: alpha, channel: "native", copy: alphaCopy,
    projectRoot: new URL("file:///dist-release/alpha") });
  expect(current.payloads.mock.calls[1]?.[0].copy).toBe(alphaCopy);
  expect(current.payloads).toHaveBeenNthCalledWith(3, { host: zeta, channel: "copy", copy: null,
    projectRoot: new URL("file:///dist/zeta") });
  expect(current.payloads).toHaveBeenNthCalledWith(4, { host: zeta, channel: "native", copy: zetaCopy,
    projectRoot: new URL("file:///dist-release/zeta") });
  expect(current.payloadsFor.mock.invocationCallOrder[0]).toBeLessThan(current.payloads.mock.invocationCallOrder[0] ?? -1);
  expect(current.payloads.mock.invocationCallOrder[1]).toBeLessThan(current.payloadsFor.mock.invocationCallOrder[1] ?? -1);
  expect(current.payloadsFor.mock.invocationCallOrder[1]).toBeLessThan(current.payloads.mock.invocationCallOrder[2] ?? -1);
});

test("all pairs complete before the plugin tree is read once and native archive precedes copy archive", async () => {
  const current = fixture();
  expect(await current.release(request)).toEqual(accepted({ runtime, copyRuntime }));
  expect(current.artifacts).toHaveBeenCalledTimes(1);
  expect(current.artifacts).toHaveBeenCalledWith();
  expect(current.readPlugins).toHaveBeenCalledTimes(1);
  expect(current.readPlugins).toHaveBeenCalledWith(request.pluginTrees);
  expect(current.payloads.mock.invocationCallOrder[3]).toBeLessThan(current.artifacts.mock.invocationCallOrder[0] ?? -1);
  expect(current.readPlugins.mock.invocationCallOrder[0]).toBeLessThan(current.build.mock.invocationCallOrder[0] ?? -1);
  expect(current.build).toHaveBeenNthCalledWith(1, { name: "runtime.tar.gz", format: "tar.gz",
    payloads: [alphaNative, zetaNative], additions: [] });
  expect(current.build).toHaveBeenNthCalledWith(2, { name: "copy.tar.gz", format: "tar.gz",
    payloads: [alphaCopy, zetaCopy], additions: [] });
});

test("a first host capture refusal stops before all payload and archive work", async () => {
  const current = fixture();
  const failure = refused([{ kind: "unknown-harness" as const, harness: "alpha" }]);
  current.prepare.mockResolvedValue(accepted({ payloadsFor: mock().mockResolvedValue(failure) }));
  expect(await current.release(request)).toBe(failure);
  expect(current.payloads).not.toHaveBeenCalled();
  expect(current.artifacts).not.toHaveBeenCalled();
});

test("a copy refusal prevents native and later hosts without losing refusal identity", async () => {
  const current = fixture();
  const failure = refused([{ kind: "unknown-harness" as const, harness: "alpha" }]);
  current.payloads.mockReset().mockResolvedValue(failure);
  expect(await current.release(request)).toBe(failure);
  expect(current.payloads).toHaveBeenCalledTimes(1);
  expect(current.payloadsFor).toHaveBeenCalledTimes(1);
  expect(current.artifacts).not.toHaveBeenCalled();
});

test("a native refusal prevents later hosts and archives after the successful copy", async () => {
  const current = fixture();
  const failure = refused([{ kind: "unknown-harness" as const, harness: "alpha" }]);
  current.payloads.mockReset().mockResolvedValueOnce(accepted(alphaCopy)).mockResolvedValueOnce(failure);
  expect(await current.release(request)).toBe(failure);
  expect(current.payloads).toHaveBeenCalledTimes(2);
  expect(current.payloadsFor).toHaveBeenCalledTimes(1);
  expect(current.artifacts).not.toHaveBeenCalled();
});

test("a plugin tree refusal prevents both archives after all successful pairs", async () => {
  const current = fixture();
  const failure = refused([{ kind: "plugin-tree-unreadable" as const, within: "missing", code: "not-found" as const }]);
  current.readPlugins.mockResolvedValue(failure);
  expect(await current.release(request)).toBe(failure);
  expect(current.payloads).toHaveBeenCalledTimes(4);
  expect(current.build).not.toHaveBeenCalled();
});

test("native archive refusal prevents copy archive and copy archive refusal remains unchanged", async () => {
  const first = fixture();
  const failure = refused([{ kind: "archive-not-written" as const, name: "runtime.tar.gz", reason: "exact failure" }]);
  first.build.mockReset().mockResolvedValue(failure);
  expect(await first.release(request)).toBe(failure);
  expect(first.build).toHaveBeenCalledTimes(1);
  const second = fixture();
  second.build.mockReset().mockResolvedValueOnce(accepted(runtime)).mockResolvedValueOnce(failure);
  expect(await second.release(request)).toBe(failure);
  expect(second.build).toHaveBeenCalledTimes(2);
});

test("unexpected preparation exceptions retain identity instead of becoming a fabricated domain refusal", async () => {
  const current = fixture();
  const failure = new Error("exact preparation exception");
  current.prepare.mockRejectedValue(failure);
  await expect(current.release(request)).rejects.toBe(failure);
  expect(current.artifacts).not.toHaveBeenCalled();
});
