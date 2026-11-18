import { expect, mock, test } from "bun:test";
import { accepted, refused } from "../../kernel/result.ts";
import { hash } from "../../kernel/fixtures/values.fixture.ts";
import { SCRATCH_HOST, SCRATCH_HOST_DATA } from "../../projection/fixtures/scratch-host.fixture.ts";
import { claudeCopyPayloadFixture } from "../fixtures/claude-payload.fixture.ts";
import { scratchHostDistributionFixture } from "../fixtures/host-distribution.fixture.ts";
import type { HostPayloadBuildRequest, BuildPackaging, ReadHostDistribution } from "./ports.ts";
import { createBuildHostPayload } from "./build-host-payload.ts";

const projected = { host: SCRATCH_HOST, files: [], findings: [] };
const hasher = { hash: () => accepted(hash("sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")) };
const completion = accepted(claudeCopyPayloadFixture);
const fixture = () => {
  const project = mock<HostPayloadBuildRequest["project"]>().mockResolvedValue(accepted(projected));
  const enrich = mock<HostPayloadBuildRequest["enrich"]>().mockResolvedValue(accepted(projected));
  const distribution = mock<ReadHostDistribution>().mockReturnValue(accepted(scratchHostDistributionFixture));
  const data = mock(() => SCRATCH_HOST_DATA);
  const packageHost = mock<BuildPackaging["packageHost"]>().mockResolvedValue(completion);
  const ports = { members: [{ host: SCRATCH_HOST, data }], distribution, packaging: { packageHost }, hasher };
  return { project, enrich, distribution, data, packageHost, ports,
    request: { host: SCRATCH_HOST, project, enrich, channel: "copy" as const, copy: null },
    build: createBuildHostPayload(ports) };
};

test("projection refusal keeps identity and prevents every later admission or payload call", async () => {
  const current = fixture();
  const failure = refused([{ kind: "unknown-harness" as const, harness: "scratch" }]);
  current.project.mockResolvedValue(failure);
  expect(await current.build(current.request)).toBe(failure);
  expect(current.distribution).not.toHaveBeenCalled();
  expect(current.data).not.toHaveBeenCalled();
  expect(current.enrich).not.toHaveBeenCalled();
  expect(current.packageHost).not.toHaveBeenCalled();
});

test("missing member still observes distribution first but retains the original member refusal precedence", async () => {
  const current = fixture();
  current.distribution.mockReturnValue(refused([{ kind: "invalid-path", base: "project", raw: "../outside" }]));
  const build = createBuildHostPayload({ ...current.ports, members: [] });
  expect(await build(current.request)).toEqual(refused([{ kind: "unknown-harness", harness: "scratch" }]));
  expect(current.distribution).toHaveBeenCalledWith({ host: SCRATCH_HOST });
  expect(current.data).not.toHaveBeenCalled();
  expect(current.enrich).not.toHaveBeenCalled();
  expect(current.packageHost).not.toHaveBeenCalled();
});

test("a distribution refusal precedes host data and authoring enrichment", async () => {
  const current = fixture();
  const failure = refused([{ kind: "invalid-path" as const, base: "project" as const, raw: "../outside" }]);
  current.distribution.mockReturnValue(failure);
  expect(await current.build(current.request)).toBe(failure);
  expect(current.data).not.toHaveBeenCalled();
  expect(current.enrich).not.toHaveBeenCalled();
  expect(current.packageHost).not.toHaveBeenCalled();
});

test("enrichment refusal precedes copy admission in the existing lower payload owner", async () => {
  const current = fixture();
  const failure = refused([{ kind: "plugin-hook-template-unreadable" as const, within: "", code: "not-found" as const }]);
  current.enrich.mockResolvedValue(failure);
  expect(await current.build({ ...current.request, copy: claudeCopyPayloadFixture })).toBe(failure);
  expect(current.data).toHaveBeenCalledTimes(1);
  expect(current.packageHost).not.toHaveBeenCalled();
});

test.each(["copy", "native"] as const)("the parity-preserving candidate enriches %s before delegating once", async (channel) => {
  const current = fixture();
  expect(await current.build({ ...current.request, channel })).toBe(completion);
  expect(current.project).toHaveBeenCalledTimes(1);
  expect(current.enrich).toHaveBeenCalledWith(projected);
  expect(current.packageHost).toHaveBeenCalledTimes(1);
  expect(current.packageHost).toHaveBeenCalledWith({ projection: projected, distribution: scratchHostDistributionFixture,
    hostData: SCRATCH_HOST_DATA, hasher, channel, copy: null });
  expect(current.distribution.mock.invocationCallOrder[0]).toBeLessThan(current.data.mock.invocationCallOrder[0] ?? -1);
  expect(current.data.mock.invocationCallOrder[0]).toBeLessThan(current.enrich.mock.invocationCallOrder[0] ?? -1);
  expect(current.enrich.mock.invocationCallOrder[0]).toBeLessThan(current.packageHost.mock.invocationCallOrder[0] ?? -1);
});

test("the lower payload refusal remains unchanged after the completed projection", async () => {
  const current = fixture();
  const failure = refused([{ kind: "copy-payload-unexpected" as const, host: SCRATCH_HOST }]);
  current.packageHost.mockResolvedValue(failure);
  expect(await current.build(current.request)).toBe(failure);
});

test("unexpected projection exception identity is preserved and prevents distribution work", async () => {
  const current = fixture();
  const failure = new Error("exact projection exception");
  current.project.mockRejectedValue(failure);
  await expect(current.build(current.request)).rejects.toBe(failure);
  expect(current.distribution).not.toHaveBeenCalled();
});
