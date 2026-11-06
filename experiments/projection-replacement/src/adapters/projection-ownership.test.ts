import { expect, test } from "bun:test";
import { createProjectionOwnershipCodec, createOwnershipDigest } from "./projection-ownership.ts";
import { ownershipRecord, duplicateOwnershipJson, duplicateOwnershipPathsJson, unsafeOwnershipJson, mismatchedOwnershipJson } from "../../__tests__/projection-ownership-fixtures.ts";
test("reads complete persisted provenance and file ownership", () => {
  expect(createProjectionOwnershipCodec().read({ json: JSON.stringify(ownershipRecord) })).toEqual({ status: "ok", value: ownershipRecord });
});
test("serializes the record without changing its shape", () => {
  expect(createProjectionOwnershipCodec().write({ ownership: ownershipRecord })).toBe(`${JSON.stringify(ownershipRecord, null, 2)}\n`);
});
test("refuses invalid JSON as data", () => {
  expect(createProjectionOwnershipCodec().read({ json: "{" })).toEqual({ status: "invalid", findings: [{ code: "invalid-input", subject: "projection-ownership", detail: "ownership must be valid JSON" }] });
});
test("refuses unsafe persisted paths", () => {
  expect(createProjectionOwnershipCodec().read({ json: unsafeOwnershipJson })).toEqual({ status: "invalid", findings: [{ code: "invalid-input", subject: "projection-ownership", detail: "ownership requires version 1, exact harness binding, safe paths, source provenance and SHA-256 file records" }] });
});
test("refuses duplicate product identities even when their file paths differ", () => {
  expect(createProjectionOwnershipCodec().read({ json: duplicateOwnershipJson })).toEqual({ status: "invalid", findings: [{ code: "destination-collision", subject: "projection-ownership", detail: "ownership requires unique product identities and file paths within one harness binding" }] });
});
test("refuses duplicate file claims even when product identities differ", () => {
  expect(createProjectionOwnershipCodec().read({ json: duplicateOwnershipPathsJson })).toEqual({ status: "invalid", findings: [{ code: "destination-collision", subject: "projection-ownership", detail: "ownership requires unique product identities and file paths within one harness binding" }] });
});
test("refuses a mixed harness record", () => {
  expect(createProjectionOwnershipCodec().read({ json: mismatchedOwnershipJson })).toEqual({ status: "invalid", findings: [{ code: "destination-collision", subject: "projection-ownership", detail: "ownership requires unique product identities and file paths within one harness binding" }] });
});
test("the production digest matches the independent SHA-256 abc vector", () => {
  expect(createOwnershipDigest()({ bytes: new Uint8Array([97, 98, 99]) })).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});
