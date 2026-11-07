import { TRUSTED_COMMAND_PREFIX, trustedCommand } from "../core/tools/aidlc-command.ts";
import { createNativeCommandContext } from "./native-command-context.ts";
import { projectNativeCommandText } from "./native-command-text.ts";

// These source bindings are prepared before artifact ownership is issued.
export function prepareClaudeNativeRuntimeText(source: string): string {
  const dispatcher = source.replace(/\bbun\s+\\"\$CLAUDE_PROJECT_DIR\/\.claude\/tools\/aidlc\.ts\\"/gi, "aidlc");
  const hooks = dispatcher.replace(/\bbun\s+(?:\\"|"?)(?:\$\{?CLAUDE_PROJECT_DIR\}?\/)?\.claude\/hooks\/aidlc-([a-z0-9-]+)\.ts(?:\\"|"?)/gi,
    (_match, hook: string) => hook === "statusline" ? trustedCommand("statusline") : trustedCommand(`hook ${hook}`));
  return projectNativeCommandText({ source: hooks, context: createNativeCommandContext({ harnessDir: ".claude" }) });
}

function nativePermissionsLine(exactReads: boolean): string {
  return exactReads
    ? `- **Permissions**: the \`aidlc\` agent pre-approves only the native \`${TRUSTED_COMMAND_PREFIX}\` command prefix, the read-only \`aidlc doctor\`, \`status\`, \`version\` and \`config <section> --show\` (with or without \`--json\`) and \`--help\` forms, turning a check back on (\`aidlc config flags --clear-bypass <switch> --yes\`), and its listed read-only tools; everything else prompts, including any other \`config\` change.`
    : `- **Permissions**: the \`aidlc\` agent pre-approves only the native \`${TRUSTED_COMMAND_PREFIX}\` command prefix and its listed read-only tools; everything else prompts.`;
}

export function prepareNativeOnboardingText(value: string, exactReads = false): string {
  return value
    .replace(
      /^- \*\*bun\*\*:.*$/gm,
      "- **Runtime**: Framework commands run through `aidlc`; keep that command and its runtime available. If `aidlc` is not found in this tool, give the person both fixes in one line, then end your turn without installing anything or working around it: if AI-DLC was installed while this tool was open, quit the tool fully and reopen it (a new tab or reloaded window is not enough); otherwise the installer's bin folder is not on PATH (an install with `-NoModifyPath`, or a Unix install whose PATH line was not applied), so add the folder the installer printed to PATH, or rerun the installer without `-NoModifyPath`, then reopen the tool.",
    )
    .replace(
      /^- \*\*Hook permissions\*\*:.*$/gm,
      "- **Hook permissions**: Framework hooks run through the self-contained `aidlc` binary. No separate script runtime or executable bits are required.",
    )
    .replace(/^- \*\*Permissions\*\*:.*$/gm, nativePermissionsLine(exactReads))
    .replace(
      /TypeScript, run via bun/g,
      "TypeScript sources invoked through the self-contained `aidlc` runtime",
    )
    .replace(
      /pre-approves ONLY `bun \.kiro\/tools\/\*` shell commands/g,
      `pre-approves only \`${TRUSTED_COMMAND_PREFIX}\` shell commands`,
    )
    .replace(
      /^\*\*CWD drift warning\*\*: If a stage runs `cd` in Bash.*$/gm,
      "**CWD drift warning**: Native release commands resolve `aidlc` from `PATH`, so changing directories does not change the engine path. Keep project-relative file arguments anchored to the project root, or run `cd` commands in subshells: `(cd subdir && npm install)`.",
    );
}

export function prepareNativeRuntimeText(source: string, harnessDir: string, adapter = harnessDir.slice(1)): string {
  if (harnessDir === ".claude") return prepareClaudeNativeRuntimeText(source);
  if (harnessDir === ".cursor") return projectNativeCommandText({ source, context: createNativeCommandContext({ harnessDir }) })
    .replace(/\bbun\s+"?\.cursor\/hooks\/aidlc-cursor-adapter\.ts"?/gi, trustedCommand("adapter cursor"));
  if (harnessDir === ".kiro") return projectNativeCommandText({ source, context: createNativeCommandContext({ harnessDir }) })
    .replace(/\bbun\s+"?\.kiro\/hooks\/aidlc-kiro-adapter\.ts"?/gi, trustedCommand(`adapter ${adapter}`));
  if (harnessDir === ".aidlc" && adapter === "copilot") return projectNativeCommandText({ source, context: createNativeCommandContext({ harnessDir }) })
    .replace(/\bbun\s+"?\.aidlc\/hooks\/aidlc-copilot-adapter\.ts"?/gi, trustedCommand("adapter copilot"));
  if (harnessDir !== ".codex") throw new Error("Unsupported native runtime harness");
  return projectNativeCommandText({ source, context: createNativeCommandContext({ harnessDir }) })
    .replace(/\bbun\s+"?\.codex\/hooks\/aidlc-codex-adapter\.ts"?/gi, trustedCommand("adapter codex"));
}
