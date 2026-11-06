import { expect, mock, test } from "bun:test";
import { projectDeclaredPluginRuntime, type PluginRuntimeProjectionPort } from "./plugin-runtime-projection.ts";

test("maps a nested Kiro plugin to its source inventory and publishes into its own root", async () => {
  const prepare = mock<PluginRuntimeProjectionPort["prepare"]>().mockResolvedValue({ kind: "prepared", artifacts: [] });
  const publish = mock<PluginRuntimeProjectionPort["publish"]>().mockResolvedValue({ kind: "published", files: [] });
  expect(await projectDeclaredPluginRuntime({ projectRoot: "/repo", pluginRoot: "/repo/plugins/example", port: { prepare, publish },
    projection: { harness: "kiro", outDir: "/out", pluginRoot: "/out/aidlc-plugins/example", files: ["aidlc-plugins/example/tools/run.ts", "aidlc-plugins/example/hooks/guard.ts", "tools/run.ts"], commandScripts: ["tools/run.ts"] },
  })).toEqual({ kind: "published", files: [] });
  expect(prepare.mock.calls).toEqual([[{ pluginRoot: "/repo/plugins/example", files: ["tools/run.ts"], closedModules: ["tools/run.ts"] }]]);
  expect(publish.mock.calls).toEqual([[{ outDir: "/out/aidlc-plugins/example", prepared: { kind: "prepared", artifacts: [] } }]]);
});

test("refuses a command claimed only outside the nested plugin without invoking runtime ports", async () => {
  const prepare = mock<PluginRuntimeProjectionPort["prepare"]>().mockResolvedValue({ kind: "prepared", artifacts: [] });
  const publish = mock<PluginRuntimeProjectionPort["publish"]>().mockResolvedValue({ kind: "published", files: [] });
  expect(await projectDeclaredPluginRuntime({ projectRoot: "/repo", pluginRoot: "/repo/plugins/example", port: { prepare, publish },
    projection: { harness: "kiro", outDir: "/out", pluginRoot: "/out/aidlc-plugins/example", files: ["tools/run.ts"], commandScripts: ["tools/run.ts"] },
  })).toEqual({ kind: "refused", message: "declared plugin command was not projected: tools/run.ts" });
  expect(prepare).not.toHaveBeenCalled();
  expect(publish).not.toHaveBeenCalled();
});

test("preserves preparation refusal without calling publication", async () => {
  const prepare = mock<PluginRuntimeProjectionPort["prepare"]>().mockResolvedValue({ kind: "refused", message: "fixture refusal" });
  const publish = mock<PluginRuntimeProjectionPort["publish"]>().mockResolvedValue({ kind: "published", files: [] });
  expect(await projectDeclaredPluginRuntime({ projectRoot: "/repo", pluginRoot: "/repo/plugins/example", port: { prepare, publish },
    projection: { harness: "claude", outDir: "/out", pluginRoot: "/out", files: ["tools/run.ts"], commandScripts: ["tools/run.ts"] },
  })).toEqual({ kind: "refused", message: "fixture refusal" });
  expect(publish).not.toHaveBeenCalled();
});

test("converts an unexpected provider rejection to bounded failure data", async () => {
  const prepare = mock<PluginRuntimeProjectionPort["prepare"]>().mockRejectedValue("sensitive fixture failure");
  const publish = mock<PluginRuntimeProjectionPort["publish"]>().mockResolvedValue({ kind: "published", files: [] });
  expect(await projectDeclaredPluginRuntime({ projectRoot: "/repo", pluginRoot: "/repo/plugins/example", port: { prepare, publish },
    projection: { harness: "claude", outDir: "/out", pluginRoot: "/out", files: ["tools/run.ts"], commandScripts: ["tools/run.ts"] },
  })).toEqual({ kind: "unavailable", error: { kind: "artifact-provider-failed", outDir: "/out", file: "", message: "Plugin runtime projection provider failed", writtenFiles: [] } });
  expect(publish).not.toHaveBeenCalled();
});

test("leaves non-Claude plugin runtime untouched when no command is declared", async () => {
  const prepare = mock<PluginRuntimeProjectionPort["prepare"]>().mockResolvedValue({ kind: "prepared", artifacts: [] });
  const publish = mock<PluginRuntimeProjectionPort["publish"]>().mockResolvedValue({ kind: "published", files: [] });
  expect(await projectDeclaredPluginRuntime({ projectRoot: "/repo", pluginRoot: "/repo/plugins/example", port: { prepare, publish },
    projection: { harness: "codex", outDir: "/out", pluginRoot: "/out", files: ["hooks/guard.ts", "tools/reader.ts"], commandScripts: [] },
  })).toEqual({ kind: "published", files: [] });
  expect(prepare).not.toHaveBeenCalled();
  expect(publish).not.toHaveBeenCalled();
});
