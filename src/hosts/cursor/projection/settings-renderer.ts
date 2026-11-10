import { z } from "zod";
import { createCursorHookRegistrations } from "./hook-registration-renderer.ts";
import type { FileContent } from "../../../kernel/file-content.ts";
import { accepted, refused, type Result } from "../../../kernel/result.ts";
import { projectPath } from "../../../kernel/values.ts";
import type {
  HostSettingsRenderer,
  SettingsRenderingInputs,
} from "../../../projection/application/ports/settings.ts";
import type { Rendering } from "../../../projection/application/ports/harness.ts";
import type { ProjectionRefusal } from "../../../projection/domain/projection.ts";

export const CURSOR_SETTINGS_INPUTS = ["cli.json", "hooks.json"] as const;

const settingsRefusal = (reason: string): ProjectionRefusal => ({
  kind: "render-failed", concept: "settings", name: "cli.json", reason,
});
const objectSchema = z.record(z.string(), z.unknown());
type SettingsDocument = {
  readonly fields: Record<string, unknown>;
  readonly permissions: Record<string, unknown>;
  readonly allow: readonly unknown[];
};
const decodeSettings = (content: FileContent): Result<SettingsDocument, ProjectionRefusal> => {
  const text = content.kind === "text" ? content.text
    : new TextDecoder("utf-8", { ignoreBOM: true }).decode(content.bytes);
  try {
    const fields = objectSchema.safeParse(JSON.parse(text));
    if (!fields.success) return refused(settingsRefusal("The captured settings must be a JSON object."));
    const permissions = objectSchema.safeParse(fields.data["permissions"]);
    if (!permissions.success || !Array.isArray(permissions.data["allow"])) {
      return refused(settingsRefusal("cli.json has no Shell(bun:<dir>/tools/aidlc-*) entry to expand"));
    }
    const allow: readonly unknown[] = permissions.data["allow"];
    return accepted({ fields: fields.data, permissions: permissions.data, allow });
  } catch {
    return refused(settingsRefusal("The captured settings are not valid JSON."));
  }
};

const renderSettings = (inputs: SettingsRenderingInputs): Rendering => {
  const file = inputs.files.find((candidate) => candidate.source === "cli.json");
  if (!file) return refused(settingsRefusal("The authored settings were not captured."));
  const prepared = inputs.prepare(file);
  if (!prepared.ok) return prepared;
  const decoded = decodeSettings(prepared.value.content);
  if (!decoded.ok) return decoded;
  const { fields, permissions, allow } = decoded.value;
  const directory = inputs.tokens["HARNESS_DIR"];
  const glob = `Shell(bun:${directory}/tools/aidlc-*)`;
  if (!allow.includes(glob)) {
    return refused(settingsRefusal("cli.json has no Shell(bun:<dir>/tools/aidlc-*) entry to expand"));
  }
  const tools = `${directory}/tools`;
  const expanded = allow.flatMap((entry) => entry === glob ? [
    ...inputs.allows.dispatcherCommands.map((command) => `Shell(bun:${tools}/aidlc.ts ${command})`),
    ...inputs.allows.toolScripts.flatMap((script) => [`Shell(bun:${tools}/${script})`, `Shell(bun:${tools}/${script} *)`]),
  ] : [entry]);
  const path = projectPath(".cursor/cli.json");
  if (!path.ok) return refused(settingsRefusal("The settings destination must be project-relative."));
  return accepted([{ path: path.value, content: { kind: "text",
    text: `${JSON.stringify({ ...fields, permissions: { ...permissions, allow: expanded } }, null, 2)}\n` },
    mode: "regular", availability: "always",
    origin: { kind: "rendered", concept: "settings", name: "cli.json" } }]);
};

export const createCursorSettingsRenderer: HostSettingsRenderer = (inputs) => ({
  renderSettings: () => renderSettings(inputs),
  renderHookRegistrations: createCursorHookRegistrations(inputs),
});
