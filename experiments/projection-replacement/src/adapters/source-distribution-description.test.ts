import { expect, mock, test } from "bun:test";
import { createSourceDescriptionPreparer } from "./source-distribution-description.ts";
import { createSourceDescriptionFixture, createRevokedDescriptionFixture, sourceDescriptionRequest, preparedDescription, descriptionInputs, descriptionExpectedEnvironment, descriptionWireFiles } from "../../__tests__/distribution-description-fixtures.ts";
test.each([
  { files: [descriptionWireFiles[0], descriptionWireFiles[0], descriptionWireFiles[2], descriptionWireFiles[3], descriptionWireFiles[4], descriptionWireFiles[5]], inputs: descriptionInputs },
  { files: [{ file: "../foreign", bytes: [68] }, descriptionWireFiles[1], descriptionWireFiles[2], descriptionWireFiles[3], descriptionWireFiles[4], descriptionWireFiles[5]], inputs: descriptionInputs },
  { files: descriptionWireFiles, inputs: [descriptionInputs[0], descriptionInputs[1], descriptionInputs[2], descriptionInputs[3], descriptionInputs[4], descriptionInputs[5], descriptionInputs[6], descriptionInputs[7], descriptionInputs[8], descriptionInputs[9], descriptionInputs[0]] },
  { files: descriptionWireFiles, inputs: [descriptionInputs[0], descriptionInputs[1], descriptionInputs[2], descriptionInputs[3], descriptionInputs[4], descriptionInputs[5], descriptionInputs[6], descriptionInputs[7], descriptionInputs[8], descriptionInputs[9], { path: "foreign.ts", sha256: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" }] },
  { files: descriptionWireFiles, inputs: [descriptionInputs[0], descriptionInputs[1], descriptionInputs[2], descriptionInputs[3], descriptionInputs[4], descriptionInputs[5], descriptionInputs[6], descriptionInputs[7], descriptionInputs[8], descriptionInputs[9]] },
])("count-only artifact or witness admission cannot accept substitutions or omissions", async ({ files, inputs }) => {
  const operations = { ...createSourceDescriptionFixture(), spawn: mock().mockReturnValue({ exitCode: 0, error: null, stderr: "", stdout: JSON.stringify({ status: "ok", files, inputs }) }) };
  expect(await createSourceDescriptionPreparer({ operations }).prepare(sourceDescriptionRequest)).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "source-distribution-description", detail: "distribution description must retain every declared source witness and exactly its six producer artifacts" }] });
});
test("admits the six producer artifacts and complete source witnesses with explicit modes", async () => {
  expect(await createSourceDescriptionPreparer({ operations: createSourceDescriptionFixture() }).prepare(sourceDescriptionRequest)).toEqual({ status: "ok", value: preparedDescription });
});
test("supplies final inventory and isolated environment without ambient release or credential values", async () => {
  const operations = createSourceDescriptionFixture();
  await createSourceDescriptionPreparer({ operations }).prepare(sourceDescriptionRequest);
  expect(operations.paths).toHaveBeenCalledWith(sourceDescriptionRequest);
  expect(operations.spawn).toHaveBeenCalledTimes(1);
  expect(operations.spawn).toHaveBeenCalledWith({ binary: "bun", args: ["--no-env-file", "--no-install", "--eval", expect.any(String)], cwd: "/scratch", env: descriptionExpectedEnvironment, input: '{"sourceRoot":"/source","files":[".gitignore",".mcp.json",".claude/tools/aidlc-version.ts"],"directories":[".claude",".claude/tools"]}' });
});
test.each([{ exitCode: 1, error: null }, { exitCode: 0, error: "timeout" }])("process health failures refuse before wire admission", async ({ exitCode, error }) => {
  const operations = { ...createSourceDescriptionFixture(), spawn: mock().mockReturnValue({ exitCode, error, stderr: "", stdout: "{}" }) };
  expect(await createSourceDescriptionPreparer({ operations }).prepare(sourceDescriptionRequest)).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "source-distribution-description", detail: "distribution description process unavailable or reported diagnostics" }] });
});
test("unparseable JSON remains an explicit process reply failure", async () => {
  const operations = { ...createSourceDescriptionFixture(), spawn: mock().mockReturnValue({ exitCode: 0, error: null, stderr: "", stdout: "not-json" }) };
  expect(await createSourceDescriptionPreparer({ operations }).prepare(sourceDescriptionRequest)).toEqual({ status: "invalid", findings: [{ code: "invalid-input", subject: "source-distribution-description", detail: "distribution description process must return one JSON response" }] });
});
test.each([
  { basis: { source: { kind: "plugin", id: "example" }, pin: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" }, mode: 0o644 },
  { basis: { source: { kind: "core", id: "other" }, pin: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" }, mode: 0o644 },
  { basis: { source: { kind: "core", id: "framework" }, pin: "short" }, mode: 0o644 },
  { basis: sourceDescriptionRequest.basis, mode: -1 },
] as const)("invalid ownership basis or modes refuse before process", async ({ basis, mode }) => {
  const operations = createSourceDescriptionFixture();
  expect(await createSourceDescriptionPreparer({ operations }).prepare({ ...sourceDescriptionRequest, basis, mode })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "source-distribution-description", detail: "distribution description requires the pinned framework Claude copy profile and explicit file modes" }] });
  expect(operations.spawn).not.toHaveBeenCalled();
});
test("empty artifact sets cannot satisfy a successful native reply", async () => {
  const operations = { ...createSourceDescriptionFixture(), spawn: mock().mockReturnValue({ exitCode: 0, error: null, stderr: "", stdout: JSON.stringify({ status: "ok", files: [], inputs: descriptionInputs }) }) };
  expect(await createSourceDescriptionPreparer({ operations }).prepare(sourceDescriptionRequest)).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "source-distribution-description", detail: "distribution description must retain every declared source witness and exactly its six producer artifacts" }] });
});
test("process stderr refuses otherwise successful output", async () => {
  const operations = { ...createSourceDescriptionFixture(), spawn: mock().mockReturnValue({ exitCode: 0, error: null, stderr: "warning", stdout: "{}" }) };
  expect(await createSourceDescriptionPreparer({ operations }).prepare(sourceDescriptionRequest)).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "source-distribution-description", detail: "distribution description process unavailable or reported diagnostics" }] });
});
test("revoked process capabilities return explicit failure", async () => {
  expect(await createSourceDescriptionPreparer({ operations: createRevokedDescriptionFixture() }).prepare(sourceDescriptionRequest)).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "source-distribution-description", detail: "distribution description process capability unavailable" }] });
});
test("source-tree scratch paths refuse before process invocation", async () => {
  const operations = { ...createSourceDescriptionFixture(), paths: mock().mockReturnValue({ sourceRoot: "/source", root: "/source/scratch" }) };
  expect(await createSourceDescriptionPreparer({ operations }).prepare(sourceDescriptionRequest)).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "source-distribution-description", detail: "distribution description requires a working root outside authored source" }] });
  expect(operations.spawn).not.toHaveBeenCalled();
});
test("unknown native wire variants refuse before file admission", async () => {
  const operations = { ...createSourceDescriptionFixture(), spawn: mock().mockReturnValue({ exitCode: 0, error: null, stderr: "", stdout: '{"status":"ok","files":"unknown","inputs":[]}' }) };
  expect(await createSourceDescriptionPreparer({ operations }).prepare(sourceDescriptionRequest)).toEqual({ status: "invalid", findings: [{ code: "invalid-input", subject: "source-distribution-description", detail: "distribution description requires byte artifacts and SHA-256 source witnesses or explicit unavailability" }] });
});
test("native preparation refusal retains its specific finding", async () => {
  const operations = { ...createSourceDescriptionFixture(), spawn: mock().mockReturnValue({ exitCode: 0, error: null, stderr: "", stdout: '{"status":"refused","detail":"unclassified projection entry"}' }) };
  expect(await createSourceDescriptionPreparer({ operations }).prepare(sourceDescriptionRequest)).toEqual({ status: "invalid", findings: [{ code: "invalid-input", subject: "source-distribution-description", detail: "unclassified projection entry" }] });
});
test("unavailable source capabilities stay distinct from rejected producer inputs", async () => {
  const operations = { ...createSourceDescriptionFixture(), spawn: mock().mockReturnValue({ exitCode: 0, error: null, stderr: "", stdout: '{"status":"unavailable","detail":"native export unavailable"}' }) };
  expect(await createSourceDescriptionPreparer({ operations }).prepare(sourceDescriptionRequest)).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "source-distribution-description", detail: "native export unavailable" }] });
});
