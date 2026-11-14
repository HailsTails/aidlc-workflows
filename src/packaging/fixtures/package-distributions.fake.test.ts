import { expect, test } from "bun:test";
import { accepted, refused } from "../../kernel/result.ts";
import { host, path } from "../../kernel/fixtures/values.fixture.ts";
import { accept } from "../../kernel/fixtures/accept.ts";
import type { DistributionBuildFailure } from "../application/ports.ts";
import { createDistributionBuildFixture } from "./package-distributions.fake.ts";

const claude = host({ name: "claude", directory: ".claude" });

test("the scripted scratch port supplies independent roots and preserves one-shot overrides", async () => {
  const current = createDistributionBuildFixture();
  current.scratch.mockResolvedValueOnce(accepted(new URL("file:///override/")));
  expect(await current.scratch()).toEqual(accepted(new URL("file:///override/")));
  expect(await current.scratch()).toEqual(accepted(new URL("file:///scratch/first/")));
  expect(await current.scratch()).toEqual(accepted(new URL("file:///scratch/second/")));
});

test("preparation returns the configured typed failure unchanged and records its call", async () => {
  const failures: readonly DistributionBuildFailure[] = [{ kind: "unknown-harness", harness: "absent" }];
  const preparation = refused(failures);
  const current = createDistributionBuildFixture({ preparation });
  expect(await current.prepare({ hosts: [claude] })).toBe(preparation);
  expect(current.prepare).toHaveBeenCalledWith({ hosts: [claude] });
  expect(current.events).toEqual(["prepare"]);
});

test("payload calls retain their requests and the returned payload identity", async () => {
  const current = createDistributionBuildFixture();
  const request = { host: claude, channel: "copy" as const, projectRoot: new URL("file:///copy/"), copy: null };
  const built = accept(await current.payloads(request));
  expect(current.produced[0]).toBe(built);
  expect(current.payloads).toHaveBeenCalledWith(request);
  expect(current.events).toEqual(["payload:claude:copy"]);
  expect(current.produced[0]?.descriptor.host).toBe(claude);
  expect(current.produced[0]?.channel).toBe("copy");
});

test("configured identical-root bytes are exposed as a declared payload file", async () => {
  const current = createDistributionBuildFixture({ shared: { claude: "first bytes" } });
  await current.payloads({ host: claude, channel: "native", projectRoot: new URL("file:///native/"), copy: null });
  expect(current.produced[0]?.descriptor.layout.rootIntegrations).toEqual([
    { path: path("AGENTS.md"), policy: "whole-file", presence: "required", sharing: "identical" },
  ]);
  expect(current.produced[0]?.files[0]).toMatchObject({ path: "AGENTS.md", content: { kind: "text", text: "first bytes" } });
});
