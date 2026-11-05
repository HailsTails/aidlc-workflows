import { afterEach, describe, expect, test } from "bun:test";
import { filesystemWorkflowSourceReader } from "./aidlc-workflow-source-reader.ts";
import { cleanupWorkflowFixtures, createCandidateFixture } from "../../tests/harness/workflow-candidate-fixtures.ts";
import { writeFixtureFile } from "../../tests/harness/install-adoption.ts";

describe("workflow filesystem source reader", () => {
  afterEach(cleanupWorkflowFixtures);

  test("reads literal stage bytes with phase and source identity", () => {
    const fixture = createCandidateFixture("source-reader");
    writeFixtureFile({ root: fixture.harnessRoot, path: "aidlc-common/stages/operation/reader-probe.md", text: "literal source\r\n" });
    expect(filesystemWorkflowSourceReader.stageSources(fixture.paths.stagesDir)).toContainEqual(expect.objectContaining({
      path: expect.stringMatching(/[\\/]operation[\\/]reader-probe\.md$/), phase: "operation", text: "literal source\r\n",
    }));
  });

  test("missing prior grid is absent; present bytes are not normalized", () => {
    const fixture = createCandidateFixture("source-reader");
    expect(filesystemWorkflowSourceReader.priorGridText(fixture.paths.scopeGridPath)).toBeNull();
    writeFixtureFile({ root: fixture.harnessRoot, path: "tools/data/scope-grid.json", text: "{ \"legacy\": null }\r\n" });
    expect(filesystemWorkflowSourceReader.priorGridText(fixture.paths.scopeGridPath))
      .toBe('{ "legacy": null }\r\n');
  });
});
