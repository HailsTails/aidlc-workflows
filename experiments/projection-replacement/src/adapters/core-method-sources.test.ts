import { expect, mock, test } from "bun:test";
import { createCoreMethodSourceReader, type CoreMethodSourceOperations } from "./core-method-sources.ts";
import { methodBasis, methodSources, markerSources } from "../../__tests__/method-fixtures.ts";
test("admits authored method prose with its source basis and raw-byte witness", async () => {
  const inventory = mock<CoreMethodSourceOperations["inventory"]>().mockResolvedValue([{ path: "core/memory/org.md", bytes: new Uint8Array([114, 97, 119]) }]);
  const digest = mock<CoreMethodSourceOperations["digest"]>().mockReturnValue("raw-source-digest");
  expect(await createCoreMethodSourceReader({ operations: { inventory, digest } }).load({ sourceRoot: "source", basis: methodBasis })).toEqual({ status: "ok", value: methodSources });
  expect(inventory).toHaveBeenCalledTimes(1);
  expect(inventory).toHaveBeenCalledWith({ sourceRoot: "source" });
  expect(digest).toHaveBeenCalledTimes(1);
  expect(digest).toHaveBeenCalledWith({ bytes: new Uint8Array([114, 97, 119]) });
});
test("marker comments are preserved as authored bytes rather than silently discarded", async () => {
  const inventory = mock<CoreMethodSourceOperations["inventory"]>().mockResolvedValue([{ path: "core/memory/templates/.gitkeep", bytes: new Uint8Array([35, 10]) }]);
  const digest = mock<CoreMethodSourceOperations["digest"]>().mockReturnValue("marker-raw-digest");
  expect(await createCoreMethodSourceReader({ operations: { inventory, digest } }).load({ sourceRoot: "source", basis: methodBasis })).toEqual({ status: "ok", value: markerSources });
  expect(digest).toHaveBeenCalledTimes(1);
  expect(digest).toHaveBeenCalledWith({ bytes: new Uint8Array([35, 10]) });
});
test.each([
  [[{ path: "core/memory/../org.md", bytes: new Uint8Array([114, 97, 119]) }]],
  [[{ path: "core/memory/data.bin", bytes: new Uint8Array([114, 97, 119]) }]],
  [[{ path: "core/memory/templates/.gitkeep", bytes: 42 }]],
  [[{ path: "core/memory/org.md", text: 42 }]],
  [[]],
])("refuses unsupported method input without accepting a subset: %j", async (candidate) => {
  const inventory = mock<CoreMethodSourceOperations["inventory"]>().mockResolvedValue(candidate);
  const digest = mock<CoreMethodSourceOperations["digest"]>();
  expect(await createCoreMethodSourceReader({ operations: { inventory, digest } }).load({ sourceRoot: "source", basis: methodBasis })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "core-method-sources", detail: "read a nonempty byte inventory of safe core/memory Markdown and .gitkeep files; unsupported entries were not discarded" }] });
  expect(digest).not.toHaveBeenCalled();
});
test("refuses duplicate source paths before deriving delivery records", async () => {
  const inventory = mock<CoreMethodSourceOperations["inventory"]>().mockResolvedValue([{ path: "core/memory/org.md", bytes: new Uint8Array([114, 97, 119]) }, { path: "core/memory/org.md", bytes: new Uint8Array([111]) }]);
  const digest = mock<CoreMethodSourceOperations["digest"]>();
  expect(await createCoreMethodSourceReader({ operations: { inventory, digest } }).load({ sourceRoot: "source", basis: methodBasis })).toEqual({ status: "invalid", findings: [{ code: "duplicate", subject: "core-method-sources", detail: "authored method paths must be unique before delivery preparation" }] });
  expect(digest).not.toHaveBeenCalled();
});
test("refuses an unrelated owner before source I/O", async () => {
  const inventory = mock<CoreMethodSourceOperations["inventory"]>();
  const digest = mock<CoreMethodSourceOperations["digest"]>();
  expect(await createCoreMethodSourceReader({ operations: { inventory, digest } }).load({ sourceRoot: "source", basis: { ...methodBasis, source: { kind: "plugin", id: "rin" } } })).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "core-method-sources", detail: "declare the framework source and full source pin before reading authored method files" }] });
  expect(inventory).not.toHaveBeenCalled();
});
test("converts an unavailable inventory into an explicit operational failure", async () => {
  const inventory = mock<CoreMethodSourceOperations["inventory"]>().mockRejectedValue(new Error("unavailable"));
  const digest = mock<CoreMethodSourceOperations["digest"]>();
  expect(await createCoreMethodSourceReader({ operations: { inventory, digest } }).load({ sourceRoot: "source", basis: methodBasis })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "core-method-sources", detail: "authored method inventory unavailable" }] });
  expect(digest).not.toHaveBeenCalled();
});
test("invalid Markdown UTF-8 refuses the entire collection before issuing any witness", async () => {
  const inventory = mock<CoreMethodSourceOperations["inventory"]>().mockResolvedValue([{ path: "core/memory/org.md", bytes: new Uint8Array([114]) }, { path: "core/memory/team.md", bytes: new Uint8Array([255]) }]);
  const digest = mock<CoreMethodSourceOperations["digest"]>();
  expect(await createCoreMethodSourceReader({ operations: { inventory, digest } }).load({ sourceRoot: "source", basis: methodBasis })).toEqual({ status: "invalid", findings: [{ code: "invalid-input", subject: "core/memory/team.md", detail: "authored method Markdown must contain valid UTF-8; no replacement characters were introduced" }] });
  expect(digest).not.toHaveBeenCalled();
});
test("opaque marker bytes are not decoded or treated as Markdown", async () => {
  const inventory = mock<CoreMethodSourceOperations["inventory"]>().mockResolvedValue([{ path: "core/memory/templates/.gitkeep", bytes: new Uint8Array([255]) }]);
  const digest = mock<CoreMethodSourceOperations["digest"]>().mockReturnValue("opaque-digest");
  expect(await createCoreMethodSourceReader({ operations: { inventory, digest } }).load({ sourceRoot: "source", basis: methodBasis })).toEqual({ status: "ok", value: { basis: methodBasis, documents: [{ kind: "directory-marker", origin: { ...methodBasis, path: "core/memory/templates/.gitkeep" }, relativePath: "templates/.gitkeep", bytes: new Uint8Array([255]) }], inputs: [{ path: "core/memory/templates/.gitkeep", sha256: "opaque-digest" }] } });
  expect(digest).toHaveBeenCalledWith({ bytes: new Uint8Array([255]) });
});
test("malformed source pins refuse before inventory access", async () => {
  const inventory = mock<CoreMethodSourceOperations["inventory"]>();
  const digest = mock<CoreMethodSourceOperations["digest"]>();
  expect(await createCoreMethodSourceReader({ operations: { inventory, digest } }).load({ sourceRoot: "source", basis: { ...methodBasis, pin: "short" } })).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "core-method-sources", detail: "declare the framework source and full source pin before reading authored method files" }] });
  expect(inventory).not.toHaveBeenCalled();
});
