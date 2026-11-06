import type { runPluginSyncWithRefreshPolicy } from "../../../core/tools/aidlc-plugin.ts";
import { rinWorkflowRefreshPolicy } from "../application/refresh-policy.ts";

export type RinPluginRefreshPort = { readonly run: typeof runPluginSyncWithRefreshPolicy };
export const createRinPluginRefreshPort = (): RinPluginRefreshPort => ({
  run: async (request) => {
    const corePlugin = await import("../../../core/tools/aidlc-plugin.ts");
    await corePlugin.runPluginSyncWithRefreshPolicy(request);
  },
});

export const runRinPluginRefresh = ({ argv, port = createRinPluginRefreshPort() }: {
  readonly argv: string[];
  readonly port?: RinPluginRefreshPort;
}): Promise<void> => port.run({ argv, refreshPolicy: rinWorkflowRefreshPolicy });

if (import.meta.main) await runRinPluginRefresh({ argv: process.argv.slice(2) });
