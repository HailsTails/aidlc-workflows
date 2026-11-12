import { expect, test } from "bun:test";
import { scratchHostDistributionFixture } from "../packaging/fixtures/host-distribution.fixture.ts";
import { accept } from "../kernel/fixtures/accept.ts";
import { createInMemoryFileSystem } from "../kernel/fixtures/file-system.fake.ts";
import { createScriptedProcessRunner } from "../kernel/fixtures/process-runner.fake.ts";
import { createInMemoryYamlParser } from "../kernel/fixtures/yaml-parser.fake.ts";
import { accepted } from "../kernel/result.ts";
import { ONBOARDING_FILLS_FIXTURE } from "../projection/fixtures/document-rendering.fixture.ts";
import {
  SCRATCH_HOST, SCRATCH_HOST_DATA, SCRATCH_TOKENS, scratchAgentRenderer, scratchCommandPlacement,
  scratchDocumentRenderer, scratchSettingsRenderer, scratchSkillRenderer,
} from "../projection/fixtures/scratch-host.fixture.ts";
import { tokenBindingsFixture } from "../projection/fixtures/token-bindings.fixture.ts";
import type { Method } from "../workflow-definition/domain/method.ts";
import { methodSliceFixture } from "../workflow-definition/fixtures/method.fixture.ts";
import type { HostModule } from "./roots.ts";
import { createPackageBuildRoot } from "./package-build-root.ts";

const SCRATCH_MODULE: HostModule = {
  host: SCRATCH_HOST, distribution: () => accepted(scratchHostDistributionFixture),
  projection: {
    tokens: SCRATCH_TOKENS, commands: scratchCommandPlacement, fills: ONBOARDING_FILLS_FIXTURE,
    bindingHeading: "Scratch", renderData: () => SCRATCH_HOST_DATA, placements: [],
    agents: { inputs: [], render: scratchAgentRenderer },
    skills: { inputs: [], render: scratchSkillRenderer },
    settings: { inputs: [], render: scratchSettingsRenderer },
    documents: { inputs: [], render: scratchDocumentRenderer },
  },
};

const CORE_FILES = {
  "file:///core/aidlc-common/stages/.keep": "", "file:///core/agents/.keep": "",
  "file:///core/scopes/.keep": "", "file:///core/sensors/.keep": "",
  "file:///core/memory/.keep": "", "file:///core/knowledge/.keep": "",
  "file:///core/aidlc-common/conductor.md": "Raw {{INVOKE}}",
  "file:///core/aidlc-common/protocols/.keep": "",
  "file:///core/templates/onboarding.md": "Neutral",
  "file:///core/templates/onboarding-harness.md": "Native",
  "file:///core/tools/aidlc-version.ts": 'export const AIDLC_VERSION = "fixture";',
  "file:///core/tools/aidlc-utility.ts": "captured formatter",
  "file:///core/hooks/.keep": "",
};

const runnerEntry = (subject: { concept: string; name: string }) =>
  ({ subject, files: null, reason: null });

const AGENTS_ONLY_METHOD: Method = { ...methodSliceFixture, stages: [], scopes: [] };

const RUNNER_OUTCOME = accepted({
  exit: { kind: "exited" as const, code: 0 }, stderr: "", stdout: JSON.stringify({ failure: null, entries: [
    runnerEntry({ concept: "orchestrator-skill", name: "aidlc-init" }),
    runnerEntry({ concept: "orchestrator-skill", name: "aidlc-compose" }),
  ] }),
});

const projectEighthHost = async () => {
  const root = createPackageBuildRoot({ hosts: [SCRATCH_MODULE],
    platform: { fileSystem: createInMemoryFileSystem({ files: CORE_FILES }),
      processRunner: createScriptedProcessRunner({ outcome: RUNNER_OUTCOME }),
      yaml: createInMemoryYamlParser({ documents: {} }) },
    outliner: { outline: (text: string) => ({ text, headings: [] }) },
    sources: { core: new URL("file:///core/"), plugins: new URL("file:///plugins/") },
    runnerFrames: new URL("file:///frames/") });
  const loaded = accept(await root.loadCore());
  return accept(await root.projectHost({ host: SCRATCH_HOST,
    core: { ...loaded, method: AGENTS_ONLY_METHOD, sources: [] },
    files: [], prepare: accepted, tokens: tokenBindingsFixture({ harnessDir: ".scratch" }), channel: "copy",
    modelCap: null, entrypoints: [], projectRoot: new URL("file:///assembled/"), reviewerAgents: new Set() }));
};

const OWN_OR_HOST_NEUTRAL = /^(?:[.]scratch|aidlc)[/]/;

test("an eighth host registered as one module builds with the layout and files it declares", async () => {
  const projected = await projectEighthHost();
  expect(projected.host.layout).toEqual(scratchHostDistributionFixture.layout);
  expect(projected.projection.files).toContainEqual(
    expect.objectContaining({ path: ".scratch/agents/aidlc-product-agent.md" }));
  expect(projected.projection.files).toContainEqual(
    expect.objectContaining({ path: ".scratch/tools/data/harness.json" }));
  expect(projected.projection.files).toContainEqual(
    expect.objectContaining({ path: ".scratch/skills/aidlc/SKILL.md" }));
  expect(projected.projection.files).toContainEqual(
    expect.objectContaining({ path: ".scratch/settings.json" }));
  expect(projected.projection.files).toContainEqual(
    expect.objectContaining({ path: ".scratch/onboarding.md" }));
});

test("every file of an eighth host sits under its own folder or a host-neutral path", async () => {
  const projected = await projectEighthHost();
  expect(projected.projection.files).not.toContainEqual(
    expect.objectContaining({ path: expect.not.stringMatching(OWN_OR_HOST_NEUTRAL) }));
});
