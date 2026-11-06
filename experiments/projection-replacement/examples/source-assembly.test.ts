import { expect, mock, test } from "bun:test";
import { prepareSourceAssembly, previewSourceAssembly } from "./source-assembly.ts";
import { createSourceAssemblyDependenciesFixture, sourceAssemblyArguments, sourcePreparationSnapshot } from "../__tests__/source-assembly-fixtures.ts";
import { assemblyFailure, assemblySet } from "../__tests__/projection-set-fixtures.ts";
import { successful } from "../__tests__/support.ts";

test("orchestrates source loading, projection and preview reporting", async () => {
  const dependencies = createSourceAssemblyDependenciesFixture();
  await previewSourceAssembly({ argv: ["source", "runtime", "pin"], dependencies });
  expect(dependencies.reader.load).toHaveBeenCalledWith(sourceAssemblyArguments);
  expect(dependencies.format).toHaveBeenCalledWith({ projection: assemblySet, showFile: null });
  expect(dependencies.reporter.finish).toHaveBeenCalledWith({ outcome: { status: "ok", value: "inventory\n" } });
});
test("invalid invocation never reads source", async () => {
  const dependencies = createSourceAssemblyDependenciesFixture();
  await previewSourceAssembly({ argv: [], dependencies: { ...dependencies, parse: mock().mockReturnValue(assemblyFailure) } });
  expect(dependencies.reader.load).not.toHaveBeenCalled();
  expect(dependencies.reporter.finish).toHaveBeenCalledWith({ outcome: assemblyFailure });
});
test("unavailable source never invokes compiler preparation", async () => {
  const dependencies = createSourceAssemblyDependenciesFixture();
  await previewSourceAssembly({ argv: [], dependencies: { ...dependencies, reader: { load: mock().mockResolvedValue(assemblyFailure) } } });
  expect(dependencies.compiler).not.toHaveBeenCalled();
  expect(dependencies.project).not.toHaveBeenCalled();
  expect(dependencies.reporter.finish).toHaveBeenCalledWith({ outcome: assemblyFailure });
});
test("preparation failure never projects partial surfaces", async () => {
  const dependencies = createSourceAssemblyDependenciesFixture();
  await previewSourceAssembly({ argv: [], dependencies: { ...dependencies, prepare: mock().mockReturnValue(assemblyFailure) } });
  expect(dependencies.project).not.toHaveBeenCalled();
  expect(dependencies.reporter.finish).toHaveBeenCalledWith({ outcome: assemblyFailure });
});
test("projection refusal never formats partial inventory", async () => {
  const dependencies = createSourceAssemblyDependenciesFixture();
  await previewSourceAssembly({ argv: [], dependencies: { ...dependencies, project: mock().mockReturnValue(assemblyFailure) } });
  expect(dependencies.format).not.toHaveBeenCalled();
  expect(dependencies.reporter.finish).toHaveBeenCalledWith({ outcome: assemblyFailure });
});
test("composition: source preparation declares owned surfaces without invoking runner compiler", () => {
  const compile = mock();
  const prepared = successful(prepareSourceAssembly({ snapshot: sourcePreparationSnapshot, pin: sourceAssemblyArguments.pin, sharedKnowledge: "all", compiler: { compile } }));
  expect(prepared.target).toEqual({ harness: "claude", directory: ".claude" });
  expect(prepared.units).toHaveLength(3);
  expect(prepared.units[0]?.key).toEqual("quality");
  expect(prepared.units[1]?.key).toEqual("session-cost");
  expect(prepared.units[2]).toEqual({ kind: "runners", key: "workflow", input: { compiler: { compile }, context: { harness: "claude", directory: ".claude", modelInvocation: "native-default" }, requests: [{ kind: "stage", slug: "code-generation" }, { kind: "scope", scope: "bugfix" }, { kind: "init" }, { kind: "compose" }] } });
  expect(compile).not.toHaveBeenCalled();
});
