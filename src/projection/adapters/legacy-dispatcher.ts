import { copyChannelDispatcherCommands, copyChannelToolScripts } from "../../../core/tools/aidlc.ts";
import { accepted, refused } from "../../kernel/result.ts";
import type { CopyChannelAllowSource } from "../application/ports/copy-channel.ts";

export const createCopyChannelAllowSource = (): CopyChannelAllowSource => ({
  read: () => {
    try {
      return accepted({ dispatcherCommands: copyChannelDispatcherCommands(), toolScripts: copyChannelToolScripts() });
    } catch (error) {
      return refused({ kind: "render-failed", concept: "settings", name: "copy-channel-allows",
        reason: error instanceof Error ? error.message : String(error) });
    }
  },
});
