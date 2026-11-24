import { accepted, refused } from "../../../kernel/result.ts";
import { projectPath } from "../../../kernel/values.ts";
import type { Harness } from "../../../projection/application/ports/harness.ts";
import type { SettingsRenderingInputs } from "../../../projection/application/ports/settings.ts";
import { declareLegacyProducedFile } from "../../../projection/domain/legacy-native-source.ts";

export const createCursorHookRegistrations = (
  inputs: SettingsRenderingInputs,
): Harness["renderHookRegistrations"] => () => {
  const file = inputs.files.find((candidate) => candidate.source === "hooks.json");
  if (!file) return refused({ kind: "render-failed", concept: "hook-registration", name: "hooks.json",
    reason: "The authored Cursor hook registration was not captured." });
  const prepared = inputs.prepare(file);
  if (!prepared.ok) return prepared;
  const path = projectPath(".cursor/hooks.json");
  return path.ok ? accepted([declareLegacyProducedFile({ context: inputs.legacyNative, file: {
    path: path.value, content: prepared.value.content, mode: "regular",
    origin: { kind: "harness-authored", source: file.source },
  } })]) : refused({ kind: "render-failed", concept: "hook-registration", name: "hooks.json",
    reason: "The Cursor hook destination must be project-relative." });
};
