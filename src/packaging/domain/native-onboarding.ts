import type { NativeRelease } from "./payload.ts";

type NativeOnboardingRequest = {
  readonly text: string;
  readonly permissionsLine: NativeRelease["permissionsLine"];
  readonly prefix: string;
};

function nativePermissionsLine({ permissionsLine, prefix }: NativeOnboardingRequest): string {
  return permissionsLine === "exact-reads"
    ? `- **Permissions**: the \`aidlc\` agent pre-approves only the native \`${prefix}\` command prefix, the read-only \`aidlc doctor\`, \`status\`, \`version\` and \`config <section> --show\` (with or without \`--json\`) and \`--help\` forms, turning a check back on (\`aidlc config flags --clear-bypass <switch> --yes\`), and its listed read-only tools; everything else prompts, including any other \`config\` change.`
    : `- **Permissions**: the \`aidlc\` agent pre-approves only the native \`${prefix}\` command prefix and its listed read-only tools; everything else prompts.`;
}

export function nativeOnboardingText(request: NativeOnboardingRequest): string {
  return request.text
    .replace(
      /^- \*\*bun\*\*:.*$/gm,
      "- **Runtime**: Framework commands run through `aidlc`; keep that command and its runtime available. If `aidlc` is not found in this tool, give the person both fixes in one line, then end your turn without installing anything or working around it: if AI-DLC was installed while this tool was open, quit the tool fully and reopen it (a new tab or reloaded window is not enough); otherwise the installer's bin folder is not on PATH (an install with `-NoModifyPath`, or a Unix install whose PATH line was not applied), so add the folder the installer printed to PATH, or rerun the installer without `-NoModifyPath`, then reopen the tool.",
    )
    .replace(
      /^- \*\*Hook permissions\*\*:.*$/gm,
      "- **Hook permissions**: Framework hooks run through the self-contained `aidlc` binary. No separate script runtime or executable bits are required.",
    )
    .replace(/^- \*\*Permissions\*\*:.*$/gm, nativePermissionsLine(request))
    .replace(
      /TypeScript, run via bun/g,
      "TypeScript sources invoked through the self-contained `aidlc` runtime",
    )
    .replace(
      /^\*\*CWD drift warning\*\*: If a stage runs `cd` in Bash.*$/gm,
      "**CWD drift warning**: Native release commands resolve `aidlc` from `PATH`, so changing directories does not change the engine path. Keep project-relative file arguments anchored to the project root, or run `cd` commands in subshells: `(cd subdir && npm install)`.",
    );
}
