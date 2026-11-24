import { sharedKnowledgeSources } from "../../../workflow-definition/domain/knowledge.ts";
import type { HostDataRenderer } from "../../../projection/application/ports/host-surface.ts";
import { KIRO_IDE_HOST_DATA } from "../host-data.ts";
import { kiroIdePermissionLines, kiroIdePermissionPrompt } from "./agent-renderer.ts";
import { kiroIdeDelegateShellPolicy } from "./delegate-shell-deny.ts";

export const kiroIdeHostData: HostDataRenderer = ({ delegateShellFacts, sharedKnowledge }) => {
  const resources = sharedKnowledgeSources(sharedKnowledge).map((path) => `file://.kiro/${path}`);
  const policy = kiroIdeDelegateShellPolicy({ facts: delegateShellFacts, directory: ".kiro" });
  return { ...KIRO_IDE_HOST_DATA, pluginAgentFrontmatter: {
    copy: kiroIdePermissionLines({ resources, policy, channel: "copy" })("plugin-agent"),
    native: kiroIdePermissionPrompt({ resources, policy, channel: "native", agent: "plugin-agent" }),
  } };
};
