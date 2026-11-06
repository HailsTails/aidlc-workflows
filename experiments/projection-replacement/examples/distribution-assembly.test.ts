import { expect, mock, test } from "bun:test";
import { assembleSourceDistribution, distributionArchiveCommand, prepareDistributionSurfaces } from "./distribution-assembly.ts";
import { assembledDistribution, createDistributionServicesFixture, distributionLocation, distributionProjection, distributionSeed } from "../__tests__/distribution-fixtures.ts";
import { assemblyFailure } from "../__tests__/projection-set-fixtures.ts";
test("orchestrates validated seed, source projections, assembly and native archive", async () => {
  const services = createDistributionServicesFixture();
  expect(await assembleSourceDistribution({ location: distributionLocation, services })).toEqual({ status: "ok", value: new Uint8Array([31, 139]) });
  expect(services.source.load).toHaveBeenCalledWith(distributionLocation);
  expect(services.assembler.assemble).toHaveBeenCalledWith({ seed: distributionSeed, projection: distributionProjection });
  expect(services.source.archive).toHaveBeenCalledWith({ sourceRoot: "source", distribution: assembledDistribution });
});
test("invalid seed cannot start projection or produce an archive", async () => {
  const services = createDistributionServicesFixture();
  expect(await assembleSourceDistribution({ location: distributionLocation, services: { ...services, source: { ...services.source, load: mock().mockResolvedValue(assemblyFailure) } } })).toEqual(assemblyFailure);
  expect(services.project).not.toHaveBeenCalled();
  expect(services.source.archive).not.toHaveBeenCalled();
});
test("missing authored source cannot fall back to the legacy skill", async () => {
  const services = createDistributionServicesFixture();
  expect(await assembleSourceDistribution({ location: distributionLocation, services: { ...services, source: { ...services.source, skill: mock().mockResolvedValue(assemblyFailure) } } })).toEqual(assemblyFailure);
  expect(services.project).not.toHaveBeenCalled();
  expect(services.source.archive).not.toHaveBeenCalled();
});
test("native projection refusal cannot silently retain the selected old file", async () => {
  const services = createDistributionServicesFixture();
  expect(await assembleSourceDistribution({ location: distributionLocation, services: { ...services, project: mock().mockReturnValue(assemblyFailure) } })).toEqual(assemblyFailure);
  expect(services.assembler.assemble).not.toHaveBeenCalled();
  expect(services.source.archive).not.toHaveBeenCalled();
});
test("ownership refusal cannot publish a partial archive", async () => {
  const services = createDistributionServicesFixture();
  expect(await assembleSourceDistribution({ location: distributionLocation, services: { ...services, assembler: { assemble: mock().mockReturnValue(assemblyFailure) } } })).toEqual(assemblyFailure);
  expect(services.source.archive).not.toHaveBeenCalled();
});
test("composition: source preparation uses native runtime invocation and retains explicit selection", () => {
  const compile = mock();
  expect(prepareDistributionSurfaces({ seed: distributionSeed, text: "authored skill", compiler: { compile } })).toEqual({ target: { harness: "claude", directory: ".claude" }, units: [{ kind: "skill", key: "session-cost", input: { text: "authored skill", origin: { source: { kind: "core", id: "framework" }, pin: "d062c81e5678c9f92162542b425b8a5f095e46e1", path: "core/skills/aidlc-session-cost/SKILL.md" }, context: { harness: "claude", directory: ".claude", invocation: "aidlc", rulesSubdir: "rules", memoryRoot: "aidlc/active-memory", modelInvocation: "native-default" } } }, { kind: "runners", key: "workflow", input: { compiler: { compile }, context: { harness: "claude", directory: ".claude", modelInvocation: "native-default" }, requests: [{ kind: "stage", slug: "code-generation" }, { kind: "scope", scope: "bugfix" }, { kind: "init" }, { kind: "compose" }] } }] });
  expect(compile).not.toHaveBeenCalled();
});
test("command rejects malformed invocation before assembly", async () => {
  const assemble = mock(), finish = mock();
  await distributionArchiveCommand({ argv: [], services: { parse: mock().mockReturnValue(assemblyFailure), assemble, command: { finish } } });
  expect(assemble).not.toHaveBeenCalled();
  expect(finish).toHaveBeenCalledWith({ outcome: assemblyFailure });
});
test("command forwards the complete assembly outcome to the binary boundary", async () => {
  const assemble = mock().mockResolvedValue({ status: "ok", value: new Uint8Array([31, 139]) }), finish = mock();
  await distributionArchiveCommand({ argv: [], services: { parse: mock().mockReturnValue({ status: "ok", value: { location: distributionLocation } }), assemble, command: { finish } } });
  expect(assemble).toHaveBeenCalledWith({ location: distributionLocation });
  expect(finish).toHaveBeenCalledWith({ outcome: { status: "ok", value: new Uint8Array([31, 139]) } });
});
