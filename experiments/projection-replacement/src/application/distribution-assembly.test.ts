import { expect, mock, test } from "bun:test";
import { createDistributionAssembler } from "./distribution-assembly.ts";
import { assembledDistribution, createDistributionRules, distributionProjection, distributionSeed, foreignRunnerProjection, metadataProjection, missingMetadataSeed, newPathProjection, staleDistributionProjection } from "../../__tests__/distribution-fixtures.ts";
import { successful } from "../../__tests__/support.ts";
import { entryBasis, entrySet, entryProjection, entryManifestOrigin, entryHelperOrigin } from "../../__tests__/harness-document-fixtures.ts";

test.each([
  { authoring: [{ ...entryManifestOrigin, pin: "foreign" }, entryHelperOrigin], subject: "harness/claude/manifest.ts" },
  { authoring: [entryManifestOrigin, { ...entryHelperOrigin, pin: "foreign" }], subject: "scripts/earlier-release-regions.ts" },
])("entry document authoring provenance cannot bypass the seed basis", ({ authoring, subject }) => {
  const rules = createDistributionRules();
  expect(createDistributionAssembler({ rules }).assemble({ seed: { ...distributionSeed, basis: entryBasis, files: [...distributionSeed.files, { path: ".claude/skills/aidlc/SKILL.md", bytes: new Uint8Array([69]), mode: 0o644 }] }, projection: { ...entrySet, units: [{ kind: "harness-document", key: "harness-main-skill", projection: { ...entryProjection, authoring } }] } })).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject, detail: "seeded core assembly requires selected sources and compiler to match the seed's source basis" }] });
  expect(rules.encode).not.toHaveBeenCalled();
});
test("replaces selected bytes while retaining all other files and native modes", () => {
  const rules = createDistributionRules();
  const assembled = successful(createDistributionAssembler({ rules }).assemble({ seed: distributionSeed, projection: distributionProjection }));
  expect(assembled).toEqual(assembledDistribution);
  expect(assembled.files[4]).toEqual({ path: ".claude/assets/opaque.bin", bytes: new Uint8Array([0, 255, 128]), mode: 0o755 });
  expect(rules.encode).toHaveBeenCalledTimes(1);
  expect(rules.encode).toHaveBeenCalledWith({ text: "replacement" });
  expect(distributionSeed.files[4]).toEqual({ path: ".claude/assets/opaque.bin", bytes: new Uint8Array([0, 255, 128]), mode: 0o755 });
});
test("refuses a foreign harness before encoding any output", () => {
  const rules = createDistributionRules();
  expect(createDistributionAssembler({ rules }).assemble({ seed: distributionSeed, projection: { ...distributionProjection, target: { harness: "cursor", directory: ".cursor" } } })).toEqual({ status: "invalid", findings: [{ code: "harness-mismatch", subject: "distribution", detail: "selected projection and seed must describe the same harness binding" }] });
  expect(rules.encode).not.toHaveBeenCalled();
});
test("refuses a stale selected source basis", () => {
  expect(createDistributionAssembler({ rules: createDistributionRules() }).assemble({ seed: distributionSeed, projection: staleDistributionProjection })).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "core/skills/aidlc-session-cost/SKILL.md", detail: "seeded core assembly requires selected sources and compiler to match the seed's source basis" }] });
});
test("a core compiler cannot stand in for an undeclared plugin source basis", () => {
  expect(createDistributionAssembler({ rules: createDistributionRules() }).assemble({ seed: distributionSeed, projection: foreignRunnerProjection })).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: ".claude/skills/test-pro-integration/SKILL.md", detail: "runner owner has no declared source basis in this core distribution seed" }] });
});
test("refuses missing producer metadata", () => {
  expect(createDistributionAssembler({ rules: createDistributionRules() }).assemble({ seed: missingMetadataSeed, projection: distributionProjection })).toEqual({ status: "invalid", findings: [{ code: "invalid-input", subject: ".claude/tools/data/aidlc-stamp.json", detail: "complete distribution seed requires the existing descriptor, stamp and harness metadata" }] });
});
test("refuses implicit new ownership rather than silently dropping a native file", () => {
  expect(createDistributionAssembler({ rules: createDistributionRules() }).assemble({ seed: distributionSeed, projection: newPathProjection })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: ".claude/skills/new/SKILL.md", detail: "adding a new distribution path requires an explicit ownership contribution; this seeded assembly only replaces existing paths" }] });
});
test("direct typed metadata replacement cannot bypass producer ownership", () => {
  expect(createDistributionAssembler({ rules: createDistributionRules() }).assemble({ seed: distributionSeed, projection: metadataProjection })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: ".claude/tools/data/aidlc-projection.json", detail: "projection metadata belongs to the distribution producer and cannot be replaced as a native surface" }] });
});
test("duplicate replacement owners refuse atomically", () => {
  const rules = createDistributionRules();
  expect(createDistributionAssembler({ rules }).assemble({ seed: distributionSeed, projection: { ...distributionProjection, resources: [...distributionProjection.resources, ...distributionProjection.resources] } })).toEqual({ status: "invalid", findings: [{ code: "destination-collision", subject: ".claude/skills/aidlc-session-cost/SKILL.md", detail: "each replacement must have one owner" }] });
  expect(rules.encode).not.toHaveBeenCalled();
});
test("unsafe existing paths still refuse at assembly", () => {
  const path = mock().mockReturnValueOnce("unsafe").mockReturnValue("safe");
  expect(createDistributionAssembler({ rules: { ...createDistributionRules(), path } }).assemble({ seed: distributionSeed, projection: distributionProjection })).toEqual({ status: "invalid", findings: [{ code: "invalid-destination", subject: ".claude/tools/data/aidlc-projection.json", detail: "distribution seed paths must be safe relative files" }] });
});

test("default directory preservation does not invoke an injected structure preparer", () => {
  const structure = mock().mockReturnValue({ status: "invalid", findings: [{ code: "capability-gap", subject: "structure", detail: "not selected" }] });
  expect(createDistributionAssembler({ rules: createDistributionRules(), structure }).assemble({ seed: distributionSeed, projection: distributionProjection })).toEqual({ status: "ok", value: assembledDistribution });
  expect(structure).not.toHaveBeenCalled();
});

test("explicit structure receives final replacement bytes and independent directory mode", () => {
  const rules = createDistributionRules();
  const structure = mock().mockReturnValue({ status: "ok", value: [{ path: ".claude", mode: 0o755 }] });
  expect(createDistributionAssembler({ rules, structure }).assemble({ seed: { ...distributionSeed, directories: [{ path: ".claude", mode: 0o700 }], structure: { kind: "file-parents", mode: 0o755 } }, projection: distributionProjection })).toEqual({ status: "ok", value: { ...assembledDistribution, directories: [{ path: ".claude", mode: 0o755 }], structure: { kind: "file-parents", mode: 0o755 } } });
  expect(structure).toHaveBeenCalledWith({ files: assembledDistribution.files, retained: [{ path: ".claude", mode: 0o700 }], mode: 0o755, rules: { path: rules.path } });
  expect(structure).toHaveBeenCalledTimes(1);
});

test("structure refusal returns no partial assembled distribution", () => {
  const structure = mock().mockReturnValue({ status: "invalid", findings: [{ code: "capability-gap", subject: "empty", detail: "retained scaffold requires a declaration" }] });
  expect(createDistributionAssembler({ rules: createDistributionRules(), structure }).assemble({ seed: { ...distributionSeed, structure: { kind: "file-parents", mode: 0o755 } }, projection: distributionProjection })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "empty", detail: "retained scaffold requires a declaration" }] });
});

test("ownership refusal stops directory preparation as well as encoding", () => {
  const rules = createDistributionRules();
  const structure = mock();
  expect(createDistributionAssembler({ rules, structure }).assemble({ seed: { ...distributionSeed, structure: { kind: "file-parents", mode: 0o755 } }, projection: newPathProjection })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: ".claude/skills/new/SKILL.md", detail: "adding a new distribution path requires an explicit ownership contribution; this seeded assembly only replaces existing paths" }] });
  expect(structure).not.toHaveBeenCalled();
  expect(rules.encode).not.toHaveBeenCalled();
});
