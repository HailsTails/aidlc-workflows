export const previewFailure = ({ reason }) => {
  switch (reason) {
    case "missing-runtime": return { kind: "unavailable", reason };
    case "incompatible-exports": return { kind: "invalid", reason };
    case "load-failed":
    case "input-failed":
    case "execution-failed":
    case "unexpected": return { kind: "failed", reason };
    case "unknown-outcome": return { kind: "invalid-protocol", reason };
  }
  return { kind: "invalid-protocol", reason: "unknown-outcome" };
};

const outcomeFields = ({ outcome }) => {
  if (outcome === null || typeof outcome !== "object" || !Object.hasOwn(outcome, "kind")) {
    return { kind: undefined, reason: undefined };
  }
  return { kind: outcome.kind, reason: Object.hasOwn(outcome, "reason") ? outcome.reason : undefined };
};

export const isPreviewOutcome = ({ outcome }) => {
  const candidate = outcomeFields({ outcome });
  switch (candidate.kind) {
    case "registered":
    case "not-requested": return candidate.reason === undefined;
    case "unavailable": return candidate.reason === "missing-runtime";
    case "invalid": return candidate.reason === "incompatible-exports";
    case "failed": return candidate.reason === "load-failed" || candidate.reason === "input-failed" || candidate.reason === "execution-failed" || candidate.reason === "unexpected";
    case "invalid-protocol": return candidate.reason === "unknown-outcome";
  }
  return false;
};

export const previewRuntimeContract = ({ generator, registry }) => {
  const generatePreviewLaunch = generator?.generatePreviewLaunch;
  const mainRootFrom = registry?.mainRootFrom;
  const prunedWorktrees = registry?.prunedWorktrees;
  const readRegistry = registry?.readRegistry;
  const writeRegistry = registry?.writeRegistry;
  if (typeof generatePreviewLaunch !== "function") {
    return previewFailure({ reason: "incompatible-exports" });
  }
  if (
    typeof mainRootFrom !== "function" ||
    typeof prunedWorktrees !== "function" ||
    typeof readRegistry !== "function" ||
    typeof writeRegistry !== "function"
  ) {
    return previewFailure({ reason: "incompatible-exports" });
  }
  return { kind: "ready", runtime: { generatePreviewLaunch, mainRootFrom, prunedWorktrees, readRegistry, writeRegistry } };
};

export const previewRegistrationDisposition = ({ outcome }) => {
  const candidate = outcomeFields({ outcome });
  const admitted = isPreviewOutcome({ outcome: candidate }) ? candidate : previewFailure({ reason: "unknown-outcome" });
  switch (admitted.kind) {
    case "registered":
    case "not-requested": return { exitCode: 0, diagnostic: "" };
    case "unavailable": return { exitCode: 1, diagnostic: "Rin preview registration unavailable: project scripts must provide generate-preview-launch.mjs and preview-worktree-registry.mjs.\n" };
    case "invalid": return { exitCode: 1, diagnostic: "Rin preview registration unavailable: project preview helpers do not provide the required registration exports.\n" };
    case "invalid-protocol": return { exitCode: 1, diagnostic: "Rin preview registration failed: the hook returned an invalid outcome.\n" };
    case "failed":
      switch (admitted.reason) {
        case "load-failed": return { exitCode: 1, diagnostic: "Rin preview registration failed: project preview helpers could not be loaded.\n" };
        case "input-failed": return { exitCode: 1, diagnostic: "Rin preview registration failed: hook input could not be read.\n" };
        case "execution-failed":
        case "unexpected": return { exitCode: 1, diagnostic: "Rin preview registration failed: project preview helpers could not complete registration.\n" };
      }
  }
};
