import { expect, mock, test } from "bun:test";
import { accepted, refused } from "../../kernel/result.ts";
import { hash, host, path, version } from "../../kernel/fixtures/values.fixture.ts";
import type { HostPayloadRequest, PayloadMetadata, PayloadMetadataFactory, ReleaseHistorySource } from "./ports.ts";
import type { Payload } from "../domain/payload.ts";
import { SCRATCH_HOST, SCRATCH_HOST_DATA } from "../../projection/fixtures/scratch-host.fixture.ts";
import { scratchHostDistributionFixture } from "../fixtures/host-distribution.fixture.ts";
import { createBuildPackagingUseCase, selectOnboardingPath } from "./build-packaging.ts";

const ZERO = hash("sha256:0000000000000000000000000000000000000000000000000000000000000000");
const request = (): HostPayloadRequest => ({ hasher: { hash: () => accepted(ZERO) }, distribution: scratchHostDistributionFixture,
  hostData: SCRATCH_HOST_DATA, channel: "native", copy: null,
  projection: { host: SCRATCH_HOST, findings: [], files: [{ path: path(".scratch/tools/aidlc-version.ts"),
    content: { kind: "text", text: "version module" }, mode: "regular", origin: { kind: "runtime-data", name: "version-module" } }] } });
const copy = () => ({ version: version("2.11.4"), channel: "copy" as const, files: [], descriptor: {
  host: SCRATCH_HOST, layout: scratchHostDistributionFixture.layout, history: { retiredFiles: [], priorIntegrations: [] } } });
type PackagingInputs = Parameters<typeof createBuildPackagingUseCase>[0];
const payload: Payload = { ...copy(), channel: "native" };
const service = (versionReading: PackagingInputs["version"] = accepted("2.11.4")) => {
  const files = mock<PayloadMetadata["files"]>().mockReturnValue(accepted([]));
  const metadata = { files };
  const forHost = mock<PayloadMetadataFactory["forHost"]>().mockReturnValue(metadata);
  const history = mock<ReleaseHistorySource["history"]>()
    .mockResolvedValue(accepted({ retiredFiles: [], priorIntegrations: [] }));
  const packagePayload = mock<ReturnType<PackagingInputs["payload"]>["package"]>()
    .mockResolvedValue(accepted(payload));
  const factory = mock<PackagingInputs["payload"]>().mockReturnValue({ package: packagePayload });
  const routes: PackagingInputs["routes"] = {
    prefix: "aidlc engine", namespace: "engine", delegates: [], adapterHooks: new Set(),
    trusted: (suffix) => `aidlc engine ${suffix}`, unresolvable: () => [] };
  const packaging = createBuildPackagingUseCase({ version: versionReading, stamp: accepted,
    routes, metadata: { forHost }, history: { history }, payload: factory });
  return { packaging, forHost, history, factory, packagePayload, metadata, routes };
};

test("a supplied copy from another host is refused before history or metadata reads", async () => {
  const { packaging, forHost, history, factory } = service();
  expect(await packaging.packageHost({ ...request(), copy: { ...copy(), descriptor: { ...copy().descriptor,
    host: host({ name: "other", directory: ".other" }) } } }))
    .toEqual(refused([{ kind: "copy-host-mismatch", host: SCRATCH_HOST,
      copyHost: host({ name: "other", directory: ".other" }) }]));
  expect(forHost).not.toHaveBeenCalled();
  expect(history).not.toHaveBeenCalled();
  expect(factory).not.toHaveBeenCalled();
});

test("a version source refusal stops before creating the payload use case", async () => {
  const current = service(refused({ kind: "version-unstampable", reason: "source refused" }));
  expect(await current.packaging.packageHost(request()))
    .toEqual(refused([{ kind: "version-unstampable", reason: "source refused" }]));
  expect(current.factory).not.toHaveBeenCalled();
  expect(current.forHost).not.toHaveBeenCalled();
});

test("an invalid version is refused before payload construction", async () => {
  const current = service(accepted("invalid"));
  expect(await current.packaging.packageHost(request()))
    .toEqual(refused([{ kind: "invalid-framework-version", raw: "invalid" }]));
  expect(current.factory).not.toHaveBeenCalled();
});

test("the coordinator delegates an exact request and preserves the downstream refusal identity", async () => {
  const current = service();
  const input = { ...request(), projection: { host: SCRATCH_HOST, files: [], findings: [] } };
  const failure = refused([{ kind: "version-module-count" as const, found: 7 }]);
  current.packagePayload.mockResolvedValue(failure);
  expect(await current.packaging.packageHost(input)).toBe(failure);
  expect(current.packagePayload).toHaveBeenCalledWith({ projection: input.projection,
    channel: "native", version: version("2.11.4"), runtime: [] });
  expect(current.factory).toHaveBeenCalledTimes(1);
  expect(current.factory).toHaveBeenCalledWith({ hasher: input.hasher, stamp: current.packaging.stamp,
    routes: current.routes, metadata: current.metadata, releases: { release: expect.any(Function) },
    layouts: { layout: expect.any(Function) }, history: { history: expect.any(Function) },
    bundler: { bundle: expect.any(Function) } });
});

test("the coordinator preserves the downstream successful payload identity without applying its rules", async () => {
  const current = service();
  const result = accepted(payload);
  current.packagePayload.mockResolvedValue(result);
  expect(await current.packaging.packageHost({ ...request(),
    projection: { host: SCRATCH_HOST, files: [], findings: [] } })).toBe(result);
});

test("payload construction receives the existing distribution binding and prior integration overlay", async () => {
  const current = service();
  const input = request();
  await current.packaging.packageHost(input);
  expect(current.factory.mock.calls[0]?.[0].releases.release(SCRATCH_HOST.distribution))
    .toEqual(accepted(input.distribution.native));
  expect(current.factory.mock.calls[0]?.[0].layouts.layout(SCRATCH_HOST.distribution))
    .toEqual(accepted(input.distribution.layout));
  expect(await current.factory.mock.calls[0]?.[0].history.history(SCRATCH_HOST.distribution))
    .toEqual(accepted({ retiredFiles: [], priorIntegrations: input.distribution.priorIntegrations }));
  expect(current.history).toHaveBeenCalledWith(SCRATCH_HOST.distribution);
  expect(await current.factory.mock.calls[0]?.[0].bundler.bundle({ entries: [],
    host: SCRATCH_HOST, channel: "native" })).toEqual(accepted([]));
});

test("the delegated history reader retains a refusal unchanged", async () => {
  const current = service();
  const failure = refused({ kind: "release-history-unreadable" as const,
    distribution: SCRATCH_HOST.distribution, reason: "fixture refusal" });
  current.history.mockResolvedValue(failure);
  await current.packaging.packageHost(request());
  expect(await current.factory.mock.calls[0]?.[0].history.history(SCRATCH_HOST.distribution)).toBe(failure);
});

test("host-local onboarding is bound to metadata before payload delegation", async () => {
  const current = service();
  const input = request();
  const projection = { ...input.projection, files: [
    { path: path("README.md"), content: { kind: "text" as const, text: "root" }, mode: "regular" as const,
      origin: { kind: "rendered" as const, concept: "onboarding" as const, name: "root" } },
    { path: path(".scratch/ONBOARDING.md"), content: { kind: "text" as const, text: "host" }, mode: "regular" as const,
      origin: { kind: "rendered" as const, concept: "onboarding" as const, name: "host" } },
  ] };
  await current.packaging.packageHost({ ...input, projection });
  expect(current.forHost).toHaveBeenCalledWith({ projection, hasher: input.hasher,
    distribution: input.distribution, hostData: input.hostData, copy: null,
    onboarding: path(".scratch/ONBOARDING.md") });
});

test("a copy from another version keeps the existing mixed-version refusal", async () => {
  const { packaging } = service();
  expect(await packaging.packageHost({ ...request(), copy: { ...copy(), version: version("2.11.3") } }))
    .toEqual(refused([{ kind: "mixed-versions", versions: [version("2.11.4"), version("2.11.3")] }]));
});

test("the copy input must itself be from the copy channel", async () => {
  const { packaging } = service();
  expect(await packaging.packageHost({ ...request(), copy: { ...copy(), channel: "native" } }))
    .toEqual(refused([{ kind: "copy-channel-mismatch", channel: "native" }]));
});

test("a copy-channel operation does not accept another copy payload", async () => {
  const { packaging } = service();
  expect(await packaging.packageHost({ ...request(), channel: "copy", copy: copy() }))
    .toEqual(refused([{ kind: "copy-payload-unexpected", host: SCRATCH_HOST }]));
});

test("explicit native null reaches metadata as absence rather than a hidden copy build", async () => {
  const { packaging, forHost } = service();
  expect(await packaging.packageHost(request())).toMatchObject({ ok: true, value: { channel: "native" } });
  expect(forHost).toHaveBeenCalledWith(expect.objectContaining({ copy: null }));
  expect(forHost).toHaveBeenCalledTimes(1);
});

test("onboarding selection prefers the host-local rendered document and retains the old fallback", () => {
  expect(selectOnboardingPath({ host: SCRATCH_HOST, files: [
    { path: path("README.md"), origin: { kind: "rendered", concept: "onboarding", name: "root" } },
    { path: path(".scratch/ONBOARDING.md"), origin: { kind: "rendered", concept: "onboarding", name: "native" } },
  ] })).toBe(path(".scratch/ONBOARDING.md"));
  expect(selectOnboardingPath({ host: SCRATCH_HOST, files: [
    { path: path("README.md"), origin: { kind: "rendered", concept: "onboarding", name: "root" } },
  ] })).toBe(path("README.md"));
  expect(selectOnboardingPath({ host: SCRATCH_HOST, files: [] })).toBeUndefined();
});
