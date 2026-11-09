import {
  copyChannelDelegateShellDeny,
  riskyFormDenyLines,
  RISKY_SHELL_FORMS,
  shellDenyLines,
} from "../../../harness/kiro-ide/delegate-shell-deny.ts";
import type { DelegateShellPolicy } from "../application/ports/delegate-shell.ts";

export const legacyDelegateShellPolicy = (directory: string): DelegateShellPolicy => ({
  shellDeny: (agent) => [
    ...shellDenyLines(copyChannelDelegateShellDeny(directory, agent)),
    ...riskyFormDenyLines([`bun ${directory}/tools/aidlc`]),
  ],
  riskyForms: RISKY_SHELL_FORMS,
});
