import { expect } from "bun:test";
import { nativeComposer, nativeArchitect } from "./worker-target-contracts.ts";
import { kiroWorkerCases, kasWorkerCases } from "./worker-source-cases.ts";

export const forkKiroWorker = kiroWorkerCases.find((entry) => entry.baseline === "fork") ?? expect.unreachable("missing fork Kiro policy source");
export const forkKasWorker = kasWorkerCases.find((entry) => entry.baseline === "fork") ?? expect.unreachable("missing fork KAS policy source");
export const architectPolicySource = {
  ...nativeArchitect,
  expectedJson: nativeArchitect.expectedJson ?? expect.unreachable("missing architect native JSON reference"),
  expectedKas: nativeArchitect.expectedKas ?? expect.unreachable("missing architect native Markdown reference"),
};
export const composerPolicyCases = [
  { ...nativeComposer, label: "actual composer", expectedName: "aidlc-composer-agent" },
  {
    ...nativeComposer, label: "renamed composer", expectedName: "scoped-worker-agent", name: "scoped-worker-agent",
    text: nativeComposer.text.replace("name: aidlc-composer-agent", "name: scoped-worker-agent"),
    origin: { ...nativeComposer.origin, path: "core/agents/scoped-worker-agent.md" },
    profileText: nativeComposer.profileText.replaceAll("aidlc-composer-agent", "scoped-worker-agent"),
    admissions: { ...nativeComposer.admissions, name: "scoped-worker-agent" },
  },
];
