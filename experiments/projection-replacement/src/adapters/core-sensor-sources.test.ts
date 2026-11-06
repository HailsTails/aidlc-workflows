import { expect, mock, test } from "bun:test";
import { createCoreSensorSourceOperations, createCoreSensorSourceReader } from "./core-sensor-sources.ts";
import { createCoreSensorSourceFixture, sensorSourceLocation, sensorSourceInventory, sensorSourceExpected } from "../../__tests__/core-sensor-source-fixtures.ts";

test("preserves opaque sensor prose, extensible filenames and raw-byte witnesses", async () => {
  const operations = createCoreSensorSourceFixture();
  expect(await createCoreSensorSourceReader({ operations }).load(sensorSourceLocation)).toEqual({ status: "ok", value: sensorSourceExpected });
  expect(operations.inventory).toHaveBeenCalledWith({ sourceRoot: "authored-sensors" });
  expect(operations.inventory).toHaveBeenCalledTimes(1);
  expect(operations.decode).toHaveBeenNthCalledWith(1, { bytes: new Uint8Array([239, 187, 191, 45, 45, 45, 13, 10, 120, 58, 32, 91, 13, 10]), path: "core/sensors/aidlc-check.md" });
  expect(operations.decode).toHaveBeenNthCalledWith(2, { bytes: new Uint8Array([65, 10]), path: "core/sensors/aidlc-new-check-2.md" });
  expect(operations.decode).toHaveBeenCalledTimes(2);
  expect(operations.digest).toHaveBeenNthCalledWith(1, { bytes: new Uint8Array([239, 187, 191, 45, 45, 45, 13, 10, 120, 58, 32, 91, 13, 10]) });
  expect(operations.digest).toHaveBeenNthCalledWith(2, { bytes: new Uint8Array([65, 10]) });
  expect(operations.digest).toHaveBeenCalledTimes(2);
});

test.each([
  { name: "empty inventory", candidates: [] },
  { name: "nested path", candidates: [{ path: "core/sensors/nested/aidlc-check.md", bytes: new Uint8Array([65]) }] },
  { name: "foreign root", candidates: [{ path: "plugins/rin/sensors/aidlc-check.md", bytes: new Uint8Array([65]) }] },
  { name: "uppercase identity", candidates: [{ path: "core/sensors/aidlc-Check.md", bytes: new Uint8Array([65]) }] },
  { name: "empty identifier segment", candidates: [{ path: "core/sensors/aidlc-check--other.md", bytes: new Uint8Array([65]) }] },
  { name: "trailing identifier separator", candidates: [{ path: "core/sensors/aidlc-check-.md", bytes: new Uint8Array([65]) }] },
  { name: "non Markdown companion", candidates: [...sensorSourceInventory, { path: "core/sensors/aidlc-check.json", bytes: new Uint8Array([65]) }] },
  { name: "reencoded text input", candidates: [{ path: "core/sensors/aidlc-check.md", text: "opaque prose" }] },
  { name: "JSON byte array", candidates: [{ path: "core/sensors/aidlc-check.md", bytes: [65] }] },
  { name: "forged origin field", candidates: [{ path: "core/sensors/aidlc-check.md", bytes: new Uint8Array([65]), origin: { source: { kind: "plugin", id: "rin" }, pin: "foreign", path: "core/sensors/aidlc-check.md" } }] },
])("$name refuses instead of dropping or normalizing an unsupported entry", async ({ candidates }) => {
  const operations = { ...createCoreSensorSourceFixture(), inventory: mock().mockResolvedValue({ status: "ok", value: candidates }) };
  expect(await createCoreSensorSourceReader({ operations }).load(sensorSourceLocation)).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "core-sensor-sources", detail: "authored core sensors require a nonempty byte inventory of direct core/sensors/aidlc-<canonical>.md files; unsupported entries were not dropped" }] });
  expect(operations.decode).not.toHaveBeenCalled();
  expect(operations.digest).not.toHaveBeenCalled();
});

test.each([
  { second: new Uint8Array([65]) },
  { second: new Uint8Array([66]) },
])("duplicate paths cannot select an identity by byte equality or array order", async ({ second }) => {
  const operations = { ...createCoreSensorSourceFixture(), inventory: mock().mockResolvedValue({ status: "ok", value: [{ path: "core/sensors/aidlc-check.md", bytes: new Uint8Array([65]) }, { path: "core/sensors/aidlc-check.md", bytes: second }] }) };
  expect(await createCoreSensorSourceReader({ operations }).load(sensorSourceLocation)).toEqual({ status: "invalid", findings: [{ code: "duplicate", subject: "core-sensor-sources", detail: "authored core sensor paths must be unique" }] });
  expect(operations.decode).not.toHaveBeenCalled();
  expect(operations.digest).not.toHaveBeenCalled();
});

test.each([
  { basis: { source: { kind: "plugin", id: "rin" }, pin: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" } },
  { basis: { source: { kind: "core", id: "other" }, pin: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" } },
  { basis: { source: { kind: "core", id: "framework" }, pin: "aaaaaaaa" } },
] as const)("foreign source basis refuses before inventory IO", async ({ basis }) => {
  const operations = createCoreSensorSourceFixture();
  expect(await createCoreSensorSourceReader({ operations }).load({ ...sensorSourceLocation, basis })).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "core-sensor-sources", detail: "declare the framework source basis and full source pin before reading authored core sensors" }] });
  expect(operations.inventory).not.toHaveBeenCalled();
  expect(operations.decode).not.toHaveBeenCalled();
  expect(operations.digest).not.toHaveBeenCalled();
});

test("an inventory refusal propagates without interpreting candidate bytes", async () => {
  const operations = { ...createCoreSensorSourceFixture(), inventory: mock().mockResolvedValue({ status: "invalid", findings: [{ code: "capability-gap", subject: "native-source", detail: "source inventory unavailable" }] }) };
  expect(await createCoreSensorSourceReader({ operations }).load(sensorSourceLocation)).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "native-source", detail: "source inventory unavailable" }] });
  expect(operations.decode).not.toHaveBeenCalled();
  expect(operations.digest).not.toHaveBeenCalled();
});

test("one decoding refusal prevents a successful partial source result", async () => {
  const operations = { ...createCoreSensorSourceFixture(), decode: mock().mockReturnValueOnce({ status: "invalid", findings: [{ code: "invalid-input", subject: "core/sensors/aidlc-check.md", detail: "invalid UTF-8" }] }).mockReturnValue({ status: "ok", value: "A\n" }) };
  expect(await createCoreSensorSourceReader({ operations }).load(sensorSourceLocation)).toEqual({ status: "invalid", findings: [{ code: "invalid-input", subject: "core/sensors/aidlc-check.md", detail: "invalid UTF-8" }] });
  expect(operations.digest).toHaveBeenCalledTimes(1);
  expect(operations.digest).toHaveBeenCalledWith({ bytes: new Uint8Array([65, 10]) });
});

test("canonical inventory factory requests original bytes from the existing source walker", async () => {
  const read = mock().mockResolvedValue(sensorSourceInventory), digest = mock(), decode = mock();
  const operations = createCoreSensorSourceOperations({ inventory: { read }, digest, decode });
  expect(await operations.inventory({ sourceRoot: "authored-sensors" })).toEqual({ status: "ok", value: sensorSourceInventory });
  expect(read.mock.calls).toEqual([[{ sourceRoot: "authored-sensors", directory: "core/sensors", encoding: "bytes" }]]);
  expect(operations.digest).toBe(digest);
  expect(operations.decode).toBe(decode);
});

test("canonical inventory factory translates legacy walker rejection at its bridge", async () => {
  const operations = createCoreSensorSourceOperations({ inventory: { read: mock().mockRejectedValue(new Error("unavailable walker")) } });
  expect(await operations.inventory({ sourceRoot: "authored-sensors" })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "core-sensor-sources", detail: "authored core sensor byte inventory unavailable" }] });
});

test("canonical UTF-8 decoding retains BOM and original CRLF without parsing metadata", () => {
  const operations = createCoreSensorSourceOperations();
  expect(operations.decode({ bytes: new Uint8Array([239, 187, 191, 45, 45, 45, 13, 10, 120, 58, 32, 91, 13, 10]), path: "core/sensors/aidlc-check.md" })).toEqual({ status: "ok", value: "\uFEFF---\r\nx: [\r\n" });
});

test("canonical UTF-8 decoding refuses malformed bytes as data", () => {
  const operations = createCoreSensorSourceOperations();
  expect(operations.decode({ bytes: new Uint8Array([255]), path: "core/sensors/aidlc-check.md" })).toEqual({ status: "invalid", findings: [{ code: "invalid-input", subject: "core/sensors/aidlc-check.md", detail: "authored core sensors require readable UTF-8 bytes" }] });
});
