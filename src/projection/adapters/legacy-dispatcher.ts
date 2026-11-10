import { copyChannelDispatcherCommands, copyChannelToolScripts } from "../../../core/tools/aidlc.ts";
import { accepted, refused, type Result } from "../../kernel/result.ts";
import type { CopyChannelAllows, CopyChannelAllowSource } from "../application/ports/copy-channel.ts";
import type { ProjectionRefusal } from "../domain/projection.ts";

type DispatcherAllowSource = {
  read(): Result<CopyChannelAllows, Extract<ProjectionRefusal, { readonly kind: "render-failed" }>>;
};

export const createCopyChannelAllowSource = (): DispatcherAllowSource => ({
  read: () => {
    try {
      return accepted({ dispatcherCommands: copyChannelDispatcherCommands(), toolScripts: copyChannelToolScripts() });
    } catch (error) {
      return refused({ kind: "render-failed", concept: "settings", name: "copy-channel-allows",
        reason: error instanceof Error ? error.message : String(error) });
    }
  },
} satisfies CopyChannelAllowSource);
