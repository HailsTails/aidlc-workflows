import { LAUNCHER_PATH, launcherBody } from "../../../core/tools/aidlc-launcher-voucher.ts";
import type { EngineLauncher } from "../application/ports/settings.ts";

export const legacyEngineLauncher: EngineLauncher = {
  path: LAUNCHER_PATH,
  body: ({ invocation }) => launcherBody(invocation),
};
