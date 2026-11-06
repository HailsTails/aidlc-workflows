import type {
  InstallationDecisionInput,
  InstalledResource,
} from "../src/domain/installation-decision.ts";
import type { MemoryPlan } from "../src/infrastructure/memory-installation.ts";
export const bundleFixture = (
  changes: Partial<InstallationDecisionInput["bundles"][number]> = {},
): InstallationDecisionInput["bundles"][number] => ({
  harness: "claude",
  unit: "plugin:test-pro/reviewer",
  source: { kind: "plugin", id: "test-pro" },
  resources: [
    { kind: "file", path: ".claude/agents/reviewer.md", body: "Reviewer" },
    { kind: "registration", path: ".claude/hooks/reviewer.json", body: "Hook" },
  ],
  ...changes,
});
export const installationFixture = (
  changes: Partial<InstallationDecisionInput> = {},
): InstallationDecisionInput => ({
  harness: "claude",
  selectedPlugins: ["test-pro"],
  bundles: [bundleFixture()],
  snapshot: { revision: 0, resources: [] },
  policy: "reconcile",
  ...changes,
});
export const installedFixture = ({
  fileBody = "Reviewer",
  registrationBody = "Hook",
  fileOwnership = {
    harness: "claude",
    unit: "plugin:test-pro/reviewer",
    source: { kind: "plugin", id: "test-pro" },
    body: "Reviewer",
  },
  registrationOwnership = {
    harness: "claude",
    unit: "plugin:test-pro/reviewer",
    source: { kind: "plugin", id: "test-pro" },
    body: "Hook",
  },
}: {
  readonly fileBody?: string;
  readonly registrationBody?: string;
  readonly fileOwnership?: InstalledResource["ownership"];
  readonly registrationOwnership?: InstalledResource["ownership"];
} = {}): readonly InstalledResource[] => [
  { kind: "file", path: ".claude/agents/reviewer.md", body: fileBody, ownership: fileOwnership },
  {
    kind: "registration",
    path: ".claude/hooks/reviewer.json",
    body: registrationBody,
    ownership: registrationOwnership,
  },
];
export const memoryPlanFixture = (changes: Partial<MemoryPlan> = {}): MemoryPlan => ({
  conflicts: [],
  expectedRevision: 0,
  expectedResources: "[]",
  changes: [
    {
      action: "put",
      resource: { kind: "file", path: "reviewer.md", body: "Reviewer", ownership: null },
    },
    {
      action: "put",
      resource: { kind: "registration", path: "hook.json", body: "Hook", ownership: null },
    },
  ],
  ...changes,
});
