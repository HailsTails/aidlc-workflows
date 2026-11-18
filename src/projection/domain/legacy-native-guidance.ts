export const LEGACY_NATIVE_GUIDANCE = {
  runtime: "- **Runtime**: Framework commands run through `aidlc`; keep that command and its " +
    "runtime available. If `aidlc` is not found in this tool, give the person both " +
    "fixes in one line, then end your turn without installing anything or working " +
    "around it: if AI-DLC was installed while this tool was open, quit the tool fully " +
    "and reopen it (a new tab or reloaded window is not enough); otherwise the " +
    "installer's bin folder is not on PATH (an install with `-NoModifyPath`, or a " +
    "Unix install whose PATH line was not applied), so add the folder the installer " +
    "printed to PATH, or rerun the installer without `-NoModifyPath`, then reopen the " +
    "tool.",
  hooks: "- **Hook permissions**: Framework hooks run through the self-contained `aidlc` " +
    "binary. No separate script runtime or executable bits are required.",
  tools: "TypeScript sources invoked through the self-contained `aidlc` runtime",
  cwd: "**CWD drift warning**: Native release commands resolve `aidlc` from `PATH`, so " +
    "changing directories does not change the engine path. Keep project-relative file " +
    "arguments anchored to the project root, or run `cd` commands in subshells: `(cd " +
    "subdir && npm install)`.",
} as const;
