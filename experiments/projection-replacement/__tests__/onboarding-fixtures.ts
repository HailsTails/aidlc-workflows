import { mock } from "bun:test";
import type { PreparedHarnessDocuments } from "../src/domain/harness-document.ts";
import type { ProjectionSet } from "../src/application/projection-set.ts";
import type { OnboardingOperations } from "../src/adapters/onboarding-source.ts";
import { entryBasis, entryContext } from "./harness-document-fixtures.ts";
export const onboardingRequest = { sourceRoot: "authored-source", workRoot: "prepared-workspace", basis: entryBasis, context: entryContext };
export const onboardingInputs = [
  { path: "harness/claude/manifest.ts", sha256: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" },
  { path: "harness/claude/onboarding.fills.ts", sha256: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" },
  { path: "core/templates/onboarding.md", sha256: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" },
  { path: "core/templates/onboarding-harness.md", sha256: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" },
  { path: "scripts/onboarding.ts", sha256: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" },
  { path: "scripts/onboarding-projection.ts", sha256: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" },
];
export const onboardingAuthoring = [
  { ...entryBasis, path: "harness/claude/manifest.ts" }, { ...entryBasis, path: "harness/claude/onboarding.fills.ts" },
  { ...entryBasis, path: "core/templates/onboarding-harness.md" }, { ...entryBasis, path: "scripts/onboarding.ts" }, { ...entryBasis, path: "scripts/onboarding-projection.ts" },
];
export const onboardingDocument = { authored: { role: "onboarding", origin: { ...entryBasis, path: "core/templates/onboarding.md" }, text: "Run {{INVOKE}} at {{HARNESS_DIR}}/rules/aidlc.md\n" }, binding: { harness: "claude", directory: ".claude" }, text: "Run bun .claude/tools/aidlc.ts at .claude/rules/aidlc.md\n", authoring: onboardingAuthoring } as const;
export const preparedOnboarding: PreparedHarnessDocuments = { documents: [onboardingDocument], inputs: onboardingInputs };
export const onboardingSet: ProjectionSet = { scope: "selected-surfaces", target: { harness: "claude", directory: ".claude" }, units: [{ kind: "harness-document", key: "harness-onboarding", projection: { origin: onboardingDocument.authored.origin, harness: "claude", authoring: onboardingAuthoring, resources: [{ kind: "file", path: ".claude/CLAUDE.md", body: onboardingDocument.text }] } }], resources: [{ kind: "file", path: ".claude/CLAUDE.md", body: onboardingDocument.text }] };
export const createOnboardingProcessFixture = ({ text = onboardingDocument.authored.text, inputs = onboardingInputs, rendered = onboardingDocument.text }: { readonly text?: string; readonly inputs?: typeof onboardingInputs; readonly rendered?: string } = {}): OnboardingOperations => ({ paths: mock().mockReturnValue({ root: "/source", workRoot: "/workspace" }), prose: mock().mockReturnValue({ status: "ok", value: rendered }), environment: mock().mockReturnValue(Object.fromEntries([["PATH", "tools"], ["SECRET", "excluded"], ["AIDLC_PROJECT_DIR", "unrelated"]])), spawn: mock().mockReturnValue({ exitCode: 0, error: null, stderr: "", stdout: JSON.stringify({ status: "ok", text, inputs }) }) });
export const createRevokedOnboardingProcess = (): OnboardingOperations => {
  const revoked = Proxy.revocable(createOnboardingProcessFixture().spawn, {});
  revoked.revoke();
  return { ...createOnboardingProcessFixture(), spawn: revoked.proxy };
};

export const onboardingExpectedEnvironment = Object.fromEntries([["PATH", "tools"], ["HOME", "/workspace/.onboarding-home"], ["USERPROFILE", "/workspace/.onboarding-home"], ["APPDATA", "/workspace/.onboarding-home"], ["LOCALAPPDATA", "/workspace/.onboarding-home"], ["TEMP", "/workspace/.onboarding-home"], ["TMP", "/workspace/.onboarding-home"], ["BUN_TMPDIR", "/workspace/.onboarding-home"], ["BUN_INSTALL", "/workspace/.onboarding-home/bun-install"], ["BUN_INSTALL_CACHE_DIR", "/workspace/.onboarding-home/bun-cache"], ["BUN_RUNTIME_TRANSPILER_CACHE_PATH", "0"], ["BUN_INSTALL_AUTO", "disable"]]);
