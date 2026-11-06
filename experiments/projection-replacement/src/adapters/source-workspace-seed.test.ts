import { expect, mock, test } from "bun:test";
import { createSourceWorkspaceSeedPreparer, createSourceWorkspaceSeedServices } from "./source-workspace-seed.ts";
import { prepareWorkspaceSeedInput } from "../application/workspace-seed.ts";
import { createWorkspaceSeedFixture, workspaceSeedRequest, workspaceSeedDigest, workspaceSeedSource, workspaceSeedPrepared } from "../../__tests__/workspace-seed-fixtures.ts";

test("reads the source API once between two raw-byte observations and forwards its declared seed", async () => {
  const services = createWorkspaceSeedFixture();
  const freshWorkspaceSeed = mock().mockReturnValue({ file: "aidlc/active-space", content: "default\n" });
  const operations = { ...services.operations, module: mock().mockResolvedValue({ status: "ok", value: { freshWorkspaceSeed } }) };
  expect(await createSourceWorkspaceSeedPreparer({ services: { ...services, operations } }).prepare(workspaceSeedRequest)).toEqual({ status: "ok", value: workspaceSeedPrepared });
  expect(operations.read).toHaveBeenNthCalledWith(1, { sourceRoot: "authored-source", path: "scripts/workspace-seed.ts" });
  expect(operations.read).toHaveBeenNthCalledWith(2, { sourceRoot: "authored-source", path: "scripts/workspace-seed.ts" });
  expect(operations.read).toHaveBeenCalledTimes(2);
  expect(operations.module.mock.calls).toEqual([[{ sourceRoot: "authored-source", path: "scripts/workspace-seed.ts", sha256: workspaceSeedDigest }]]);
  expect(operations.digest).toHaveBeenNthCalledWith(1, { bytes: new Uint8Array([83]) });
  expect(operations.digest).toHaveBeenNthCalledWith(2, { bytes: new Uint8Array([83]) });
  expect(operations.digest).toHaveBeenCalledTimes(2);
  expect(freshWorkspaceSeed.mock.calls).toEqual([[]]);
  expect(services.prepare).toHaveBeenCalledWith({ source: workspaceSeedSource, mode: 0o640, encode: services.encode });
});

test.each([{ imported: {} }, { imported: { freshWorkspaceSeed: "default" } }])("missing or noncallable Native API refuses without a default substitution", async ({ imported }) => {
  const services = createWorkspaceSeedFixture();
  const operations = { ...services.operations, module: mock().mockResolvedValue({ status: "ok", value: imported }) };
  expect(await createSourceWorkspaceSeedPreparer({ services: { ...services, operations } }).prepare(workspaceSeedRequest)).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "source-workspace-seed", detail: "native source must export callable freshWorkspaceSeed; no runtime fallback is substituted" }] });
  expect(services.prepare).not.toHaveBeenCalled();
});

test("a callable Native export that throws returns failure data without preparation", async () => {
  const services = createWorkspaceSeedFixture();
  const callable = Proxy.revocable(mock(), {});
  callable.revoke();
  const operations = { ...services.operations, module: mock().mockResolvedValue({ status: "ok", value: { freshWorkspaceSeed: callable.proxy } }) };
  expect(await createSourceWorkspaceSeedPreparer({ services: { ...services, operations } }).prepare(workspaceSeedRequest)).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "source-workspace-seed", detail: "native freshWorkspaceSeed unavailable" }] });
  expect(operations.read).toHaveBeenCalledTimes(1);
  expect(services.prepare).not.toHaveBeenCalled();
  expect(services.encode).not.toHaveBeenCalled();
});

test.each([
  { seed: { file: "../active-space", content: "default\n" } },
  { seed: { file: "aidlc/active-space", content: 1 } },
  { seed: { file: "aidlc/active-space", content: "default\n", overwriteExisting: true } },
])("unsupported Native seed shape cannot authorize another path or installer policy", async ({ seed }) => {
  const services = createWorkspaceSeedFixture();
  const operations = { ...services.operations, module: mock().mockResolvedValue({ status: "ok", value: { freshWorkspaceSeed: mock().mockReturnValue(seed) } }) };
  expect(await createSourceWorkspaceSeedPreparer({ services: { ...services, operations } }).prepare(workspaceSeedRequest)).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "source-workspace-seed", detail: "native freshWorkspaceSeed must return only the relative aidlc/active-space file and source-owned text" }] });
  expect(services.prepare).not.toHaveBeenCalled();
});

test("payload policy remains owned by the selected Native source", async () => {
  const services = createWorkspaceSeedFixture();
  const operations = { ...services.operations, module: mock().mockResolvedValue({ status: "ok", value: { freshWorkspaceSeed: mock().mockReturnValue({ file: "aidlc/active-space", content: "source-declared\n" }) } }) };
  await createSourceWorkspaceSeedPreparer({ services: { ...services, operations } }).prepare(workspaceSeedRequest);
  expect(services.prepare).toHaveBeenCalledWith({ source: { ...workspaceSeedSource, content: "source-declared\n" }, mode: 0o640, encode: services.encode });
});

test("changed source cannot be accepted by re-observing its new digest", async () => {
  const services = createWorkspaceSeedFixture();
  const operations = { ...services.operations, digest: mock().mockReturnValueOnce(workspaceSeedDigest).mockReturnValue("cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc") };
  expect(await createSourceWorkspaceSeedPreparer({ services: { ...services, operations } }).prepare(workspaceSeedRequest)).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "source-workspace-seed", detail: "fresh workspace seed source changed during preparation" }] });
  expect(services.prepare).not.toHaveBeenCalled();
});

test.each([
  { basis: { source: { kind: "plugin", id: "rin" }, pin: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" } },
  { basis: { source: { kind: "core", id: "other" }, pin: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" } },
  { basis: { source: { kind: "core", id: "framework" }, pin: "aaaaaaaa" } },
] as const)("foreign basis refuses before source access", async ({ basis }) => {
  const services = createWorkspaceSeedFixture();
  expect(await createSourceWorkspaceSeedPreparer({ services }).prepare({ ...workspaceSeedRequest, basis })).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "source-workspace-seed", detail: "fresh workspace seed requires the framework source basis and full source pin" }] });
  expect(services.operations.read).not.toHaveBeenCalled();
});

test.each([{ mode: -1 }, { mode: 0o1000 }, { mode: 1.5 }])("invalid mode $mode refuses at the adapter before source access", async ({ mode }) => {
  const services = createWorkspaceSeedFixture();
  expect(await createSourceWorkspaceSeedPreparer({ services }).prepare({ ...workspaceSeedRequest, mode })).toEqual({ status: "invalid", findings: [{ code: "invalid-input", subject: "source-workspace-seed", detail: "fresh workspace seed requires a file mode between 0 and 0777" }] });
  expect(services.operations.read).not.toHaveBeenCalled();
  expect(services.operations.module).not.toHaveBeenCalled();
  expect(services.operations.digest).not.toHaveBeenCalled();
  expect(services.prepare).not.toHaveBeenCalled();
  expect(services.encode).not.toHaveBeenCalled();
});

test("source read failure remains explicit data", async () => {
  const services = createWorkspaceSeedFixture();
  const operations = { ...services.operations, read: mock().mockResolvedValue({ status: "invalid", findings: [{ code: "capability-gap", subject: "scripts/workspace-seed.ts", detail: "source unavailable" }] }) };
  expect(await createSourceWorkspaceSeedPreparer({ services: { ...services, operations } }).prepare(workspaceSeedRequest)).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "scripts/workspace-seed.ts", detail: "source unavailable" }] });
  expect(operations.module).not.toHaveBeenCalled();
  expect(services.prepare).not.toHaveBeenCalled();
});

test("source import failure does not invoke a fallback or preparation", async () => {
  const services = createWorkspaceSeedFixture();
  const operations = { ...services.operations, module: mock().mockResolvedValue({ status: "invalid", findings: [{ code: "capability-gap", subject: "scripts/workspace-seed.ts", detail: "source import unavailable" }] }) };
  expect(await createSourceWorkspaceSeedPreparer({ services: { ...services, operations } }).prepare(workspaceSeedRequest)).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "scripts/workspace-seed.ts", detail: "source import unavailable" }] });
  expect(services.prepare).not.toHaveBeenCalled();
});

test("application preparation refusal is returned unchanged", async () => {
  const services = { ...createWorkspaceSeedFixture(), prepare: mock().mockReturnValue({ status: "invalid", findings: [{ code: "invalid-input", subject: "seed-mode", detail: "mode unsupported" }] }) };
  expect(await createSourceWorkspaceSeedPreparer({ services }).prepare(workspaceSeedRequest)).toEqual({ status: "invalid", findings: [{ code: "invalid-input", subject: "seed-mode", detail: "mode unsupported" }] });
});

test("production services select typed source IO and the existing byte encoder", () => {
  expect(createSourceWorkspaceSeedServices()).toEqual({ operations: { read: expect.any(Function), module: expect.any(Function), digest: expect.any(Function) }, prepare: prepareWorkspaceSeedInput, encode: expect.any(Function) });
});
