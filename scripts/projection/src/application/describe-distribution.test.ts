import { expect, mock, test } from "bun:test";
import { describeDistribution } from "./describe-distribution.ts";
import { createDescriptionFixture, descriptionRequest, preparedDescription, descriptionVersionPreparation, descriptionPaths } from "../../../../tests/unit/projection/support/__tests__/distribution-description-fixtures.ts";
test("already matching prepared bytes retain existing files and modes without adding duplicates", async () => {
  const seed = { ...descriptionRequest.seed, files: [{ path: ".claude/tools/aidlc-version.ts", bytes: new Uint8Array([86]), mode: 0o644 }, { path: ".gitignore", bytes: new Uint8Array([68]), mode: 0o600 }, { path: ".mcp.json", bytes: new Uint8Array([68]), mode: 0o644 }, { path: ".claude/tools/data/root-blocks/gitignore", bytes: new Uint8Array([68]), mode: 0o644 }, { path: ".claude/tools/data/root-blocks/.mcp.json", bytes: new Uint8Array([68]), mode: 0o644 }, { path: ".claude/tools/data/aidlc-projection.json", bytes: new Uint8Array([68]), mode: 0o644 }, { path: ".claude/tools/data/aidlc-stamp.json", bytes: new Uint8Array([68]), mode: 0o644 }] };
  const services = { ...createDescriptionFixture(), admit: mock().mockReturnValue({ status: "ok", value: { additions: [], unchanged: descriptionPaths } }) };
  expect(await describeDistribution({ request: { ...descriptionRequest, seed }, services })).toEqual({ status: "ok", value: { ...seed, inputPreparations: [descriptionVersionPreparation, preparedDescription.preparation] } });
});
test("prepares metadata from final runner, runtime and anticipated producer paths before admission", async () => {
  const services = createDescriptionFixture();
  expect(await describeDistribution({ request: descriptionRequest, services })).toEqual({ status: "ok", value: { ...descriptionRequest.seed, files: [{ path: ".claude/tools/aidlc-version.ts", bytes: new Uint8Array([86]), mode: 0o644 }, ...preparedDescription.files], inputPreparations: [descriptionVersionPreparation, preparedDescription.preparation] } });
  expect(services.structure).toHaveBeenCalledWith({ files: [{ path: ".claude/tools/aidlc-version.ts" }, { path: ".claude/skills/aidlc-poc/SKILL.md" }, { path: ".gitignore" }, { path: ".mcp.json" }, { path: ".claude/tools/data/root-blocks/gitignore" }, { path: ".claude/tools/data/root-blocks/.mcp.json" }, { path: ".claude/tools/data/aidlc-projection.json" }, { path: ".claude/tools/data/aidlc-stamp.json" }], retained: [], mode: 0o755, rules: services.rules });
  expect(services.preparation.prepare).toHaveBeenCalledWith({ sourceRoot: "source", root: "scratch", basis: descriptionRequest.seed.basis, binding: { harness: "claude", directory: ".claude" }, mode: 0o644, invocation: "bun .claude/tools/aidlc.ts", finalFiles: [descriptionRequest.seed.files[0], { path: ".claude/skills/aidlc-poc/SKILL.md", bytes: new TextEncoder().encode("runner"), mode: 0o644 }], files: [".claude/tools/aidlc-version.ts", ".claude/skills/aidlc-poc/SKILL.md", ".gitignore", ".mcp.json", ".claude/tools/data/root-blocks/gitignore", ".claude/tools/data/root-blocks/.mcp.json", ".claude/tools/data/aidlc-projection.json", ".claude/tools/data/aidlc-stamp.json"], directories: [".claude", ".claude/tools", ".claude/tools/data", ".claude/skills", ".claude/skills/aidlc-poc"] });
  expect(services.admit).toHaveBeenCalledWith({ candidates: preparedDescription.files, inventory: descriptionRequest.seed, rules: services.rules });
});
test("version metadata cannot be invented for unprepared runtime modules", async () => {
  const services = createDescriptionFixture();
  expect(await describeDistribution({ request: { ...descriptionRequest, seed: { ...descriptionRequest.seed, inputPreparations: [] } }, services })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "distribution-description", detail: "source-version metadata requires an explicit structure profile and source-prepared runtime version module" }] });
  expect(services.structure).not.toHaveBeenCalled();
  expect(services.preparation.prepare).not.toHaveBeenCalled();
});
test("directory refusal prevents native metadata preparation", async () => {
  const services = { ...createDescriptionFixture(), structure: mock().mockReturnValue({ status: "invalid", findings: [{ code: "destination-collision", subject: "paths", detail: "case aliases" }] }) };
  expect(await describeDistribution({ request: descriptionRequest, services })).toEqual({ status: "invalid", findings: [{ code: "destination-collision", subject: "paths", detail: "case aliases" }] });
  expect(services.preparation.prepare).not.toHaveBeenCalled();
});
test("native metadata refusal prevents byte admission", async () => {
  const services = { ...createDescriptionFixture(), preparation: { prepare: mock().mockResolvedValue({ status: "invalid", findings: [{ code: "capability-gap", subject: "metadata", detail: "source unavailable" }] }) } };
  expect(await describeDistribution({ request: descriptionRequest, services })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "metadata", detail: "source unavailable" }] });
  expect(services.admit).not.toHaveBeenCalled();
});
test("changed prepared metadata remains a conflict rather than being overwritten", async () => {
  const services = { ...createDescriptionFixture(), admit: mock().mockReturnValue({ status: "invalid", findings: [{ code: "foreign-content", subject: ".gitignore", detail: "preserve custom bytes" }] }) };
  expect(await describeDistribution({ request: descriptionRequest, services })).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: ".gitignore", detail: "preserve custom bytes" }] });
});
