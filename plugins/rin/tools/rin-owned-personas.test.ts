import { describe, expect, test } from "vitest";
import { defaultPathOperations } from "./rin-harness-path-operations.ts";
import { defaultFileTextPort, defaultSidecarFileReader } from "./rin-harness-sidecar-file-reader.ts";

const paths = defaultPathOperations();
const files = defaultFileTextPort();
const directories = defaultSidecarFileReader();

const PLUGIN_ROOT = paths.join({
  segments: [paths.dirname({ path: paths.fromFileUrl({ url: import.meta.url }) }), ".."],
});
const STAGES_ROOT = paths.join({ segments: [PLUGIN_ROOT, "stages"] });
const AGENTS_ROOT = paths.join({ segments: [PLUGIN_ROOT, "agents"] });
const AGENT_NAME = /\b(?:rin|aidlc)-[a-z-]+-agent\b/g;
const STOCK_PERSONA = /^aidlc-/;

const entriesOf = (directory: string): readonly string[] =>
  directories.listDirectory(directory) ?? [];

const stageFiles: readonly string[] = entriesOf(STAGES_ROOT).flatMap((phase) =>
  entriesOf(paths.join({ segments: [STAGES_ROOT, phase] }))
    .filter((entry) => entry.endsWith(".md"))
    .map((entry) => paths.join({ segments: [STAGES_ROOT, phase, entry] })),
);

const frontmatterOf = (path: string): string =>
  files.read(path).split(/^---\r?$/m)[1] ?? "";

const agentsNamedIn = (text: string): readonly string[] => [
  ...new Set(text.match(AGENT_NAME) ?? []),
];

const stockPersonasIn = (agents: readonly string[]): readonly string[] =>
  agents.filter((agent) => STOCK_PERSONA.test(agent));

const unshippedAgentsIn = (agents: readonly string[]): readonly string[] =>
  agents.filter(
    (agent) =>
      !STOCK_PERSONA.test(agent) &&
      !files.exists(paths.join({ segments: [AGENTS_ROOT, `${agent}.md`] })),
  );

const rosterAgents: readonly string[] = agentsNamedIn(
  files.read(paths.join({ segments: [PLUGIN_ROOT, "hooks", "review-rosters.json"] })),
);

const boardAgents: readonly string[] = agentsNamedIn(
  files.read(paths.join({ segments: [PLUGIN_ROOT, "tools", "data", "review-board.json"] })),
);

describe("rin seats only its own personas", () => {
  test("the stage directory actually holds stages", () => {
    expect(stageFiles.length).toBeGreaterThan(0);
  });

  test.each(stageFiles)("%s seats no stock persona", (path) => {
    expect(stockPersonasIn(agentsNamedIn(frontmatterOf(path)))).toEqual([]);
  });

  test.each(stageFiles)("%s seats only agents rin ships", (path) => {
    expect(unshippedAgentsIn(agentsNamedIn(frontmatterOf(path)))).toEqual([]);
  });

  test("every review roster names only rin agents rin ships", () => {
    expect([...stockPersonasIn(rosterAgents), ...unshippedAgentsIn(rosterAgents)]).toEqual([]);
  });

  test("the review board catalogue names only rin agents rin ships", () => {
    expect([...stockPersonasIn(boardAgents), ...unshippedAgentsIn(boardAgents)]).toEqual([]);
  });
});
