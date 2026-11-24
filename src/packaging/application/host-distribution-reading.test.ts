import { expect, mock, test } from "bun:test";
import { accepted, refused } from "../../kernel/result.ts";
import { host } from "../../kernel/fixtures/values.fixture.ts";
import { scratchHostDistributionFixture } from "../fixtures/host-distribution.fixture.ts";
import { SCRATCH_HOST } from "../../projection/fixtures/scratch-host.fixture.ts";
import { createHostDistributionReading } from "./host-distribution-reading.ts";

test("a distribution read matches both admitted name and directory before invoking its bound reader", () => {
  const read = mock(() => accepted(scratchHostDistributionFixture));
  const distribution = createHostDistributionReading({ members: [{ host: SCRATCH_HOST, read }] });
  expect(distribution({ host: host({ name: "scratch", directory: ".other" }) }))
    .toEqual(refused([{ kind: "unknown-harness", harness: "scratch" }]));
  expect(distribution({ host: host({ name: "other", directory: ".scratch" }) }))
    .toEqual(refused([{ kind: "unknown-harness", harness: "other" }]));
  expect(read).not.toHaveBeenCalled();
  expect(distribution({ host: SCRATCH_HOST })).toEqual(accepted(scratchHostDistributionFixture));
  expect(read).toHaveBeenCalledTimes(1);
  expect(read).toHaveBeenCalledWith();
});

test("the first exact duplicate member still wins and its typed refusal is wrapped once", () => {
  const failure = { kind: "invalid-path" as const, base: "project" as const, raw: "../outside" };
  const first = mock(() => refused(failure));
  const second = mock(() => accepted(scratchHostDistributionFixture));
  const distribution = createHostDistributionReading({ members: [{ host: SCRATCH_HOST, read: first },
    { host: SCRATCH_HOST, read: second }] });
  expect(distribution({ host: SCRATCH_HOST })).toEqual(refused([failure]));
  expect(first).toHaveBeenCalledTimes(1);
  expect(second).not.toHaveBeenCalled();
});
