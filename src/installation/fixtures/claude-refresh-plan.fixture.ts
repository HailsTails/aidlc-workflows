import { hash, path, version } from "../../kernel/fixtures/values.fixture.ts";
import type { RelativePath } from "../../kernel/values.ts";
import {
  claudeCopyPayloadFixture,
  hashOf,
} from "../../packaging/fixtures/claude-payload.fixture.ts";
import type { PayloadFile } from "../../packaging/domain/payload.ts";
import type { RootIntegration } from "../../projection/domain/root-integration.ts";
import type { InstallPlan } from "../domain/install-plan.ts";
import type { InstalledFile, RootContribution } from "../domain/ownership.ts";

const payload = claudeCopyPayloadFixture;

const shipped = (raw: string): PayloadFile => {
  const found = payload.files.find((file) => file.path === raw);
  if (found === undefined) {
    throw new Error(`Payload fixture ships no ${raw}`);
  }
  return found;
};

const integration = (raw: string): RootIntegration => {
  const found = payload.descriptor.rootIntegrations.find((entry) => entry.path === raw);
  if (found === undefined) {
    throw new Error(`Payload fixture integrates no ${raw}`);
  }
  return found;
};

const recordOf = (file: PayloadFile): InstalledFile => ({
  path: file.path,
  writtenHash: file.hash,
});

const agentFile = shipped(".claude/agents/aidlc-developer-agent.md");
const stageCommand = shipped(".claude/skills/aidlc-code-generation/SKILL.md");
const knowledgeFile = shipped(".claude/knowledge/aidlc-developer-agent/code-generation-guide.md");
const settingsFile = shipped(".claude/settings.json");
const onboardingFile = shipped(".claude/CLAUDE.md");
const retiredRunner: RelativePath = path(".claude/skills/aidlc-legacy-runner/SKILL.md");

const gitignoreBlock: RootContribution = {
  policy: "managed-block",
  path: path(".gitignore"),
  marker: "gitignore",
  blockHash: hashOf({ kind: "text", text: "aidlc/**/.aidlc-*\n" }),
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

export const claudeRefreshPlanFixture: InstallPlan = {
  payload,
  mode: { kind: "refresh", force: false },
  installedVersion: version("2.11.1"),
  files: [
    { kind: "update", file: agentFile, replaces: previousAgentHash },
    {
      kind: "conflict",
      file: stageCommand,
      recorded: previousCommandHash,
      current: editedCommandHash,
    },
    { kind: "create", file: knowledgeFile },
    { kind: "unchanged", path: settingsFile.path },
    { kind: "preserve", path: onboardingFile.path, projectHash: editedOnboardingHash },
    {
      kind: "retire",
      path: retiredRunner,
      expected: hash("sha256:1d51ae4ca4f74f842336dce75bc66bb4bbf55ce2de7c802ab059504cca99fd7b"),
    },
  ],
  rootIntegrations: [
    { kind: "merge", integration: integration(".gitignore"), contribution: gitignoreBlock },
    { kind: "unchanged", integration: integration(".mcp.json") },
  ],
  ownershipAfter: {
    stamp: payload.stamp,
    mcp: "defaults",
    files: [agentFile, knowledgeFile, settingsFile].map(recordOf).concat([
      { path: stageCommand.path, writtenHash: previousCommandHash },
      { path: onboardingFile.path, writtenHash: onboardingFile.hash },
    ]),
    rootContributions: [gitignoreBlock],
  },
  notes: [
    {
      path: stageCommand.path,
      line:
        "Kept your edit to .claude/skills/aidlc-code-generation/SKILL.md; run " +
        "`aidlc config --force` to take this release's copy instead.",
    },
  ],
};
