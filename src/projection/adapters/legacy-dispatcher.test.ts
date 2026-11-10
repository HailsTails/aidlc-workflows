import { expect, test } from "bun:test";
import { createCopyChannelAllowSource, dispatcherCommands, engineRouteAdmission, engineRoutes } from "./legacy-dispatcher.ts";

const shippedAllows = {
  "ok": true,
  "value": {
    "dispatcherCommands": [
      "doctor",
      "doctor --verbose",
      "version",
      "--doctor",
      "--doctor --verbose",
      "--version",
      "status",
      "--status",
      "config --help",
      "config --show",
      "config --show --json",
      "config models --show",
      "config models --show --json",
      "config models --help",
      "config runtime --show",
      "config runtime --show --json",
      "config runtime --help",
      "config providers --show",
      "config providers --show --json",
      "config providers --help",
      "config trust --show",
      "config trust --show --json",
      "config trust --help",
      "config flags --show",
      "config flags --show --json",
      "config flags --help",
      "config project --show",
      "config project --show --json",
      "config project --help",
      "config flags --clear-bypass AIDLC_SKIP_ARTIFACT_GUARD --yes",
      "config flags --clear-bypass AIDLC_SKIP_REVISION_BACKSTOP --yes",
      "config flags --clear-bypass AIDLC_SKIP_SUMMARY_CONFIRMATION_GUARD --yes",
      "config flags --clear-bypass AIDLC_SKIP_HUMAN_PRESENCE_GUARD --yes",
      "config flags --clear-bypass AIDLC_DISABLE_ENSEMBLE_EVIDENCE --yes",
      "config flags --clear-bypass AIDLC_DISABLE_PLAN_APPROVAL_GUARD --yes",
      "config flags --clear-bypass AIDLC_DISABLE_REVIEWER_SCOPE_HOOK --yes",
      "config flags --clear-bypass AIDLC_DISABLE_REVIEW_FREEZE_HOOK --yes",
      "config flags --clear-bypass AIDLC_DISABLE_USAGE_TRACKING --yes",
      "config flags --clear-bypass AIDLC_DISABLE_SENSORS --yes",
      "config flags --clear-bypass AIDLC_DISABLE_LEARNINGS --yes",
      "config flags --clear-bypass AIDLC_DISABLE_SUMMARY_CONFIRMATION --yes"
    ],
    "toolScripts": [
      "aidlc-attest.ts",
      "aidlc-audit.ts",
      "aidlc-bolt.ts",
      "aidlc-completions.ts",
      "aidlc-graph.ts",
      "aidlc-jump.ts",
      "aidlc-knowledge.ts",
      "aidlc-learnings.ts",
      "aidlc-log.ts",
      "aidlc-orchestrate.ts",
      "aidlc-plugin.ts",
      "aidlc-review-brief.ts",
      "aidlc-runner-gen.ts",
      "aidlc-runtime.ts",
      "aidlc-sensor-claim-sources.ts",
      "aidlc-sensor-linter.ts",
      "aidlc-sensor-required-sections.ts",
      "aidlc-sensor-traceability.ts",
      "aidlc-sensor-type-check.ts",
      "aidlc-sensor-upstream-coverage.ts",
      "aidlc-sensor.ts",
      "aidlc-state.ts",
      "aidlc-swarm.ts",
      "aidlc-testing-posture.ts",
      "aidlc-unit.ts",
      "aidlc-utility.ts",
      "aidlc-validate.ts",
      "aidlc-workspace-sync.ts",
      "aidlc-worktree.ts"
    ]
  }
} as const;

test("the settings bridge retains every shipped command and tool in canonical order", () => {
  expect(createCopyChannelAllowSource().read()).toEqual(shippedAllows);
});

test("engine routes stay within the requested namespace and expose their shipped verbs", () => {
  expect(engineRoutes("engine")).toContainEqual({ group: "top", verbs: ["status"] });
  expect(engineRoutes("not-a-shipped-namespace")).toEqual([]);
  expect(dispatcherCommands()).toContain("doctor");
});

test("engine route admission delegates reads and rejects an unadmitted mutation", () => {
  expect(engineRouteAdmission({ admitted: { "aidlc-state.ts": ["get"] }, words: ["state", "get"] })).toBe("admitted");
  expect(engineRouteAdmission({ admitted: { "aidlc-state.ts": ["get"] }, words: ["state", "set"] })).toBe("refused");
});
