import { expect, mock, test } from "bun:test";
import { assemblePersistedSourceDistribution, createPersistedSourceServices } from "./persisted-source-distribution.ts";
import { createPersistedServices, ownedProduct, ownershipRecord } from "../__tests__/projection-ownership-fixtures.ts";
import { distributionLocation, distributionBasis } from "../__tests__/distribution-fixtures.ts";
import { successful } from "../__tests__/support.ts";
test("assembles an archive and new persisted record only after reconciliation succeeds", async () => {
  const services = createPersistedServices();
  const assembled = successful(await assemblePersistedSourceDistribution({ location: distributionLocation, ownershipJson: "previous", products: [ownedProduct], retirements: [], sources: [distributionBasis], services }));
  expect(assembled.ownershipJson).toBe("next-record");
  expect(assembled.archive).toEqual(new Uint8Array([31, 139]));
  expect(services.codec.write).toHaveBeenCalledWith({ ownership: ownershipRecord });
});
test("invalid persisted input stops before reading a distribution", async () => {
  const services = createPersistedServices();
  const codec = { ...services.codec, read: mock().mockReturnValue({ status: "invalid", findings: [{ code: "invalid-input", subject: "record", detail: "broken" }] }) };
  expect(await assemblePersistedSourceDistribution({ location: distributionLocation, ownershipJson: "previous", products: [ownedProduct], retirements: [], sources: [distributionBasis], services: { ...services, codec } })).toEqual({ status: "invalid", findings: [{ code: "invalid-input", subject: "record", detail: "broken" }] });
  expect(services.prepare).not.toHaveBeenCalled();
});
test("ownership conflict stops before reconciliation or archive production", async () => {
  const services = createPersistedServices();
  const plan = mock().mockReturnValue({ status: "invalid", findings: [{ code: "foreign-content", subject: "owned", detail: "changed" }] });
  expect(await assemblePersistedSourceDistribution({ location: distributionLocation, ownershipJson: "previous", products: [ownedProduct], retirements: [], sources: [distributionBasis], services: { ...services, plan } })).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "owned", detail: "changed" }] });
  expect(services.reconciler.reconcile).not.toHaveBeenCalled();
  expect(services.archive).not.toHaveBeenCalled();
});
test("failed archive production cannot advance the persisted record", async () => {
  const services = createPersistedServices();
  const archive = mock().mockResolvedValue({ status: "invalid", findings: [{ code: "capability-gap", subject: "archive", detail: "unavailable" }] });
  expect(await assemblePersistedSourceDistribution({ location: distributionLocation, ownershipJson: "previous", products: [ownedProduct], retirements: [], sources: [distributionBasis], services: { ...services, archive } })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "archive", detail: "unavailable" }] });
  expect(services.codec.write).not.toHaveBeenCalled();
});
test("production factory exposes the ownership and artifact ports", () => {
  expect(createPersistedSourceServices()).toMatchObject({ codec: { read: expect.any(Function), write: expect.any(Function) }, digest: expect.any(Function), plan: expect.any(Function), prepare: expect.any(Function), reconciler: { reconcile: expect.any(Function) }, archive: expect.any(Function) });
});
