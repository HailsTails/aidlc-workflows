import type { NativePermissionPolicy } from "../domain/onboarding-context.ts";

export const PERMISSION_POLICIES_FIXTURE = {
  "exact-reads": { kind: "host-line", line: (prefix: string): string => `- **Permissions**: the \`aidlc\` agent pre-approves only the native \`${prefix}\` command prefix, the read-only \`aidlc doctor\`, \`status\`, \`version\` and \`config <section> --show\` (with or without \`--json\`) and \`--help\` forms, turning a check back on (\`aidlc config flags --clear-bypass <switch> --yes\`), and its listed read-only tools; everything else prompts, including any other \`config\` change.` },
  "prefix-only": { kind: "host-line", line: (prefix: string): string => `- **Permissions**: the \`aidlc\` agent pre-approves only the native \`${prefix}\` command prefix and its listed read-only tools; everything else prompts.` },
} satisfies Readonly<Record<string, NativePermissionPolicy>>;
