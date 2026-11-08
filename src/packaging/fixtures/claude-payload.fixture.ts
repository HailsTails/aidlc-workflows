import { createHash } from "node:crypto";
import { path, hash, version } from "../../kernel/fixtures/values.fixture.ts";
import type { ContentHash } from "../../kernel/values.ts";
import { claudeProjectionFixture } from "../../projection/fixtures/claude-projection.fixture.ts";
import type { FileContent, ProjectedFile } from "../../projection/domain/projected-file.ts";
import type { Payload, PayloadFile, RuntimeEntryPoint, VersionStamp } from "../domain/payload.ts";

export const hashOf = (content: FileContent): ContentHash => {
  const digest = createHash("sha256");
  digest.update(content.kind === "text" ? content.text : content.bytes);
  return hash(`sha256:${digest.digest("hex")}`);
};

const fromProjection = (file: ProjectedFile): PayloadFile => ({
  path: file.path,
  hash: hashOf(file.content),
  content: file.content,
  executable: file.executable,
  origin: { kind: "projected", origin: file.origin },
});

const textFile = (lines: readonly string[]): FileContent => ({
  kind: "text",
  text: `${lines.join("\n")}\n`,
});

const cliEntry: RuntimeEntryPoint = {
  name: "aidlc",
  compositionRoot: path("src/cli/main.ts"),
};

const stamp: VersionStamp = {
  frameworkVersion: version("2.12.0"),
  distribution: claudeProjectionFixture.harness,
  harnessDirectory: claudeProjectionFixture.profile.harnessDirectory,
};

const runtimeContent = textFile(["#!/usr/bin/env bun", "export {};"]);

const stampContent = textFile([
  '{ "schemaVersion": 1, "frameworkVersion": "2.12.0", "distribution": "claude", ' +
    '"harnessDir": ".claude" }',
]);

const descriptorContent = textFile(['{ "schemaVersion": 2, "frameworkVersion": "2.12.0" }']);

export const claudeCopyPayloadFixture: Payload = {
  distribution: claudeProjectionFixture.harness,
  layout: "copy",
  stamp,
  descriptor: {
    profile: claudeProjectionFixture.profile,
    rootIntegrations: claudeProjectionFixture.rootIntegrations,
    managedDirectories: claudeProjectionFixture.managedDirectories,
    retiredFiles: [
      {
        path: path(".claude/skills/aidlc-legacy-runner/SKILL.md"),
        shippedHashes: [
          hash("sha256:1d51ae4ca4f74f842336dce75bc66bb4bbf55ce2de7c802ab059504cca99fd7b"),
        ],
      },
    ],
  },
  files: [
    ...claudeProjectionFixture.files.map(fromProjection),
    {
      path: path(".claude/tools/aidlc.ts"),
      hash: hashOf(runtimeContent),
      content: runtimeContent,
      executable: true,
      origin: { kind: "bundled-runtime", entry: cliEntry },
    },
    {
      path: path(".claude/tools/data/aidlc-version.json"),
      hash: hashOf(stampContent),
      content: stampContent,
      executable: false,
      origin: { kind: "version-stamp" },
    },
    {
      path: path(".claude/tools/data/aidlc-projection.json"),
      hash: hashOf(descriptorContent),
      content: descriptorContent,
      executable: false,
      origin: { kind: "distribution-descriptor" },
    },
  ],
};
