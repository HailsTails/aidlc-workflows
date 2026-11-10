import { delegateAdmittedVerbs, delegatedLifecycleCommand } from "../../../core/hooks/aidlc-state-transition-guard.ts";
import type { DelegateShellFacts } from "../application/ports/delegate-shell.ts";

export const admittedVerbs: DelegateShellFacts["admittedVerbs"] = delegateAdmittedVerbs;

export const lifecycleAdmission: DelegateShellFacts["lifecycleAdmission"] = (command) =>
  delegatedLifecycleCommand(command) === null ? "admitted" : "refused";
