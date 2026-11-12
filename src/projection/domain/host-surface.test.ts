import { describe, expect, test } from "bun:test";
import { path, source } from "../../kernel/fixtures/values.fixture.ts";
import { accepted, refused } from "../../kernel/result.ts";
import { authoredSourcePaths, harnessRecordWithLine } from "./host-surface.ts";
import type { ProjectedFile } from "./projected-file.ts";

describe("authoredSourcePaths", () => {
  test("accepts every portable path in order", () => {
    expect(authoredSourcePaths(["a/b.md", "c.md"])).toEqual(accepted([source("a/b.md"), source("c.md")]));
  });

  test("accepts an empty list", () => {
    expect(authoredSourcePaths([])).toEqual(accepted([]));
  });

  test("refuses with the first unportable path", () => {
    expect(authoredSourcePaths(["a.md", "bad:name", "c?.md"]))
      .toEqual(refused({ kind: "invalid-path", base: "source", raw: "bad:name" }));
  });
});

const RECORD_PATH = ".h/tools/data/harness.json";
const recordFile = (text: string): ProjectedFile => ({ path: path(RECORD_PATH), content: { kind: "text", text },
  mode: "regular", availability: "always", origin: { kind: "rendered", concept: "host-data", name: "h" } });
const line = { key: "layout", value: "v1" };

describe("harnessRecordWithLine", () => {
  test("writes the line after the last line that precedes it and before the lines that follow", () => {
    expect(harnessRecordWithLine({ files: [recordFile('{\n  "rulesSubdir": "rules",\n  "newChatStep": 1,\n  "hostShell": 2\n}\n')],
      path: RECORD_PATH, line })).toEqual(accepted([recordFile(
      '{\n  "rulesSubdir": "rules",\n  "newChatStep": 1,\n  "layout": "v1",\n  "hostShell": 2\n}\n')]));
  });

  test("writes the line first when no line precedes it", () => {
    expect(harnessRecordWithLine({ files: [recordFile('{\n  "hostShell": 2\n}\n')], path: RECORD_PATH, line }))
      .toEqual(accepted([recordFile('{\n  "layout": "v1",\n  "hostShell": 2\n}\n')]));
  });

  test("refuses a record that was not projected", () => {
    expect(harnessRecordWithLine({ files: [], path: RECORD_PATH, line })).toEqual(refused({ kind: "render-failed",
      concept: "host-data", name: RECORD_PATH, reason: "The host's harness record was not projected as text." }));
  });

  test("refuses a record that is not a JSON object", () => {
    expect(harnessRecordWithLine({ files: [recordFile("[]")], path: RECORD_PATH, line })).toEqual(refused({
      kind: "render-failed", concept: "host-data", name: RECORD_PATH,
      reason: "The host's harness record is not a JSON object." }));
  });
});
