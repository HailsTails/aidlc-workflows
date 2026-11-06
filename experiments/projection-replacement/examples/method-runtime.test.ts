import { expect, mock, test } from "bun:test";
import { prepareAuthoredMethodRuntime, createMethodRuntimeServices, type MethodRuntimeServices } from "./method-runtime.ts";
import { prepareCoreMethodRuntime } from "./core-method-runtime.ts";
import { planPreparedRuntimeFiles } from "../src/domain/prepared-runtime-files.ts";
import { pathStatus } from "../src/domain/model.ts";
import { distributionSeed } from "../__tests__/distribution-fixtures.ts";
import { methodBasis, methodContext, methodFiles, methodSources, methodFailure } from "../__tests__/method-fixtures.ts";
const methodSeed = { ...distributionSeed, basis: methodBasis, invocation: "bun .claude/tools/aidlc.ts" };
const methodBytes = [{ path: "aidlc/spaces/default/memory/org.md", bytes: new Uint8Array([7]), mode: 0o644 }, { path: ".claude/tools/data/memory-seed/org.md", bytes: new Uint8Array([7]), mode: 0o644 }];
const createServices = (): MethodRuntimeServices => ({ prepare: mock<MethodRuntimeServices["prepare"]>().mockResolvedValue({ status: "ok", value: { basis: methodBasis, inputs: methodSources.inputs, deliveries: methodFiles, files: methodBytes } }), admit: mock<MethodRuntimeServices["admit"]>().mockReturnValue({ status: "ok", value: { additions: methodBytes, unchanged: [] } }), rules: { path: mock().mockReturnValue("safe") } });
test("prepares method delivery and admits its byte files into the unfinished runtime", async () => {
  const services = createServices();
  expect(await prepareAuthoredMethodRuntime({ sourceRoot: "source", seed: methodSeed, mode: 0o644, services })).toEqual({ status: "ok", value: { seed: { ...methodSeed, files: [...methodSeed.files, ...methodBytes] }, preparation: { kind: "prepared", paths: ["aidlc/spaces/default/memory/org.md", ".claude/tools/data/memory-seed/org.md"], inputs: methodSources.inputs } } });
  expect(services.prepare).toHaveBeenCalledWith({ sourceRoot: "source", basis: methodBasis, context: methodContext, mode: 0o644 });
  expect(services.admit).toHaveBeenCalledWith({ candidates: methodBytes, inventory: methodSeed, rules: services.rules });
});
test("matching existing files remain intact and still have source-prepared provenance", async () => {
  const services = { ...createServices(), admit: mock<MethodRuntimeServices["admit"]>().mockReturnValue({ status: "ok", value: { additions: [], unchanged: ["aidlc/spaces/default/memory/org.md", ".claude/tools/data/memory-seed/org.md"] } }) };
  expect(await prepareAuthoredMethodRuntime({ sourceRoot: "source", seed: { ...methodSeed, files: [...methodSeed.files, ...methodBytes] }, mode: 0o644, services })).toEqual({ status: "ok", value: { seed: { ...methodSeed, files: [...methodSeed.files, ...methodBytes] }, preparation: { kind: "prepared", paths: ["aidlc/spaces/default/memory/org.md", ".claude/tools/data/memory-seed/org.md"], inputs: methodSources.inputs } } });
  expect(services.admit).toHaveBeenCalledWith({ candidates: methodBytes, inventory: { ...methodSeed, files: [...methodSeed.files, ...methodBytes] }, rules: services.rules });
});
test("source preparation refusal cannot admit stale method files", async () => {
  const services = { ...createServices(), prepare: mock<MethodRuntimeServices["prepare"]>().mockResolvedValue(methodFailure) };
  expect(await prepareAuthoredMethodRuntime({ sourceRoot: "source", seed: methodSeed, mode: 0o644, services })).toEqual(methodFailure);
  expect(services.prepare).toHaveBeenCalledWith({ sourceRoot: "source", basis: methodBasis, context: methodContext, mode: 0o644 });
  expect(services.admit).not.toHaveBeenCalled();
});
test("an admission conflict is returned without changing the runtime", async () => {
  const services = { ...createServices(), admit: mock<MethodRuntimeServices["admit"]>().mockReturnValue(methodFailure) };
  expect(await prepareAuthoredMethodRuntime({ sourceRoot: "source", seed: methodSeed, mode: 0o644, services })).toEqual(methodFailure);
  expect(services.admit).toHaveBeenCalledWith({ candidates: methodBytes, inventory: methodSeed, rules: services.rules });
});
test("production wiring exposes the existing preparation and shared admission ports", () => {
  expect(createMethodRuntimeServices()).toEqual({ prepare: prepareCoreMethodRuntime, admit: planPreparedRuntimeFiles, rules: { path: pathStatus } });
});
