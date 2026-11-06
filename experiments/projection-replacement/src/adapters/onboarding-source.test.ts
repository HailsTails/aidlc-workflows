import { expect, mock, test } from "bun:test";
import { createOnboardingPreparer } from "./onboarding-source.ts";
import { createOnboardingProcessFixture, createRevokedOnboardingProcess, onboardingExpectedEnvironment, onboardingRequest, preparedOnboarding } from "../../__tests__/onboarding-fixtures.ts";

test("retains assembled text and all raw authoring witnesses", async () => {
  expect(await createOnboardingPreparer({ operations: createOnboardingProcessFixture() }).prepare(onboardingRequest)).toEqual({ status: "ok", value: preparedOnboarding });
});
test("uses explicit source and separate scratch paths without inherited credentials or project bindings", async () => {
  const operations = createOnboardingProcessFixture();
  await createOnboardingPreparer({ operations }).prepare(onboardingRequest);
  expect(operations.paths).toHaveBeenCalledWith(onboardingRequest);
  expect(operations.spawn).toHaveBeenCalledTimes(1);
  expect(operations.spawn).toHaveBeenCalledWith({ binary: "bun", args: ["--no-env-file", "--no-install", "--eval", expect.any(String)], cwd: "/workspace", input: '{"root":"/source"}', env: onboardingExpectedEnvironment });
  expect(operations.prose).toHaveBeenCalledWith({ markdown: "Run {{INVOKE}} at {{HARNESS_DIR}}/rules/aidlc.md\n", context: { harness: "claude", directory: ".claude", invocation: "bun .claude/tools/aidlc.ts", rulesSubdir: "rules", optionLetters: null }, subject: "core/templates/onboarding.md" });
});
test("revoked process capability is translated at its boundary", async () => {
  expect(await createOnboardingPreparer({ operations: createRevokedOnboardingProcess() }).prepare(onboardingRequest)).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "onboarding-source", detail: "onboarding process capability unavailable" }] });
});
test.each([{ root: "/source", workRoot: "/source" }, { root: "H:/SOURCE", workRoot: "h:\\source\\scratch" }])("source-tree scratch placement refuses before execution", async ({ root, workRoot }) => {
  const operations = { ...createOnboardingProcessFixture(), paths: mock().mockReturnValue({ root, workRoot }) };
  expect(await createOnboardingPreparer({ operations }).prepare(onboardingRequest)).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "onboarding-source", detail: "onboarding requires a separate working root outside its authored source tree" }] });
  expect(operations.spawn).not.toHaveBeenCalled();
});
test.each([{ exitCode: 1, error: null }, { exitCode: 0, error: "timeout" }])("process health failure refuses emitted text", async ({ exitCode, error }) => {
  const operations = { ...createOnboardingProcessFixture(), spawn: mock().mockReturnValue({ exitCode, error, stderr: "", stdout: "{}" }) };
  expect(await createOnboardingPreparer({ operations }).prepare(onboardingRequest)).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "onboarding-source", detail: "onboarding process unavailable or reported diagnostics" }] });
  expect(operations.prose).not.toHaveBeenCalled();
});
test.each([
  { basis: { source: { kind: "core", id: "other" }, pin: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" }, context: onboardingRequest.context },
  { basis: { source: { kind: "plugin", id: "example" }, pin: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" }, context: onboardingRequest.context },
  { basis: { source: { kind: "core", id: "framework" }, pin: "short" }, context: onboardingRequest.context },
  { basis: onboardingRequest.basis, context: { ...onboardingRequest.context, invocation: "aidlc" } },
  { basis: onboardingRequest.basis, context: { ...onboardingRequest.context, rulesSubdir: "steering" } },
] as const)("unsupported source or native delivery refuses before process", async ({ basis, context }) => {
  const operations = createOnboardingProcessFixture();
  expect(await createOnboardingPreparer({ operations }).prepare({ ...onboardingRequest, basis, context })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "onboarding-source", detail: "onboarding qualifies a pinned framework source with the Claude Bun-copy binding and declared rules directory" }] });
  expect(operations.spawn).not.toHaveBeenCalled();
});
test("malformed successful wire reply is refused before prose", async () => {
  const operations = { ...createOnboardingProcessFixture(), spawn: mock().mockReturnValue({ exitCode: 0, error: null, stderr: "", stdout: '{"status":"ok","text":17,"inputs":[]}' }) };
  expect(await createOnboardingPreparer({ operations }).prepare(onboardingRequest)).toEqual({ status: "invalid", findings: [{ code: "invalid-input", subject: "onboarding-source", detail: "onboarding process must return native text and SHA-256 input witnesses or explicit unavailability" }] });
  expect(operations.prose).not.toHaveBeenCalled();
});
test("refuses incomplete source witnesses rather than accepting assembled text alone", async () => {
  expect(await createOnboardingPreparer({ operations: createOnboardingProcessFixture({ inputs: [] }) }).prepare(onboardingRequest)).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "onboarding-source", detail: "onboarding must witness every declared template, fill, manifest and rendering module exactly once" }] });
});
test("propagates the prose refusal without inventing option-letter values", async () => {
  expect(await createOnboardingPreparer({ operations: { ...createOnboardingProcessFixture(), prose: mock().mockReturnValue({ status: "invalid", findings: [{ code: "unresolved-token", subject: "core/templates/onboarding.md", detail: "{{OPTION_LETTERS}} at line 1" }] }) } }).prepare(onboardingRequest)).toEqual({ status: "invalid", findings: [{ code: "unresolved-token", subject: "core/templates/onboarding.md", detail: "{{OPTION_LETTERS}} at line 1" }] });
});
test("refuses unknown residual template markers", async () => {
  expect(await createOnboardingPreparer({ operations: createOnboardingProcessFixture({ rendered: "{{UNKNOWN}}" }) }).prepare(onboardingRequest)).toEqual({ status: "invalid", findings: [{ code: "invalid-input", subject: "onboarding-source", detail: "onboarding contains an unsupported authored template marker" }] });
});
test("refuses a different harness before native execution", async () => {
  const operations = createOnboardingProcessFixture();
  expect(await createOnboardingPreparer({ operations }).prepare({ ...onboardingRequest, context: { ...onboardingRequest.context, harness: "cursor", directory: ".cursor" } })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "onboarding-source", detail: "onboarding qualifies a pinned framework source with the Claude Bun-copy binding and declared rules directory" }] });
  expect(operations.spawn).not.toHaveBeenCalled();
});
test("native unavailability remains an explicit failure", async () => {
  const operations = { ...createOnboardingProcessFixture(), spawn: mock().mockReturnValue({ exitCode: 0, error: null, stderr: "", stdout: '{"status":"unavailable","detail":"onboarding source changed during preparation"}' }) };
  expect(await createOnboardingPreparer({ operations }).prepare(onboardingRequest)).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "onboarding-source", detail: "onboarding source changed during preparation" }] });
});
test("stderr prevents accepting otherwise successful native text", async () => {
  const operations = { ...createOnboardingProcessFixture(), spawn: mock().mockReturnValue({ exitCode: 0, error: null, stderr: "warning", stdout: "{}" }) };
  expect(await createOnboardingPreparer({ operations }).prepare(onboardingRequest)).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "onboarding-source", detail: "onboarding process unavailable or reported diagnostics" }] });
});
test("non-JSON output is an explicit admission failure", async () => {
  const operations = { ...createOnboardingProcessFixture(), spawn: mock().mockReturnValue({ exitCode: 0, error: null, stderr: "", stdout: "unexpected" }) };
  expect(await createOnboardingPreparer({ operations }).prepare(onboardingRequest)).toEqual({ status: "invalid", findings: [{ code: "invalid-input", subject: "onboarding-source", detail: "onboarding process must return one JSON response" }] });
});
