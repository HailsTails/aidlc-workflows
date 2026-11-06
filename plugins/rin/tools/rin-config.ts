import type { main } from "../../../core/tools/aidlc-init.ts";
import { rinWorkflowRefreshPolicy } from "../application/refresh-policy.ts";
import type { WorkflowRefreshPolicy } from "../../../core/tools/aidlc-workflow-refresh-contract.ts";

export type RinConfigurePort = (request: { readonly input: readonly string[]; readonly refreshPolicy: WorkflowRefreshPolicy }) => Promise<void>;

type CoreConfigurationApi = { readonly main: typeof main };

export type RinConfigCommand = {
  readonly run: (request: { readonly input: readonly string[] }) => Promise<void>;
  readonly configure: (request: { readonly input: readonly string[] }) => Promise<void>;
};

export function createRinConfigCommand(input: { readonly configure: RinConfigurePort }): RinConfigCommand {
  const configure = (request: { readonly input: readonly string[] }): Promise<void> =>
    input.configure({ input: [...request.input], refreshPolicy: rinWorkflowRefreshPolicy });
  return { run: (request) => configure({ input: ["config", ...request.input] }), configure };
}

export function createDefaultRinConfigCommand(): RinConfigCommand {
  return createRinConfigCommand({ configure: async (request) => {
    const core: CoreConfigurationApi = await import("../../../core/tools/aidlc-init.ts");
    await core.main([...request.input], { refreshPolicy: request.refreshPolicy });
  } });
}

export const rinConfigCommand = createDefaultRinConfigCommand();
if (import.meta.main) await rinConfigCommand.run({ input: process.argv.slice(2) });
