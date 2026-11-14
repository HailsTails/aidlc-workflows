import { expect, test } from "bun:test";
import { accepted, refused } from "../../kernel/result.ts";
import { host, path, source } from "../../kernel/fixtures/values.fixture.ts";
import type { PackagingRefusal } from "../domain/artifact.ts";
import { createDistributionBuildFixture as fixture } from "../fixtures/package-distributions.fake.ts";

const claude = host({ name: "claude", directory: ".claude" });
const codex = host({ name: "codex", directory: ".codex" });
const first = new URL("file:///scratch/first/");
const second = new URL("file:///scratch/second/");
const fault: PackagingRefusal = { kind: "output-tree-failed", operation: "write",
  path: "file:///broken/", reason: "failed" };
test.each(["build", "check"] as const)("%s refuses hosts before any capture or output effect", async (mode) => {
  const current = fixture();
  const refusals: readonly PackagingRefusal[] = [{ kind: "host-build-refused",
    reason: { kind: "invalid-distribution-id", raw: "bad" } }];
  const outcome = await current.operation[mode]({ hosts: [], sweep: "full", refusals });
  expect(outcome).toEqual(refused(refusals));
  expect(current.events).toEqual([]);
  expect(current.scratch).not.toHaveBeenCalled();
  expect(current.read).not.toHaveBeenCalled();
});

test.each(["build", "check"] as const)("%s stops before preparation when fingerprint capture refuses", async (mode) => {
  const current = fixture();
  current.fingerprint.mockResolvedValue(refused(fault));
  const outcome = await current.operation[mode]({ hosts: [claude], sweep: "full", refusals: [] });
  expect(outcome).toEqual(refused([fault]));
  expect(current.prepare).not.toHaveBeenCalled();
  expect(current.forget).not.toHaveBeenCalled();
  expect(current.scratch).not.toHaveBeenCalled();
  expect(current.remove).not.toHaveBeenCalled();
});

test.each(["build", "check"] as const)("%s retains preparation refusal before every output mutation", async (mode) => {
  const current = fixture({ preparation: refused([fault]) });
  const outcome = await current.operation[mode]({ hosts: [claude], sweep: "full", refusals: [] });
  expect(outcome).toEqual(refused([fault]));
  expect(current.events).toEqual(["fingerprint", "prepare"]);
  expect(current.prepare).toHaveBeenCalledWith({ hosts: [claude] });
  expect(current.forget).not.toHaveBeenCalled();
  expect(current.scratch).not.toHaveBeenCalled();
  expect(current.writePayload).not.toHaveBeenCalled();
  expect(current.remove).not.toHaveBeenCalled();
});

test("each pass hands its actual output root and copy identity into the native payload", async () => {
  const current = fixture();
  await current.operation.check({ hosts: [claude], refusals: [] });
  expect(current.prepare).toHaveBeenCalledTimes(1);
  expect(current.payloads).toHaveBeenNthCalledWith(1, { host: claude, channel: "copy",
    projectRoot: new URL("file:///scratch/first/dist/claude/"), copy: null });
  expect(current.payloads).toHaveBeenNthCalledWith(2, { host: claude, channel: "native",
    projectRoot: new URL("file:///scratch/first/dist-release/claude/"), copy: current.produced[0] });
  expect(current.payloads).toHaveBeenNthCalledWith(3, { host: claude, channel: "copy",
    projectRoot: new URL("file:///scratch/second/dist/claude/"), copy: null });
  expect(current.payloads).toHaveBeenNthCalledWith(4, { host: claude, channel: "native",
    projectRoot: new URL("file:///scratch/second/dist-release/claude/"), copy: current.produced[2] });
  expect(current.payloads.mock.calls[1]?.[0].copy).toBe(current.produced[0]);
  expect(current.payloads.mock.calls[3]?.[0].copy).toBe(current.produced[2]);
});

test("a full build orders forget, sweep, copy/native writes, plugins and record", async () => {
  const current = fixture();
  expect(await current.operation.build({ hosts: [claude], sweep: "full", refusals: [] }))
    .toEqual(accepted({ record: "recorded" }));
  expect(current.events).toEqual([
    "fingerprint", "prepare", "forget", "list:file:///repo/dist/", "remove:file:///repo/dist/stale.txt",
    "list:file:///repo/dist-release/", "remove:file:///repo/dist-release/stale.txt",
    "remove:file:///repo/dist-release/plugins", "remove:file:///repo/dist/plugins",
    "payload:claude:copy", "write:claude:copy", "payload:claude:native", "write:claude:native", "plugins", "record",
  ]);
  expect(current.record).toHaveBeenCalledWith({ hosts: [claude.distribution], builtFrom: "before" });
});

test("a named build removes only selected plugin trees and retains unrelated hosts and plugins", async () => {
  const current = fixture();
  expect(await current.operation.build({ hosts: [codex], sweep: "named", refusals: [] }))
    .toEqual(accepted({ record: "recorded" }));
  expect(current.list).not.toHaveBeenCalled();
  expect(current.remove).toHaveBeenCalledTimes(1);
  expect(current.remove).toHaveBeenCalledWith(new URL("file:///repo/dist/plugins/test-pro/codex"));
  expect(current.writePayload).toHaveBeenNthCalledWith(1, { root: new URL("file:///repo/dist/codex/"), payload: current.produced[0] });
  expect(current.writePayload).toHaveBeenNthCalledWith(2, { root: new URL("file:///repo/dist-release/codex/"), payload: current.produced[1] });
});

test("a changed input is an explicit recorded outcome after an otherwise finished build", async () => {
  const current = fixture();
  current.record.mockResolvedValue(accepted("inputs-changed"));
  expect(await current.operation.build({ hosts: [claude], sweep: "named", refusals: [] }))
    .toEqual(accepted({ record: "inputs-changed" }));
  expect(current.events).toEqual(["fingerprint", "prepare", "forget", "remove:file:///repo/dist/plugins/test-pro/claude",
    "payload:claude:copy", "write:claude:copy", "payload:claude:native", "write:claude:native", "plugins"]);
});

test("a refused copy payload stops before writing, plugins and source recording", async () => {
  const current = fixture();
  current.payloads.mockResolvedValue(refused([fault]));
  expect(await current.operation.build({ hosts: [claude], sweep: "named", refusals: [] })).toEqual(refused([fault]));
  expect(current.writePayload).not.toHaveBeenCalled();
  expect(current.buildPlugins).not.toHaveBeenCalled();
  expect(current.record).not.toHaveBeenCalled();
});

test("a shared-root conflict is returned before plugin output and recording", async () => {
  const current = fixture({ shared: { claude: "claude", codex: "codex" } });
  const outcome = await current.operation.build({ hosts: [claude, codex], sweep: "named", refusals: [] });
  expect(outcome).toEqual(refused([{ kind: "shared-root-integration-differs", path: path("AGENTS.md"),
    distributions: [claude.distribution, codex.distribution] }]));
  expect(current.buildPlugins).not.toHaveBeenCalled();
  expect(current.record).not.toHaveBeenCalled();
});

test("check builds two independent trees, compares both channels and removes both scratch roots", async () => {
  const current = fixture();
  expect(await current.operation.check({ hosts: [claude], refusals: [] }))
    .toEqual(accepted({ problems: [], inputs: "unchanged" }));
  expect(current.writePayload).toHaveBeenNthCalledWith(1, { root: new URL("file:///scratch/first/dist/claude/"), payload: current.produced[0] });
  expect(current.writePayload).toHaveBeenNthCalledWith(2, { root: new URL("file:///scratch/first/dist-release/claude/"), payload: current.produced[1] });
  expect(current.writePayload).toHaveBeenNthCalledWith(3, { root: new URL("file:///scratch/second/dist/claude/"), payload: current.produced[2] });
  expect(current.writePayload).toHaveBeenNthCalledWith(4, { root: new URL("file:///scratch/second/dist-release/claude/"), payload: current.produced[3] });
  expect(current.fingerprint).toHaveBeenCalledTimes(2);
  expect(current.forget).not.toHaveBeenCalled();
  expect(current.record).not.toHaveBeenCalled();
  expect(current.remove.mock.calls).toEqual([[first], [second]]);
});

test("check retains differences before fingerprint revalidation and still removes both roots", async () => {
  const current = fixture();
  const firstFiles = [{ path: source("changed.txt"), content: { kind: "text" as const, text: "first" } }];
  current.read.mockResolvedValueOnce(accepted(firstFiles))
    .mockResolvedValueOnce(accepted([{ path: source("changed.txt"), content: { kind: "text", text: "second" } }]));
  expect(await current.operation.check({ hosts: [claude], refusals: [] }))
    .toEqual(accepted({ problems: ["DIFFERS between builds: dist/changed.txt"], inputs: "unchanged" }));
  expect(current.fingerprint).toHaveBeenCalledTimes(1);
  expect(current.remove.mock.calls).toEqual([[first], [second]]);
});

test("check exposes changed inputs and cleans both roots without recording", async () => {
  const current = fixture();
  current.fingerprint.mockResolvedValueOnce(accepted("before")).mockResolvedValueOnce(accepted("after"));
  expect(await current.operation.check({ hosts: [claude], refusals: [] }))
    .toEqual(accepted({ problems: [], inputs: "inputs-changed" }));
  expect(current.record).not.toHaveBeenCalled();
  expect(current.remove.mock.calls).toEqual([[first], [second]]);
});

test("a refused check pass retains its failure and cleans both roots", async () => {
  const current = fixture();
  current.payloads.mockResolvedValue(refused([fault]));
  expect(await current.operation.check({ hosts: [claude], refusals: [] })).toEqual(refused([fault]));
  expect(current.remove.mock.calls).toEqual([[first], [second]]);
});

test("failed second scratch allocation cleans the first root", async () => {
  const current = fixture();
  current.scratch.mockResolvedValueOnce(accepted(first)).mockResolvedValueOnce(refused(fault));
  expect(await current.operation.check({ hosts: [claude], refusals: [] })).toEqual(refused([fault]));
  expect(current.remove.mock.calls).toEqual([[first]]);
});

test("cleanup attempts the second root even when removing the first refuses", async () => {
  const current = fixture();
  current.remove.mockResolvedValueOnce(refused(fault)).mockResolvedValueOnce(accepted(second));
  expect(await current.operation.check({ hosts: [claude], refusals: [] })).toEqual(refused([fault]));
  expect(current.remove.mock.calls).toEqual([[first], [second]]);
});

test("an unexpected rejected capability still removes both allocated roots", async () => {
  const current = fixture();
  current.payloads.mockRejectedValue(new Error("unexpected capability rejection"));
  const checking = current.operation.check({ hosts: [claude], refusals: [] });
  await expect(checking).rejects.toThrow("unexpected capability rejection");
  expect(current.remove.mock.calls).toEqual([[first], [second]]);
});
