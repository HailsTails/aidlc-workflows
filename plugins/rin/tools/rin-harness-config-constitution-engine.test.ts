import { afterEach, describe, expect, test } from "vitest";
import { resolveConstitutionEngine } from "./rin-harness-config.ts";
import { defaultPathOperations } from "./rin-harness-path-operations.ts";
import { defaultFileTextPort } from "./rin-harness-sidecar-file-reader.ts";

const fileText = defaultFileTextPort();
const pathOperations = defaultPathOperations();
const createdDirectories: string[] = [];

const projectWithConstitution = ({ constitution }: { readonly constitution: unknown }): string => {
  const projectDir = fileText.makeTemporaryDirectory(
    pathOperations.join({ segments: [fileText.temporaryRoot(), "rin-constitution-engine-"] }),
  );
  createdDirectories.push(projectDir);
  fileText.write(
    pathOperations.join({ segments: [projectDir, "harness.config.json"] }),
    JSON.stringify({
      projectName: "engine-probe",
      defaultScope: "workshop",
      rulesetRoot: "aidlc/spaces/default/memory",
      stageGraph: ".claude/tools/data/stage-graph.json",
      packageManager: { primary: "bun", runnerAllowlist: [] },
      constitution,
    }),
  );
  return projectDir;
};

afterEach(() => {
  createdDirectories.splice(0).forEach((directory) => {
    fileText.remove(directory, { recursive: true, force: true });
  });
});

describe("resolveConstitutionEngine", () => {
  test("a project with no harness.config.json runs the rin walker", () => {
    const projectDir = fileText.makeTemporaryDirectory(
      pathOperations.join({ segments: [fileText.temporaryRoot(), "rin-constitution-engine-"] }),
    );
    createdDirectories.push(projectDir);
    expect(resolveConstitutionEngine({ projectDir })).toEqual({
      outcome: "resolved",
      constitutionEngine: { engine: "rin-walker" },
    });
  });

  test("a constitution block without an engine runs the rin walker", () => {
    expect(resolveConstitutionEngine({ projectDir: projectWithConstitution({ constitution: { include: ["src/**"] } }) })).toEqual({
      outcome: "resolved",
      constitutionEngine: { engine: "rin-walker" },
    });
  });

  test("discipline-core carries its base revision", () => {
    expect(
      resolveConstitutionEngine({
        projectDir: projectWithConstitution({ constitution: { engine: "discipline-core", baseRevision: "origin/main" } }),
      }),
    ).toEqual({
      outcome: "resolved",
      constitutionEngine: { engine: "discipline-core", baseRevision: "origin/main" },
    });
  });

  test("an unknown engine fails instead of falling back to the walker", () => {
    expect(
      resolveConstitutionEngine({ projectDir: projectWithConstitution({ constitution: { engine: "discipline-cor" } }) }),
    ).toEqual({ outcome: "failed", reason: '"constitution.engine" must be "rin-walker" or "discipline-core"' });
  });

  test("a blank base revision fails", () => {
    expect(
      resolveConstitutionEngine({
        projectDir: projectWithConstitution({ constitution: { engine: "discipline-core", baseRevision: " " } }),
      }),
    ).toEqual({ outcome: "failed", reason: '"constitution.baseRevision" must be a non-empty string' });
  });
});
