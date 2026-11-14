import { accepted, refused } from "../../../kernel/result.ts";
import { projectPath } from "../../../kernel/values.ts";
import type { Harness, Rendering } from "../../../projection/application/ports/harness.ts";
import type { SettingsRenderingInputs } from "../../../projection/application/ports/settings.ts";

export const KIRO_HOOK_REGISTRATION_INPUTS = [
  "hooks/aidlc-record-human-turn.kiro.hook",
  "hooks/aidlc-plan-approval-guard.kiro.hook",
] as const;

const renderHook = (inputs: SettingsRenderingInputs, source: string): Rendering => {
  const file = inputs.files.find((candidate) => candidate.source === source);
  if (!file) return refused({ kind: "render-failed", concept: "hook-registration",
    name: source, reason: "The authored Kiro hook registration was not captured." });
  const prepared = inputs.prepare(file);
  if (!prepared.ok) return prepared;
  const path = projectPath(`.kiro/${source}`);
  return path.ok ? accepted([{
    path: path.value, content: prepared.value.content, mode: "regular",
    origin: { kind: "harness-authored", source: file.source },
  }]) : refused({ kind: "render-failed", concept: "hook-registration", name: source,
    reason: "The Kiro hook destination must be project-relative." });
};

export const createKiroHookRegistrations = (
  inputs: SettingsRenderingInputs,
): Harness["renderHookRegistrations"] => () => {
  const rendered = KIRO_HOOK_REGISTRATION_INPUTS.map((source) => renderHook(inputs, source));
  const failed = rendered.find((reading) => !reading.ok);
  return failed && !failed.ok ? failed
    : accepted(rendered.flatMap((reading) => reading.ok ? reading.value : []));
};
