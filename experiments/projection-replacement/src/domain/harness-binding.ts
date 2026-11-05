export type HarnessBinding =
  | { readonly harness: "claude"; readonly directory: ".claude" }
  | { readonly harness: "cursor"; readonly directory: ".cursor" }
  | { readonly harness: "codex"; readonly directory: ".codex" }
  | { readonly harness: "copilot"; readonly directory: ".aidlc" }
  | { readonly harness: "opencode"; readonly directory: ".aidlc" }
  | { readonly harness: "kiro"; readonly directory: ".kiro" }
  | { readonly harness: "kiro-ide"; readonly directory: ".kiro" };
export type Harness = HarnessBinding["harness"];
