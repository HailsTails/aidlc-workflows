import { expect, mock, test } from "bun:test";
import { createDistributionCommand, parseDistributionArguments } from "./distribution-command.ts";
import { distributionLocation } from "../../__tests__/distribution-fixtures.ts";
import { assemblyFailure } from "../../__tests__/projection-set-fixtures.ts";
test("accepts source basis and complete seed location", () => {
  expect(parseDistributionArguments({ argv: ["source", "seed", "d062c81e5678c9f92162542b425b8a5f095e46e1"] })).toEqual({ status: "ok", value: { location: distributionLocation } });
});
test.each([[], ["source", "seed", "short"], ["source", "seed", "d062c81e5678c9f92162542b425b8a5f095e46e1", "extra"]])("refuses malformed invocation %#", (...argv) => {
  expect(parseDistributionArguments({ argv })).toEqual({ status: "invalid", findings: [{ code: "invalid-input", subject: "distribution-archive", detail: "usage: distribution-assembly <trusted-source-root> <complete-seed-root> <source-pin>; writes tar.gz bytes to stdout" }] });
});
test("publishes binary archive without a text banner", async () => {
  const publish = mock().mockResolvedValue(undefined), finish = mock();
  await createDistributionCommand({ operations: { publish, reporter: { finish } } }).finish({ outcome: { status: "ok", value: new Uint8Array([31, 139]) } });
  expect(publish).toHaveBeenCalledWith({ bytes: new Uint8Array([31, 139]) });
  expect(finish).toHaveBeenCalledWith({ outcome: { status: "ok", value: "" } });
});
test("refusal publishes no archive bytes", async () => {
  const publish = mock(), finish = mock();
  await createDistributionCommand({ operations: { publish, reporter: { finish } } }).finish({ outcome: assemblyFailure });
  expect(publish).not.toHaveBeenCalled();
  expect(finish).toHaveBeenCalledWith({ outcome: assemblyFailure });
});
test("broken stdout reports output unavailability", async () => {
  const finish = mock();
  await createDistributionCommand({ operations: { publish: mock().mockRejectedValue(new Error("closed")), reporter: { finish } } }).finish({ outcome: { status: "ok", value: new Uint8Array([31, 139]) } });
  expect(finish).toHaveBeenCalledWith({ outcome: { status: "invalid", findings: [{ code: "capability-gap", subject: "distribution-archive", detail: "archive output unavailable: closed" }] } });
});
