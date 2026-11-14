export { copyStartsWithout, harnessChoiceTextIsPlain, sha256Bytes, writtenRootIntegration }
  from "../../../core/tools/aidlc-distribution.ts";

import { copyChannelOmits } from "../../../core/tools/aidlc-distribution.ts";
import type { CopyRuntimeOmissions } from "../application/ports.ts";

export const createCopyRuntimeOmissions = (): CopyRuntimeOmissions => ({ omitted: (copyPayload) => {
  const omitted = copyChannelOmits({ rootIntegrations: copyPayload.descriptor.layout.rootIntegrations.map((root) => ({
    path: root.path, policy: root.policy, ...(root.presence === "optional" ? { optional: true as const } : {}),
  })) });
  return copyPayload.files.filter((file) => omitted.has(file.path)).map((file) => file.path);
} });
