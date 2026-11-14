import type { HostDataRenderer } from "../../../projection/application/ports/host-surface.ts";
import { KIRO_IDE_HOST_DATA } from "../host-data.ts";
import { kiroIdePermissionLines } from "./agent-renderer.ts";
import { kiroIdeDelegateShellPolicy } from "./delegate-shell-deny.ts";

export const kiroIdeHostData: HostDataRenderer = ({ delegateShellFacts }) => {
  const policy = kiroIdeDelegateShellPolicy({ facts: delegateShellFacts, directory: ".kiro" });
  const shellDeny = policy.shellDeny("plugin-agent");
  const permissions = { ...policy, shellDeny: () => shellDeny };
  return { ...KIRO_IDE_HOST_DATA, pluginAgentFrontmatter: {
    copy: kiroIdePermissionLines({ policy: permissions, channel: "copy" })("plugin-agent"),
    native: kiroIdePermissionLines({ policy: permissions, channel: "native" })("plugin-agent"),
  } };
};
