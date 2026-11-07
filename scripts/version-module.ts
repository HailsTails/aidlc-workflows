export type VersionModuleTextPreparation =
  | Readonly<{ kind: "prepared"; content: string }>
  | Readonly<{ kind: "refused"; message: string }>;

const VERSION_ASSIGNMENT = /^export const AIDLC_VERSION = "[^"]+";$/m;

export function prepareVersionModuleText({ source, buildVersion }: Readonly<{ source: string; buildVersion: string }>): VersionModuleTextPreparation {
  const matches = source.match(new RegExp(VERSION_ASSIGNMENT.source, "gm")) ?? [];
  if (matches.length !== 1) return { kind: "refused", message: `aidlc-version.ts must declare exactly one AIDLC_VERSION assignment, found ${matches.length}` };
  return { kind: "prepared", content: source.replace(VERSION_ASSIGNMENT, `export const AIDLC_VERSION = "${buildVersion}";`) };
}
