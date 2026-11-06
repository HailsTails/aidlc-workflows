import { expect, mock, test } from "bun:test";
import { producePublishedSourceDistribution } from "./published-source-distribution.ts";
import { createPublishedSourceRequest, firstSnapshot, emptyPublication, publicationPayload } from "../__tests__/publication-fixtures.ts";
test("uses the active publication's ownership instead of a separately supplied initial record", async () => {
  const request = createPublishedSourceRequest();
  expect(await producePublishedSourceDistribution(request)).toEqual({ status: "ok", value: firstSnapshot });
  expect(request.assemble).toHaveBeenCalledWith({ location: request.location, products: [], retirements: [], sources: request.sources, ownershipJson: "{}" });
  expect(request.repository.publish).toHaveBeenCalledWith({ expectedHead: "ebaa4a347bd65cfc6f6b4d36c7827522771ea96803e49592dca2698cc6f517fa", artifactPair: { archive: publicationPayload.archive, ownershipJson: "next-record" } });
});
test("a new publication uses the explicit initial ownership record", async () => {
  const request = createPublishedSourceRequest();
  const repository = { ...request.repository, read: mock().mockResolvedValue({ status: "ok", value: emptyPublication }) };
  expect(await producePublishedSourceDistribution({ ...request, repository, expectedHead: null })).toEqual({ status: "ok", value: firstSnapshot });
  expect(request.assemble).toHaveBeenCalledWith({ location: request.location, products: [], retirements: [], sources: request.sources, ownershipJson: "initial-record" });
});
test("an unavailable store stops before assembly", async () => {
  const request = createPublishedSourceRequest();
  const repository = { ...request.repository, read: mock().mockResolvedValue({ status: "invalid", findings: [{ code: "capability-gap", subject: "store", detail: "locked" }] }) };
  expect(await producePublishedSourceDistribution({ ...request, repository })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "store", detail: "locked" }] });
  expect(request.assemble).not.toHaveBeenCalled();
  expect(request.repository.publish).not.toHaveBeenCalled();
});
test("a stale consumer stops before assembly", async () => {
  const request = createPublishedSourceRequest();
  expect(await producePublishedSourceDistribution({ ...request, expectedHead: null })).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "projection-publication", detail: "publication head changed; reload its artifact and ownership together before producing again" }] });
  expect(request.assemble).not.toHaveBeenCalled();
  expect(request.repository.publish).not.toHaveBeenCalled();
});
test("failed assembly cannot advance publication", async () => {
  const request = createPublishedSourceRequest();
  const assemble = mock().mockResolvedValue({ status: "invalid", findings: [{ code: "foreign-content", subject: "owned", detail: "changed" }] });
  expect(await producePublishedSourceDistribution({ ...request, assemble })).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "owned", detail: "changed" }] });
  expect(request.repository.publish).not.toHaveBeenCalled();
});
