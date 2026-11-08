// covers: file:harness/codex/settings.ts, file:scripts/native-runtime-text.ts
import { expect, mock, test } from "bun:test";
import { prepareClaudeNativeRuntimeText, prepareNativeRuntimeText } from "../../scripts/native-runtime-text.ts";
import { createSourceHarnessSettingsPreparer } from "../../scripts/projection/src/adapters/source-harness-settings.ts";
import { createSourceRuntimeModulePreparer } from "../../scripts/projection/src/adapters/source-runtime-modules.ts";
import "../../harness/codex/settings.test.ts";
import "../../harness/codex/hook-plan.test.ts";
import "../../harness/codex/trust-path.test.ts";
import "../../harness/codex/source-settings.test.ts";
import "../../harness/codex/trust-cli.test.ts";
import "../harness/source-module-fixture.test.ts";

test("Codex native policy does not apply Claude statusline substitutions", () => {
  const source = "bun .claude/hooks/aidlc-statusline.ts and bun .codex/tools/aidlc.ts status";
  expect(prepareNativeRuntimeText(source, ".codex")).toBe("bun .claude/hooks/aidlc-statusline.ts and aidlc engine status");
  expect(prepareNativeRuntimeText(source, ".claude")).toBe(prepareClaudeNativeRuntimeText(source));
  expect(() => prepareNativeRuntimeText(source, ".unknown")).toThrow();
  expect(prepareNativeRuntimeText("bun .codex/hooks/aidlc-codex-adapter.ts session-start", ".codex")).toBe("aidlc engine adapter codex session-start");
});

test("Codex settings refuse missing shared onboarding before spawning", async () => {
  const spawn = mock(() => ({ exitCode: 0, stderr: "", stdout: "unexpected spawn", error: null }));
  const prepared = await createSourceHarnessSettingsPreparer({ operations: { spawn, environment: () => ({}), paths: () => ({ sourceRoot: "/source", root: "/work" }) } }).prepare({ sourceRoot: "/source", root: "/work", basis: { source: { kind: "core", id: "framework" }, pin: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" }, binding: { harness: "codex", directory: ".codex" }, invocation: "aidlc", mode: 420, files: [".codex/tools/aidlc.ts"] });
  expect(prepared.status).toBe("invalid");
  expect(spawn).not.toHaveBeenCalled();
});

test("Codex runtime adapter witness is mandatory and its source hash is retained", async () => {
  const paths = ["scripts/runtime-source-selection.ts", "scripts/projection/src/adapters/qualified-delivery-policy.ts", "scripts/projection-text.ts", "scripts/version-module.ts", "core/tools/aidlc-command.ts", "core/tools/aidlc-version.ts", "core/tools/aidlc-channel.ts", "scripts/native-runtime-text.ts", "scripts/native-command-context.ts", "scripts/native-command-text.ts", "core/tools/aidlc-routes.ts", "harness/codex/manifest.ts", "harness/codex/hooks/aidlc-codex-adapter.ts"];
  const request = { sourceRoot: "/source", root: "/work", basis: { source: { kind: "core", id: "framework" }, pin: "a".repeat(40) }, binding: { harness: "codex", directory: ".codex" }, invocation: "aidlc", mode: 420 } as const;
  const prepare = (adapterHash: string | null) => createSourceRuntimeModulePreparer({ operations: { environment: () => ({}), paths: () => ({ sourceRoot: "/source", root: "/work" }), spawn: () => ({ exitCode: 0, stderr: "", error: null, stdout: JSON.stringify({ status: "ok", modules: ["hooks/aidlc-codex-adapter.ts"], files: [{ file: "hooks/aidlc-codex-adapter.ts", content: "prepared adapter" }], inputs: paths.filter(path => adapterHash !== null || !path.endsWith("aidlc-codex-adapter.ts")).map(path => ({ path, sha256: path.endsWith("aidlc-codex-adapter.ts") ? adapterHash : "b".repeat(64) })) }) }) } }).prepare(request);
  expect((await prepare(null)).status).toBe("invalid");
  for (const hash of ["c".repeat(64), "d".repeat(64)]) {
    const result = await prepare(hash);
    expect(result.status).toBe("ok");
    if (result.status === "ok") expect(result.value.preparation.inputs.find(input => input.path.endsWith("aidlc-codex-adapter.ts"))!.sha256).toBe(hash);
  }
});
