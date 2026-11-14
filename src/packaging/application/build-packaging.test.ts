import { expect, mock, test } from "bun:test";
import { accepted, refused } from "../../kernel/result.ts";
import { hash, host, path, version } from "../../kernel/fixtures/values.fixture.ts";
import type { HostPayloadRequest } from "./ports.ts";
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
const service = () => {
  const forHost = mock(() => ({ files: () => accepted([]) }));
  const history = mock(async () => accepted({ retiredFiles: [], priorIntegrations: [] }));
  const packaging = createBuildPackagingUseCase({ version: accepted("2.11.4"), stamp: accepted,
    routes: { prefix: "aidlc engine", namespace: "engine", delegates: [], adapterHooks: new Set(),
      trusted: (suffix) => `aidlc engine ${suffix}`, unresolvable: () => [] },
    metadata: { forHost }, history: { history } });
  return { packaging, forHost, history };
};

test("a supplied copy from another host is refused before history or metadata reads", async () => {
  const { packaging, forHost, history } = service();
  expect(await packaging.packageHost({ ...request(), copy: { ...copy(), descriptor: { ...copy().descriptor,
    host: host({ name: "other", directory: ".other" }) } } }))
    .toEqual(refused([{ kind: "copy-host-mismatch", host: SCRATCH_HOST,
      copyHost: host({ name: "other", directory: ".other" }) }]));
  expect(forHost).not.toHaveBeenCalled();
  expect(history).not.toHaveBeenCalled();
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
