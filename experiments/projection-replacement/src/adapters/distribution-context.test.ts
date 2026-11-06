import { expect, mock, test } from "bun:test";
import { createNativeDistributionContextReader } from "./distribution-context.ts";
import { distributionLocation, distributionSeed, nativeDistributionContext } from "../../__tests__/distribution-fixtures.ts";
test("admitted native context is plain data with no source-prepared files", async () => {
  const read = mock().mockResolvedValue(nativeDistributionContext);
  expect(await createNativeDistributionContextReader({ read }).load({ location: distributionLocation, binding: distributionSeed.binding })).toEqual({ status: "ok", value: { context: { binding: { harness: "claude", directory: ".claude" }, rulesSubdir: "rules", invocation: "aidlc" }, files: [], inputs: [] } });
  expect(read).toHaveBeenCalledWith({ root: "seed", binding: { harness: "claude", directory: ".claude" } });
});
test("a shared directory does not substitute Kiro for Kiro IDE identity", async () => {
  expect(await createNativeDistributionContextReader({ read: mock().mockResolvedValue({ harness: { schemaVersion: 1, distribution: "kiro", harnessDir: ".kiro", rulesSubdir: "steering" }, invocation: "aidlc" }) }).load({ location: distributionLocation, binding: { harness: "kiro-ide", directory: ".kiro" } })).toEqual({ status: "invalid", findings: [{ code: "harness-mismatch", subject: "prepared-distribution", detail: "unfinished producer metadata must match the requested harness binding and native runtime context" }] });
});
test("missing native invocation cannot be defaulted into a source context", async () => {
  expect(await createNativeDistributionContextReader({ read: mock().mockResolvedValue({ harness: { schemaVersion: 1, distribution: "claude", harnessDir: ".claude", rulesSubdir: "rules" } }) }).load({ location: distributionLocation, binding: distributionSeed.binding })).toEqual({ status: "invalid", findings: [{ code: "harness-mismatch", subject: "prepared-distribution", detail: "unfinished producer metadata must match the requested harness binding and native runtime context" }] });
});
test("native context read unavailability remains failure data", async () => {
  expect(await createNativeDistributionContextReader({ read: mock().mockRejectedValue(new Error("absent")) }).load({ location: distributionLocation, binding: distributionSeed.binding })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "prepared-distribution", detail: "native runtime context unavailable: absent" }] });
});
