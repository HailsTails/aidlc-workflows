import type { FileContent } from "../../kernel/file-content.ts";
import { hash, path, version } from "../../kernel/fixtures/values.fixture.ts";
import type { ProjectPath } from "../../kernel/values.ts";
import type { PayloadFile } from "../../packaging/domain/payload.ts";
import type { RootIntegration } from "../../packaging/domain/root-integration.ts";
import { claudeCopyPayloadFixture } from "../../packaging/fixtures/claude-payload.fixture.ts";
import { hashOf } from "../../packaging/fixtures/content-hashes.fixture.ts";
import type { PlannedContent } from "../domain/file-operation.ts";
import type {
  BlockedInstallPlan,
  ManagedFileDecision,
  ReadyInstallPlan,
  RootIntegrationDecision,
} from "../domain/install-plan.ts";
import type { RootContribution } from "../domain/ownership.ts";

const payload = claudeCopyPayloadFixture;

const shipped = (raw: string): PayloadFile => {
  const found = payload.files.find((file) => file.path === raw);
  if (found === undefined) {
    throw new Error(`Payload fixture ships no ${raw}`);
  }
  return found;
};

const integration = (raw: string): RootIntegration => {
  const found = payload.descriptor.layout.rootIntegrations.find((entry) => entry.path === raw);
  if (found === undefined) {
    throw new Error(`Payload fixture integrates no ${raw}`);
  }
  return found;
};

const planned = (text: string): PlannedContent => {
  const content: FileContent = { kind: "text", text };
  return { content, hash: hashOf(content) };
};

const agentFile = shipped(".claude/agents/aidlc-developer-agent.md");
const stageCommand = shipped(".claude/skills/aidlc-code-generation/SKILL.md");
const knowledgeFile = shipped(".claude/knowledge/aidlc-developer-agent/code-generation-guide.md");
const settingsFile = shipped(".claude/settings.json");
const onboardingFile = shipped(".claude/CLAUDE.md");
const retiredRunner: ProjectPath = path(".claude/skills/aidlc-legacy-runner/SKILL.md");

const gitignoreBefore = planned(
  "node_modules/\n# >>> aidlc gitignore\n.aidlc-*\n# <<< aidlc gitignore\n",
);
const gitignoreAfter = planned(
  "node_modules/\n# >>> aidlc gitignore\naidlc/**/.aidlc-*\n# <<< aidlc gitignore\n",
);

const gitignoreBlock: RootContribution = {
  integration: path(".gitignore"),
  written: {
    kind: "block",
    marker: "gitignore",
    hash: hashOf({ kind: "text", text: "aidlc/**/.aidlc-*\n" }),
  },
};

const previousAgentHash = hash(
  "sha256:631688bc85683ea22c9415cb345c69169cff4ac45ec006c258217cd261a7793f",
);
const previousCommandHash = hash(
  "sha256:051866aa49f8ed915ab5ae30707422068df814ca5be806a1fe28784c543a4aab",
);
const editedCommandHash = hash(
  "sha256:a618a3a615ef7159c7eed634a5a332bf9d017f8e28d6b0f0adad9db1d2d725e0",
);
const editedOnboardingHash = hash(
  "sha256:3cc1cbd212d2ca0dbf1e525eb9a40d4694a585eb7864d8b877f8fe8bd99122dc",
);
const retiredRunnerHash = hash(
  "sha256:1d51ae4ca4f74f842336dce75bc66bb4bbf55ce2de7c802ab059504cca99fd7b",
);
const recordBeforeHash = hash(
  "sha256:5b1f0e2b7d1c4f8a9e3d6c2b1a0f9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a29",
);

const filesBesideStageCommand: readonly ManagedFileDecision[] = [
  { kind: "update", file: agentFile, replaces: previousAgentHash, change: "content" },
  { kind: "create", file: knowledgeFile },
  { kind: "unchanged", path: settingsFile.path },
  { kind: "preserve", path: onboardingFile.path, projectHash: editedOnboardingHash },
  { kind: "retire", path: retiredRunner, expected: retiredRunnerHash },
];

const refreshRootIntegrations: readonly RootIntegrationDecision[] = [
  {
    kind: "merge",
    integration: integration(".gitignore"),
    before: { kind: "hash", hash: gitignoreBefore.hash },
    next: gitignoreAfter,
    contribution: gitignoreBlock,
  },
  { kind: "unchanged", integration: integration(".mcp.json") },
];

export const claudeRefreshPlanFixture: ReadyInstallPlan = {
  kind: "ready",
  payload,
  mode: { kind: "refresh", force: false },
  installedVersion: version("2.11.1"),
  mcp: "defaults",
  files: [{ kind: "unchanged", path: stageCommand.path }, ...filesBesideStageCommand],
  rootIntegrations: refreshRootIntegrations,
  recordBefore: { kind: "hash", hash: recordBeforeHash },
  notes: [],
};

export const claudeBlockedRefreshPlanFixture: BlockedInstallPlan = {
  kind: "blocked",
  payload,
  mode: { kind: "refresh", force: false },
  installedVersion: version("2.11.1"),
  mcp: "defaults",
  files: filesBesideStageCommand,
  rootIntegrations: refreshRootIntegrations,
  conflicts: [
    {
      path: stageCommand.path,
      cause: {
        kind: "edited",
        recorded: previousCommandHash,
        current: editedCommandHash,
        retiring: false,
      },
    },
  ],
  notes: [],
};
