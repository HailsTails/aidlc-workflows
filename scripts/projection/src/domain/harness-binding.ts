export type HarnessBinding =
  | { readonly harness: "claude"; readonly directory: ".claude" }
  | { readonly harness: "cursor"; readonly directory: ".cursor" }
  | { readonly harness: "codex"; readonly directory: ".codex" }
  | { readonly harness: "copilot"; readonly directory: ".aidlc" }
  | { readonly harness: "opencode"; readonly directory: ".aidlc" }
  | { readonly harness: "kiro"; readonly directory: ".kiro" }
  | { readonly harness: "kiro-ide"; readonly directory: ".kiro" };
export type Harness = HarnessBinding["harness"];
export const copyHarnessBinding = ({ binding }: { readonly binding: HarnessBinding }): HarnessBinding => {
  switch (binding.harness) {
    case "claude": return { harness: binding.harness, directory: binding.directory };
    case "cursor": return { harness: binding.harness, directory: binding.directory };
    case "codex": return { harness: binding.harness, directory: binding.directory };
    case "copilot": return { harness: binding.harness, directory: binding.directory };
    case "opencode": return { harness: binding.harness, directory: binding.directory };
    case "kiro": return { harness: binding.harness, directory: binding.directory };
    case "kiro-ide": return { harness: binding.harness, directory: binding.directory };
  }
};
