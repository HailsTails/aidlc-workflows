import { expect, mock, test } from "bun:test";
import { prepareCoreMethodRuntime, type CoreMethodRuntimeServices } from "./core-method-runtime.ts";
import { methodBasis, methodContext, methodSources, methodFiles, methodFailure, markerSources, markerFiles } from "../__tests__/method-fixtures.ts";
const createServices = (): CoreMethodRuntimeServices => ({ reader: { load: mock<CoreMethodRuntimeServices["reader"]["load"]>().mockResolvedValue({ status: "ok", value: methodSources }) }, prepare: mock<CoreMethodRuntimeServices["prepare"]>().mockReturnValue({ status: "ok", value: methodFiles }), prose: mock<CoreMethodRuntimeServices["prose"]>(), encode: mock<CoreMethodRuntimeServices["encode"]>().mockReturnValue(new Uint8Array([7, 8])) });
test("composes method source reading, preparation and byte encoding with explicit source provenance", async () => {
  const services = createServices();
  expect(await prepareCoreMethodRuntime({ sourceRoot: "source", basis: methodBasis, context: methodContext, mode: 0o644, services })).toEqual({ status: "ok", value: { basis: methodBasis, inputs: methodSources.inputs, deliveries: methodFiles, files: [{ path: "aidlc/spaces/default/memory/org.md", bytes: new Uint8Array([7, 8]), mode: 0o644 }, { path: ".claude/tools/data/memory-seed/org.md", bytes: new Uint8Array([7, 8]), mode: 0o644 }] } });
  expect(services.reader.load).toHaveBeenCalledTimes(1);
  expect(services.reader.load).toHaveBeenCalledWith({ sourceRoot: "source", basis: methodBasis });
  expect(services.prepare).toHaveBeenCalledTimes(1);
  expect(services.prepare).toHaveBeenCalledWith({ sources: methodSources, context: methodContext, prose: services.prose });
  expect(services.encode).toHaveBeenCalledTimes(2);
  expect(services.encode).toHaveBeenNthCalledWith(1, { text: "prepared" });
  expect(services.encode).toHaveBeenNthCalledWith(2, { text: "prepared" });
});
test("source refusal suppresses preparation and encoding", async () => {
  const services = { ...createServices(), reader: { load: mock<CoreMethodRuntimeServices["reader"]["load"]>().mockResolvedValue(methodFailure) } };
  expect(await prepareCoreMethodRuntime({ sourceRoot: "source", basis: methodBasis, context: methodContext, mode: 0o644, services })).toEqual(methodFailure);
  expect(services.reader.load).toHaveBeenCalledWith({ sourceRoot: "source", basis: methodBasis });
  expect(services.prepare).not.toHaveBeenCalled();
  expect(services.encode).not.toHaveBeenCalled();
});
test("rendering refusal suppresses byte preparation", async () => {
  const services = { ...createServices(), prepare: mock<CoreMethodRuntimeServices["prepare"]>().mockReturnValue(methodFailure) };
  expect(await prepareCoreMethodRuntime({ sourceRoot: "source", basis: methodBasis, context: methodContext, mode: 0o644, services })).toEqual(methodFailure);
  expect(services.prepare).toHaveBeenCalledWith({ sources: methodSources, context: methodContext, prose: services.prose });
  expect(services.encode).not.toHaveBeenCalled();
});
test("opaque marker delivery preserves raw bytes without a prose encoder", async () => {
  const services = { ...createServices(), reader: { load: mock<CoreMethodRuntimeServices["reader"]["load"]>().mockResolvedValue({ status: "ok", value: markerSources }) }, prepare: mock<CoreMethodRuntimeServices["prepare"]>().mockReturnValue({ status: "ok", value: markerFiles }) };
  expect(await prepareCoreMethodRuntime({ sourceRoot: "source", basis: methodBasis, context: methodContext, mode: 0o644, services })).toEqual({ status: "ok", value: { basis: methodBasis, inputs: markerSources.inputs, deliveries: markerFiles, files: [{ path: "aidlc/spaces/default/memory/templates/.gitkeep", bytes: new Uint8Array([35, 10]), mode: 0o644 }, { path: ".claude/tools/data/memory-seed/templates/.gitkeep", bytes: new Uint8Array([35, 10]), mode: 0o644 }] } });
  expect(services.encode).not.toHaveBeenCalled();
});
test("unsupported delivery is refused before reading authored source", async () => {
  const services = createServices();
  expect(await prepareCoreMethodRuntime({ sourceRoot: "source", basis: methodBasis, context: { ...methodContext, invocation: "aidlc" }, mode: 0o644, services })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "core-method-runtime", detail: "method preparation qualifies Bun copy delivery; native-release invocation preparation remains separate" }] });
  expect(services.reader.load).not.toHaveBeenCalled();
});
test("invalid output mode is refused before reading authored source", async () => {
  const services = createServices();
  expect(await prepareCoreMethodRuntime({ sourceRoot: "source", basis: methodBasis, context: methodContext, mode: -1, services })).toEqual({ status: "invalid", findings: [{ code: "invalid-input", subject: "core-method-runtime", detail: "prepared method files require permission mode 0..0777" }] });
  expect(services.reader.load).not.toHaveBeenCalled();
});
