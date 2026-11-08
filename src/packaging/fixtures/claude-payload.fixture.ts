import type { FileContent } from "../../kernel/file-content.ts";
import { hash, path, source, version } from "../../kernel/fixtures/values.fixture.ts";
import type { ProjectedFile } from "../../projection/domain/projected-file.ts";
import { claudeProjectionFixture } from "../../projection/fixtures/claude-projection.fixture.ts";
import type { Payload, PayloadFile, RuntimeEntryPoint } from "../domain/payload.ts";
import { claudeLayoutFixture, claudePriorIntegrationsFixture } from "./claude-layout.fixture.ts";
import { hashOf } from "./content-hashes.fixture.ts";

const fromProjection = (file: ProjectedFile): PayloadFile => ({
  path: file.path,
  hash: hashOf(file.content),
  content: file.content,
  mode: file.mode,
  origin: { kind: "projected", origin: file.origin },
});

const textFile = (lines: readonly string[]): FileContent => ({
  kind: "text",
  text: `${lines.join("\n")}\n`,
});

const cliEntry: RuntimeEntryPoint = {
  name: "aidlc",
  compositionRoot: source("src/cli/main.ts"),
};

const runtimeContent = textFile(["#!/usr/bin/env bun", "export {};"]);

const stampContent = textFile([
  '{ "schemaVersion": 1, "frameworkVersion": "2.12.0", "distribution": "claude", ' +
    '"harnessDir": ".claude" }',
]);

const descriptorContent = textFile(['{ "schemaVersion": 2, "frameworkVersion": "2.12.0" }']);

export const claudeCopyPayloadFixture: Payload = {
  version: version("2.12.0"),
  channel: "copy",
  descriptor: {
    host: claudeProjectionFixture.host,
    layout: claudeLayoutFixture,
    history: {
      retiredFiles: [
        {
          path: path(".claude/skills/aidlc-legacy-runner/SKILL.md"),
          shippedHashes: [
            hash("sha256:1d51ae4ca4f74f842336dce75bc66bb4bbf55ce2de7c802ab059504cca99fd7b"),
          ],
        },
      ],
      priorIntegrations: claudePriorIntegrationsFixture,
    },
  },
  files: [
    ...claudeProjectionFixture.files.map(fromProjection),
    {
      path: path(".claude/tools/aidlc.ts"),
      hash: hashOf(runtimeContent),
      content: runtimeContent,
      mode: "executable",
      origin: { kind: "bundled-runtime", entry: cliEntry },
    },
    {
      path: path(".claude/tools/data/aidlc-version.json"),
      hash: hashOf(stampContent),
      content: stampContent,
      mode: "regular",
      origin: { kind: "version-stamp" },
    },
    {
      path: path(".claude/tools/data/aidlc-projection.json"),
      hash: hashOf(descriptorContent),
      content: descriptorContent,
      mode: "regular",
      origin: { kind: "distribution-descriptor" },
    },
  ],
};
