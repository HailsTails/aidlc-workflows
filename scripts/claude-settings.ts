import { z } from "zod";

export type ClaudeSettingsPreparation = { readonly kind: "prepared"; readonly content: string } | { readonly kind: "refused"; readonly message: string };
export type ClaudeSettingsRequest = { readonly text: string; readonly dispatcherCommands: readonly string[]; readonly toolScripts: readonly string[] };
const entrySchema = z.tuple([z.string(), z.unknown()]);
const settingsSchema = z.strictObject({ settingsEntries: z.array(entrySchema), permissionEntries: z.array(entrySchema), allow: z.array(z.unknown()) });
type AdmittedSettings = z.infer<typeof settingsSchema>;
type SettingsAdmission = { readonly kind: "admitted"; readonly settings: AdmittedSettings; readonly glob: string };
const noGlob = (): Extract<ClaudeSettingsPreparation, { readonly kind: "refused" }> => ({ kind: "refused", message: "[claude] settings.json has no Bash(bun <dir>/tools/aidlc-*) entry to expand" });

function recordEntries({ candidate }: { readonly candidate: unknown }): readonly (readonly [string, unknown])[] | null {
  return typeof candidate === "object" && candidate !== null && !Array.isArray(candidate) ? Object.entries(candidate) : null;
}

function settingsObservation({ candidate }: { readonly candidate: unknown }) {
  const settingsEntries = recordEntries({ candidate });
  const permissionEntries = recordEntries({ candidate: settingsEntries?.find(([key]) => key === "permissions")?.[1] });
  return { settingsEntries, permissionEntries, allow: permissionEntries?.find(([key]) => key === "allow")?.[1] };
}

function readSettings({ text }: { readonly text: string }): SettingsAdmission | Extract<ClaudeSettingsPreparation, { readonly kind: "refused" }> {
  let candidate: unknown;
  try { candidate = JSON.parse(text); }
  catch { return { kind: "refused", message: "[claude] settings.json must contain valid JSON" }; }
  const parsed = settingsSchema.safeParse(settingsObservation({ candidate }));
  if (!parsed.success) return noGlob();
  const glob = parsed.data.allow.find((entry): entry is string => typeof entry === "string" && /^Bash\(bun \S+\/tools\/aidlc-\*\)$/.test(entry));
  if (glob === undefined) return noGlob();
  return { kind: "admitted", settings: parsed.data, glob };
}

function expandedPermissions({ glob, dispatcherCommands, toolScripts }: { readonly glob: string } & Pick<ClaudeSettingsRequest, "dispatcherCommands" | "toolScripts">): readonly string[] {
  const toolsDir = glob.slice("Bash(bun ".length, -"/aidlc-*)".length);
  const tool = ({ script }: { readonly script: string }) => `Bash(bun ${toolsDir}/${script}`;
  return [...dispatcherCommands.map((command) => `${tool({ script: "aidlc.ts" })} ${command})`), ...toolScripts.flatMap((script) => [`${tool({ script })})`, `${tool({ script })} *)`])];
}

function expandedSettings({ settings, glob, permissions }: { readonly settings: AdmittedSettings; readonly glob: string; readonly permissions: readonly string[] }): Readonly<Record<string, unknown>> {
  const allow = settings.allow.flatMap((entry) => entry === glob ? permissions : [entry]);
  const permissionRecord = Object.fromEntries(settings.permissionEntries.map(([key, content]) => [key, key === "allow" ? allow : content]));
  return Object.fromEntries(settings.settingsEntries.map(([key, content]) => [key, key === "permissions" ? permissionRecord : content]));
}

function preparedSettings({ admitted, request }: { readonly admitted: SettingsAdmission; readonly request: ClaudeSettingsRequest }): ClaudeSettingsPreparation {
  const permissions = expandedPermissions({ glob: admitted.glob, dispatcherCommands: request.dispatcherCommands, toolScripts: request.toolScripts });
  return { kind: "prepared", content: `${JSON.stringify(expandedSettings({ settings: admitted.settings, glob: admitted.glob, permissions }), null, 2)}\n` };
}

export function prepareClaudeSettingsText(request: ClaudeSettingsRequest): ClaudeSettingsPreparation {
  const admitted = readSettings(request);
  if (admitted.kind === "refused") return admitted;
  return preparedSettings({ admitted, request });
}
