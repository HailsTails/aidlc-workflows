import { mock } from "bun:test";
import type { DistributionAssemblyRules, DistributionSeed, AssembledDistribution } from "../src/application/distribution-assembly.ts";
import type { DistributionSourceOperations } from "../src/adapters/distribution-source.ts";
import type { DistributionAssemblyServices } from "../examples/distribution-assembly.ts";
import type { ProjectionSet } from "../src/application/projection-set.ts";
import { assemblySkill } from "./projection-set-fixtures.ts";
export const distributionBasis = { source: { kind: "core", id: "framework" }, pin: "d062c81e5678c9f92162542b425b8a5f095e46e1" } as const;
export const distributionLocation = { sourceRoot: "source", root: "seed", basis: distributionBasis };
export const distributionMetadataFiles = [
  { path: ".claude/tools/data/aidlc-projection.json", bytes: new Uint8Array([123, 125]), mode: 0o644 },
  { path: ".claude/tools/data/aidlc-stamp.json", bytes: new Uint8Array([123, 125]), mode: 0o644 },
  { path: ".claude/tools/data/harness.json", bytes: new Uint8Array([123, 125]), mode: 0o644 },
];
export const distributionSkillFile = { path: ".claude/skills/aidlc-session-cost/SKILL.md", bytes: new Uint8Array([1, 2]), mode: 0o644 };
export const distributionBinaryFile = { path: ".claude/assets/opaque.bin", bytes: new Uint8Array([0, 255, 128]), mode: 0o755 };
export const distributionSeed: DistributionSeed = { basis: distributionBasis, binding: { harness: "claude", directory: ".claude" }, rulesSubdir: "rules", invocation: "aidlc", directories: [], files: [...distributionMetadataFiles, distributionSkillFile, distributionBinaryFile] };
export const distributionProjection: ProjectionSet = { scope: "selected-surfaces", target: distributionSeed.binding, units: [{ kind: "skill", key: "cost", projection: { ...assemblySkill, origin: { ...distributionBasis, path: "core/skills/aidlc-session-cost/SKILL.md" } } }], resources: [{ kind: "file", path: ".claude/skills/aidlc-session-cost/SKILL.md", body: "replacement" }] };
export const assembledDistribution: AssembledDistribution = { seed: distributionBasis, binding: distributionSeed.binding, directories: [], files: [...distributionMetadataFiles, { ...distributionSkillFile, bytes: new Uint8Array([9, 8]) }, distributionBinaryFile], replaced: [".claude/skills/aidlc-session-cost/SKILL.md"], retained: [".claude/tools/data/aidlc-projection.json", ".claude/tools/data/aidlc-stamp.json", ".claude/tools/data/harness.json", ".claude/assets/opaque.bin"] };
export const createDistributionRules = (): DistributionAssemblyRules => ({ path: mock().mockReturnValue("safe"), encode: mock().mockReturnValue(new Uint8Array([9, 8])) });
export const nativeInspection = { status: "ok", directories: [], projection: { stamp: { distribution: "claude", harnessDir: ".claude" } }, paths: [".claude/tools/data/aidlc-projection.json", ".claude/tools/data/aidlc-stamp.json", ".claude/tools/data/harness.json", ".claude/skills/aidlc-session-cost/SKILL.md", ".claude/assets/opaque.bin"] };
export const nativeDistributionContext = { harness: { schemaVersion: 1, distribution: "claude", harnessDir: ".claude", rulesSubdir: "rules" }, invocation: "aidlc" };
export const createDistributionSourceOperationsFixture = (): DistributionSourceOperations => ({ inspect: mock().mockResolvedValue(nativeInspection), context: mock().mockResolvedValue(nativeDistributionContext), read: mock().mockResolvedValue({ bytes: new Uint8Array([1, 2]), mode: 0o644 }), skill: mock().mockResolvedValue("authored skill"), pack: mock().mockResolvedValue(new Uint8Array([31, 139])) });
export const expectedLoadedSeed: DistributionSeed = { ...distributionSeed, files: distributionSeed.files.map((file) => ({ ...file, bytes: new Uint8Array([1, 2]), mode: 0o644 })) };
export const createDistributionServicesFixture = (): DistributionAssemblyServices => ({ source: { load: mock().mockResolvedValue({ status: "ok", value: distributionSeed }), skill: mock().mockResolvedValue({ status: "ok", value: "authored skill" }), archive: mock().mockResolvedValue({ status: "ok", value: new Uint8Array([31, 139]) }) }, prepare: mock().mockReturnValue({ target: distributionSeed.binding, units: [] }), project: mock().mockReturnValue({ status: "ok", value: distributionProjection }), assembler: { assemble: mock().mockReturnValue({ status: "ok", value: assembledDistribution }) }, compiler: mock().mockReturnValue({ compile: mock() }) });
export const invalidNativeInspections = [
  { name: "missing native stamp", inspection: { ...nativeInspection, projection: undefined } },
  { name: "traversal", inspection: { ...nativeInspection, paths: ["../secret"] } },
];
export const invalidNativeContexts = [{ name: "missing runtime invocation", context: { ...nativeDistributionContext, invocation: undefined } }, { name: "disagreeing runtime identity", context: { ...nativeDistributionContext, harness: { ...nativeDistributionContext.harness, distribution: "cursor" } } }];
export const missingMetadataSeed: DistributionSeed = { ...distributionSeed, files: distributionSeed.files.filter((file) => file.path !== ".claude/tools/data/aidlc-stamp.json") };
export const staleDistributionProjection: ProjectionSet = { ...distributionProjection, units: [{ kind: "skill", key: "cost", projection: { ...assemblySkill, origin: { ...distributionBasis, pin: "stale", path: "core/skills/aidlc-session-cost/SKILL.md" } } }] };
export const newPathProjection: ProjectionSet = { ...distributionProjection, resources: [{ kind: "file", path: ".claude/skills/new/SKILL.md", body: "new" }] };
export const metadataProjection: ProjectionSet = { ...distributionProjection, resources: [{ kind: "file", path: ".claude/tools/data/aidlc-projection.json", body: "{}" }] };
export const foreignRunnerProjection: ProjectionSet = { ...distributionProjection, units: [{ kind: "runners", key: "workflow", projection: { resources: distributionProjection.resources, runners: [{ compiler: { ...distributionBasis, path: "core/tools/aidlc-runner-gen.ts" }, owner: { kind: "plugin", id: "test-pro" }, request: { kind: "stage", slug: "test-pro-integration" }, harness: "claude", entrypoint: ".claude/skills/test-pro-integration/SKILL.md", resources: distributionProjection.resources, discovery: { kind: "native-directory", root: ".claude/skills" }, modelInvocation: "native-default" }] } }] };
