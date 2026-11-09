import type { HostDataRenderer } from "../../../projection/application/ports/host-surface.ts";
import { KIRO_IDE_HOST_DATA } from "../host-data.ts";
import { kiroIdePermissionLines } from "./agent-renderer.ts";

export const kiroIdeHostData: HostDataRenderer = ({ delegateShell }) => {
  const frontmatter = kiroIdePermissionLines(delegateShell)("plugin-agent");
  // The release's nativeReplacements converts these copy lines in M3.
  return { ...KIRO_IDE_HOST_DATA, pluginAgentFrontmatter: { copy: frontmatter, native: frontmatter } };
};
