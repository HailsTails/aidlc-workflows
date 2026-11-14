import { LAUNCHER_PATH, launcherBody } from "../../../../core/tools/aidlc-launcher-voucher.ts";

export const copilotEngineLauncher = {
  path: LAUNCHER_PATH,
  body: ({ invocation }: { readonly invocation: string }): string => launcherBody(invocation),
};
