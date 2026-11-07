import { renderNeutralOnboarding, renderOnboarding } from "../../scripts/onboarding.ts";
import { projectOnboardingDocuments } from "../../scripts/onboarding-projection.ts";
import { substituteAuthoredTokens } from "../../scripts/projection-text.ts";
import { TRUSTED_ROUTE_NAMESPACE } from "../../core/tools/aidlc-command.ts";
import onboardingFills from "./onboarding.fills.ts";
import { launcherBody, LAUNCHER_PATH } from "../../core/tools/aidlc-launcher-voucher.ts";
import { EXTENDED_SUBPROCESS_TIMEOUT_MS } from "../../core/tools/aidlc-runtime-budget.ts";

// Both Copilot hosts consume these matcher-free registrations. Stop is not SessionEnd.
const events = [
  ["SessionStart", "session-start", 1],
  ["UserPromptSubmit", "record-human-turn", 1],
  ["PreToolUse", "guard-tool-call", 1],
  ["PostToolUse", "post-tool", 2],
  ["PreCompact", "validate-state", 1],
  ["SubagentStart", "subagent-start", 1],
  ["SubagentStop", "log-subagent", 1],
  ["Stop", "continue-workflow", 2],
] as const;

export function prepareCopilotHooks(invocation: "aidlc" | "bun .aidlc/tools/aidlc.ts"): string {
  if (invocation !== "aidlc" && invocation !== "bun .aidlc/tools/aidlc.ts") throw new Error("Copilot hooks require an explicit qualified invocation");
  const prefix = invocation === "aidlc" ? "aidlc engine adapter copilot" : "bun .aidlc/hooks/aidlc-copilot-adapter.ts";
  const hooks = Object.fromEntries(events.map(([event, target, factor]) => {
    const command = `${prefix} ${target}`;
    return [event, [{ type: "command", bash: command, powershell: command, timeoutSec: EXTENDED_SUBPROCESS_TIMEOUT_MS / 1000 * factor }]];
  }));
  return `${JSON.stringify({ version: 1, hooks }, null, 2)}\n`;
}

export function prepareCopilotLauncher(invocation: "aidlc" | "bun .aidlc/tools/aidlc.ts"): string {
  if (LAUNCHER_PATH !== ".aidlc/bin/aidlc-engine") throw new Error("Copilot requires its declared launcher destination");
  return launcherBody(invocation);
}

// The legacy native producer records the pre-rewrite combined root signature.
// Keep that migration signature separate from delivered root content and managed-file history.
export function copilotLegacyRootText(neutralTemplate: string, nativeSkeleton: string): string {
  const documents = projectOnboardingDocuments({ neutral: renderNeutralOnboarding(neutralTemplate), nativeSkeleton, shared: { root: "project", path: "AGENTS.md" }, nativePath: null });
  if (documents.length !== 1 || documents[0]!.kind !== "combined") throw new Error("Copilot root compatibility requires one combined document");
  return substituteAuthoredTokens({ source: renderOnboarding(documents[0]!.content, onboardingFills), harnessDir: ".aidlc", binding: { invoke: "aidlc", toolPrefix: "bun .aidlc/tools/", trustedNamespace: TRUSTED_ROUTE_NAMESPACE } }).replaceAll(".aidlc/skills/", ".github/skills/");
}
