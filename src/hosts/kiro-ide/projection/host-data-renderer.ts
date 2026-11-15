import type { HostDataRenderer } from "../../../projection/application/ports/host-surface.ts";
import { KIRO_IDE_HOST_DATA } from "../host-data.ts";
import { kiroIdePermissionLines, kiroIdePermissionPrompt } from "./agent-renderer.ts";
import { kiroIdeDelegateShellPolicy } from "./delegate-shell-deny.ts";

export const kiroIdeHostData: HostDataRenderer = ({ delegateShellFacts }) => {
  const policy = kiroIdeDelegateShellPolicy({ facts: delegateShellFacts, directory: ".kiro" });
  return { ...KIRO_IDE_HOST_DATA, pluginAgentFrontmatter: {
    copy: kiroIdePermissionLines({ policy, channel: "copy" })("plugin-agent"),
    native: kiroIdePermissionPrompt({ policy, channel: "native", agent: "plugin-agent" }),
  } };
};
