import type { DelegateShellFacts, EngineRoute } from "../application/ports/delegate-shell.ts";
import { ROUTES, admittedEngineRoute, copyChannelDispatcherCommands, copyChannelToolScripts } from "../../../core/tools/aidlc.ts";
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

export const dispatcherCommands = (): readonly string[] => copyChannelDispatcherCommands();

export const engineRoutes = (namespace: string): readonly EngineRoute[] => ROUTES
  .filter((route) => route.namespace === namespace && route.classification !== "routing-only")
  .map(({ group, verbs }) => ({ group, verbs }));

export const engineRouteAdmission: DelegateShellFacts["engineRouteAdmission"] = ({ admitted, words }) =>
  admittedEngineRoute(admitted, words) ? "admitted" : "refused";
